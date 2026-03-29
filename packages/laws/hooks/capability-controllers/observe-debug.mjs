// capability-controllers/observe-debug.mjs
// Dual-model root cause analysis controller.
// Triggered on non-zero Bash exit codes (PostToolUse).
// Exports analyzeFailure() — called synchronously by the dispatcher.

import { callParallel } from "./proxy-client.mjs";
import { redact } from "./redact.mjs";

const PROJECT_NAME = process.env.USERTRUST_PROJECT_NAME ?? "this project";
const PROJECT_CONTEXT =
	process.env.USERTRUST_PROJECT_CONTEXT ?? "TypeScript project with strict mode enabled.";

const MODELS = ["o3", "claude-opus-4-6"];

/**
 * Build the debug prompt.
 * @param {string} command — failed command
 * @param {number} exitCode — non-zero exit code
 * @param {string} output — command output (truncated to last 100 lines)
 * @param {string[]} recentFiles — recently edited files this session
 * @returns {string}
 */
function buildPrompt(command, exitCode, output, recentFiles) {
	// Truncate output to last 100 lines
	const lines = output.split("\n");
	const truncated =
		lines.length > 100
			? `... (${lines.length - 100} lines omitted)\n${lines.slice(-100).join("\n")}`
			: output;

	const filesList = recentFiles.length > 0 ? recentFiles.join("\n") : "(none)";

	return `A command failed in ${PROJECT_NAME}.

Command: ${command}
Exit code: ${exitCode}
Output (last 100 lines):
${truncated}

Recent file edits this session:
${filesList}

Project stack: ${PROJECT_CONTEXT}

Analyze the root cause. Consider:
1. Is this a type error, runtime error, test failure, or build error?
2. What specific code change likely caused it?
3. What is the minimal fix?

Respond with JSON only:
{ "rootCause": "explanation", "likelyFile": "path", "suggestedFix": "description", "confidence": "high|medium|low" }`;
}

/**
 * Parse a debug analysis from a model response.
 * @param {string} content — raw model response
 * @param {string} model — model name
 * @returns {object|null}
 */
function parseAnalysis(content, model) {
	try {
		const match = content.match(/\{[\s\S]*\}/);
		if (!match) return null;
		const parsed = JSON.parse(match[0]);
		return {
			rootCause: parsed.rootCause ?? "Unknown",
			likelyFile: parsed.likelyFile ?? "",
			suggestedFix: parsed.suggestedFix ?? "",
			confidence: parsed.confidence ?? "low",
			model,
		};
	} catch {
		return null;
	}
}

/**
 * Merge analyses from two models.
 * Rule: agree on root cause = elevated confidence, disagree = present both.
 * @param {Array<object|null>} analyses
 * @returns {string} formatted output for injection
 */
function mergeAnalyses(analyses) {
	const valid = analyses.filter(Boolean);
	if (valid.length === 0) return null;
	if (valid.length === 1) {
		const a = valid[0];
		return formatSingle(a);
	}

	// Check if they agree on root cause (fuzzy: first 80 chars lowercase)
	const [a, b] = valid;
	const causeA = (a.rootCause ?? "").slice(0, 80).toLowerCase();
	const causeB = (b.rootCause ?? "").slice(0, 80).toLowerCase();

	// Simple similarity: >50% character overlap = agreement
	const overlap = [...causeA].filter((c) => causeB.includes(c)).length;
	const agree = overlap / Math.max(causeA.length, causeB.length, 1) > 0.5;

	if (agree) {
		// Elevate confidence
		const confidence = a.confidence === "high" || b.confidence === "high" ? "high" : "medium"; // Agreement elevates to at least medium
		return `**Root Cause Analysis** (${MODELS.join(" + ")} — AGREE, confidence: ${confidence})\n\n**Root cause:** ${a.rootCause}\n${a.likelyFile ? `**Likely file:** \`${a.likelyFile}\`\n` : ""}**Suggested fix:** ${a.suggestedFix}${
			b.suggestedFix && b.suggestedFix !== a.suggestedFix
				? `\n**Additional suggestion (${b.model}):** ${b.suggestedFix}`
				: ""
		}`;
	}

	// Disagree — present both
	return `**Root Cause Analysis** (${MODELS.join(" + ")} — DISAGREE, review both)\n\n${valid.map((a) => formatSingle(a)).join("\n\n---\n\n")}`;
}

/**
 * Format a single analysis for display.
 */
function formatSingle(a) {
	return `**${a.model}** (confidence: ${a.confidence})\n**Root cause:** ${a.rootCause}\n${a.likelyFile ? `**Likely file:** \`${a.likelyFile}\`\n` : ""}**Suggested fix:** ${a.suggestedFix}`;
}

/**
 * Analyze a command failure with dual-model root cause analysis.
 *
 * @param {string} command — the failed bash command
 * @param {number} exitCode — non-zero exit code
 * @param {string} commandOutput — stdout/stderr from the command
 * @param {object[]} recentEdits — array of { file, timestamp, tool } from session edits
 * @returns {Promise<string|null>} formatted analysis for injection, or null on failure
 */
export async function analyzeFailure(command, exitCode, commandOutput, recentEdits) {
	// Don't analyze trivial failures (e.g., grep no match, test --list)
	if (!command || !commandOutput) return null;

	const editsArray = Array.isArray(recentEdits) ? recentEdits : [];
	const recentFiles = [...new Set(editsArray.map((e) => e?.file).filter(Boolean))];
	const prompt = buildPrompt(command, exitCode, commandOutput, recentFiles);
	const safePrompt = redact(prompt);

	// Call both models in parallel (prompt already redacted)
	const responses = await callParallel(MODELS, safePrompt, {
		timeoutMs: 25_000,
		maxTokens: 1024,
		skipRedaction: true,
	});

	// Parse analyses
	const analyses = responses.map((r) => parseAnalysis(r.content, r.model));

	return mergeAnalyses(analyses);
}
