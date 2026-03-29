#!/usr/bin/env node
// capability-controllers/review-code.mjs
// Triple-model async code review controller.
// Spawned as a detached child process by capability-dispatch.mjs.
// Usage: node review-code.mjs <session-dir>

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { callParallel } from "./proxy-client.mjs";
import { isExcluded, redact } from "./redact.mjs";
import { atomicWrite, clearEdits, readEdits } from "./state.mjs";

const PROJECT_NAME = process.env.USERTRUST_PROJECT_NAME ?? "this project";
const PROJECT_CONTEXT = process.env.USERTRUST_PROJECT_CONTEXT
	?? "TypeScript project with strict mode enabled.";

const MODELS = ["gpt-5.4", "claude-opus-4-6", "gemini-3.1-pro-preview"];

const sessionDir = process.argv[2];
if (!sessionDir) {
	console.error("[review-code] No session dir provided");
	process.exit(1);
}

/**
 * Compute git diff for a list of files.
 * Falls back to reading file contents for untracked/new files.
 * Uses execFileSync (no shell) to avoid injection via filenames.
 */
function computeDiff(files) {
	const uniqueFiles = [...new Set(files)].filter((f) => !isExcluded(f));
	if (uniqueFiles.length === 0) return "";

	let diff = "";

	// Try git diff HEAD (staged + unstaged vs last commit)
	try {
		diff = execFileSync("git", ["diff", "HEAD", "--", ...uniqueFiles], {
			timeout: 5_000,
			encoding: "utf8",
		});
	} catch {
		// Fallback: try plain git diff (unstaged only)
		try {
			diff = execFileSync("git", ["diff", "--", ...uniqueFiles], {
				timeout: 5_000,
				encoding: "utf8",
			});
		} catch {
			diff = "";
		}
	}

	// For new/untracked files with no diff, read content directly
	if (!diff.trim()) {
		const parts = [];
		for (const file of uniqueFiles) {
			try {
				const content = readFileSync(file, "utf8");
				parts.push(
					`--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split("\n").length} @@\n` +
						content
							.split("\n")
							.map((l) => `+${l}`)
							.join("\n")
							.slice(0, 3000),
				);
			} catch {
				// File doesn't exist or can't be read
			}
		}
		diff = parts.join("\n");
	}

	// Truncate long diffs to stay within model context limits
	if (diff.length > 12_000) {
		diff =
			diff.slice(0, 12_000) +
			`\n... (diff truncated, ${diff.length} chars total)`;
	}

	return diff;
}

/**
 * Build the review prompt.
 * @param {string} diff — redacted diff content
 * @returns {string}
 */
function buildPrompt(diff) {
	return `Review this code diff from ${PROJECT_NAME}.

Project context:
${PROJECT_CONTEXT}

Diff:
${diff}

Report findings as JSON:
[{ "severity": "critical|high|medium|low", "file": "path", "line": N, "finding": "description", "suggestion": "fix" }]

Only report genuine issues. Do not flag style preferences covered by Biome.
If no issues found, return an empty array: []`;
}

/**
 * Parse findings from a model response.
 * @param {string} content — raw model response text
 * @param {string} model — model name for attribution
 * @returns {Array<object>}
 */
function parseFindings(content, model) {
	try {
		const match = content.match(/\[[\s\S]*\]/);
		if (!match) return [];
		const parsed = JSON.parse(match[0]);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((f) => ({ ...f, model }));
	} catch {
		return [];
	}
}

/**
 * Merge and deduplicate findings from multiple models.
 * Rules:
 * 1. Deduplicate by file + line (within 5-line window) + similar finding text
 * 2. 2+ models flag same issue -> severity elevated one level
 * 3. 1 model flags -> kept at original severity
 * 4. Results sorted by severity descending (critical first)
 */
function mergeFindings(allFindings) {
	const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
	const SEVERITY_NAMES = ["critical", "high", "medium", "low"];
	const seen = new Map();
	const merged = [];

	for (const finding of allFindings) {
		// Normalize key: file + approximate line (5-line bucket) + first 50 chars
		const lineGroup = Math.round((finding.line ?? 0) / 5) * 5;
		const textKey = (finding.finding ?? "").slice(0, 50).toLowerCase();
		const key = `${finding.file ?? ""}:${lineGroup}:${textKey}`;

		if (seen.has(key)) {
			const existing = seen.get(key);
			existing.modelCount += 1;
			existing.models.push(finding.model);
			// Elevate severity if 2+ models agree
			if (existing.modelCount >= 2) {
				const currentIdx = SEVERITY_ORDER[existing.severity] ?? 3;
				if (currentIdx > 0) {
					existing.severity = SEVERITY_NAMES[currentIdx - 1];
				}
			}
		} else {
			const entry = {
				severity: finding.severity ?? "low",
				file: finding.file ?? "",
				line: finding.line ?? 0,
				finding: finding.finding ?? "",
				suggestion: finding.suggestion ?? "",
				modelCount: 1,
				models: [finding.model],
			};
			seen.set(key, entry);
			merged.push(entry);
		}
	}

	// Sort by severity (critical first)
	merged.sort(
		(a, b) =>
			(SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
	);

	return merged;
}

/**
 * Remove all pending markers for review-code in this session.
 */
function cleanupPending() {
	const resultsDir = join(sessionDir, "results");
	try {
		for (const f of readdirSync(resultsDir)) {
			if (f.startsWith("review-code-") && f.endsWith(".pending")) {
				try {
					unlinkSync(join(resultsDir, f));
				} catch {
					/* best effort */
				}
			}
		}
	} catch {
		/* no results dir */
	}
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
	try {
		// 1. Read accumulated edits
		const edits = readEdits(sessionDir);
		if (edits.length === 0) {
			cleanupPending();
			process.exit(0);
		}

		// 2. Compute diff for all edited files
		const files = edits.map((e) => e.file);
		const diff = computeDiff(files);
		if (!diff.trim()) {
			cleanupPending();
			process.exit(0);
		}

		// 3. Build prompt with redacted diff
		const prompt = buildPrompt(redact(diff));

		// 4. Call 3 models in parallel (prompt already redacted)
		const responses = await callParallel(MODELS, prompt, {
			timeoutMs: 30_000,
			maxTokens: 4096,
			skipRedaction: true,
		});

		// 5. Parse findings from each model
		const allFindings = responses.flatMap((r) =>
			parseFindings(r.content, r.model),
		);

		// 6. Merge and deduplicate
		const merged = mergeFindings(allFindings);

		// 7. Format human-readable output
		const output =
			merged.length > 0
				? `**Code Review** (${merged.length} finding${merged.length === 1 ? "" : "s"} from ${MODELS.length}-model ensemble)\n\n` +
					merged
						.map(
							(f) =>
								`- **${f.severity.toUpperCase()}** \`${f.file}:${f.line}\`: ${f.finding}` +
								(f.suggestion ? `\n  Fix: ${f.suggestion}` : "") +
								` _(${f.models.join(", ")})_`,
						)
						.join("\n")
				: "[Code Review] No issues found by triple-model ensemble.";

		// 8. Write result to session state for injection on next event
		const resultFile = join(
			sessionDir,
			"results",
			`review-code-${Date.now()}.json`,
		);
		atomicWrite(
			resultFile,
			JSON.stringify({
				output,
				findings: merged,
				filesReviewed: [...new Set(files)],
				models: MODELS,
				timestamp: new Date().toISOString(),
				originEventTimestamp:
					edits[edits.length - 1]?.timestamp ?? Date.now(),
			}),
		);

		// 9. Clear edits (they've been reviewed)
		clearEdits(sessionDir);
	} finally {
		// Always clean up pending marker, even on error
		cleanupPending();
	}
}

main().catch((err) => {
	console.error(`[review-code] Fatal: ${err.message}`);
	cleanupPending();
	process.exit(1);
});
