// capability-controllers/gate-quality.mjs
// Quality gate: deterministic checks (tsc + biome) + dual-model ensemble vote.
// Consumes pending async review results before voting.

import { execSync } from "node:child_process";
import { callParallel } from "./proxy-client.mjs";
import { redact } from "./redact.mjs";
import { consumeResults, isPending, readState } from "./state.mjs";

const PROJECT_NAME = process.env.USERTRUST_PROJECT_NAME ?? "this project";
const PROJECT_CONTEXT = process.env.USERTRUST_PROJECT_CONTEXT ?? "";

const MODELS = ["gpt-5.4", "o3"];

/**
 * Run deterministic checks (tsc + biome). Returns { passed, output }.
 */
function runDeterministicChecks() {
	const results = [];
	let allPassed = true;

	// TypeScript
	try {
		const tsc = execSync("npx tsc --noEmit 2>&1", {
			timeout: 15_000,
			encoding: "utf8",
		});
		results.push(`TypeScript: PASS\n${tsc}`);
	} catch (err) {
		allPassed = false;
		results.push(`TypeScript: FAIL\n${err.stdout ?? err.message}`);
	}

	// Biome
	try {
		const biome = execSync("npx biome check . 2>&1", {
			timeout: 10_000,
			encoding: "utf8",
		});
		results.push(`Biome: PASS\n${biome}`);
	} catch (err) {
		allPassed = false;
		results.push(`Biome: FAIL\n${err.stdout ?? err.message}`);
	}

	return { passed: allPassed, output: results.join("\n---\n") };
}

/**
 * Get recent diff content for model context.
 * Returns full patch (not just stat) so models can review actual code changes.
 * Truncated to ~8000 chars to stay within model context limits.
 */
function getDiffContent() {
	try {
		const diff = execSync(
			"git diff --cached 2>/dev/null || git diff 2>/dev/null",
			{ timeout: 5_000, encoding: "utf8" },
		);
		// Truncate long diffs — models don't need 50KB patches
		if (diff.length > 8000) {
			return diff.slice(0, 8000) + "\n... (diff truncated, " + diff.length + " chars total)";
		}
		return diff || "(no changes detected)";
	} catch {
		return "(diff unavailable)";
	}
}

/**
 * Run the quality gate.
 * @param {string} sessionDir — session state directory
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
export async function runGate(sessionDir) {
	// 1. Consume any completed async review results
	const state = readState(sessionDir);
	const priorReviews = consumeResults(sessionDir, state.lastClearTimestamp);
	let priorFindings = "";
	if (priorReviews.length > 0) {
		priorFindings = priorReviews
			.map((r) => JSON.stringify(r.content.findings ?? r.content, null, 2))
			.join("\n");
		priorFindings = `\nPrior review findings (from continuous code review):\n${priorFindings}\n`;
	}

	// 2. Wait briefly for in-flight review if pending
	if (isPending(sessionDir, "review-code")) {
		console.error("[gate-quality] Review in-flight — waiting up to 3s...");
		await new Promise((resolve) => setTimeout(resolve, 3_000));
		const lateResults = consumeResults(sessionDir, state.lastClearTimestamp);
		if (lateResults.length > 0) {
			priorFindings +=
				"\n" +
				lateResults.map((r) => JSON.stringify(r.content.findings ?? r.content, null, 2)).join("\n");
		}
	}

	// 3. Run deterministic checks
	const checks = runDeterministicChecks();
	if (!checks.passed) {
		return {
			pass: false,
			reason: `Deterministic checks failed:\n${checks.output}`,
		};
	}

	// 4. Dual-model vote
	const diffContent = getDiffContent();
	const prompt = `You are a quality gate for a commit in ${PROJECT_NAME}.

Check results:
${redact(checks.output)}

Diff:
${redact(diffContent)}
${priorFindings ? redact(priorFindings) : ""}

Should this commit proceed? Consider:
1. Do the checks pass?
2. Are there obvious issues the checks missed?
3. Does the diff violate any architectural invariants?${PROJECT_CONTEXT ? `\n\nProject context:\n${PROJECT_CONTEXT}` : ""}

Respond with JSON only: { "vote": "pass" | "block", "reason": "explanation" }`;

	// Prompt is already redacted above — skip proxy-level redaction to avoid double-sanitizing
	const responses = await callParallel(MODELS, prompt, { timeoutMs: 25_000, maxTokens: 512, skipRedaction: true });

	// Parse votes
	const votes = responses.map((r) => {
		try {
			const match = r.content.match(/\{[\s\S]*\}/);
			if (!match) return { model: r.model, vote: "error", reason: "No JSON in response" };
			const parsed = JSON.parse(match[0]);
			return { model: r.model, vote: parsed.vote, reason: parsed.reason };
		} catch {
			return { model: r.model, vote: "error", reason: "Parse failed" };
		}
	});

	// Decision matrix
	const allPass = votes.every((v) => v.vote === "pass");
	const anyBlock = votes.some((v) => v.vote === "block");
	const allError = votes.every((v) => v.vote === "error");

	if (allError) {
		// Both model calls failed — degrade to advisory (deterministic checks already passed)
		return {
			pass: true,
			reason:
				"Model-based review skipped due to proxy error. Deterministic checks passed.\n" +
				votes.map((v) => `${v.model}: ${v.reason}`).join("\n"),
		};
	}

	if (allPass) {
		return { pass: true, reason: votes.map((v) => `${v.model}: ${v.reason}`).join("\n") };
	}

	if (anyBlock) {
		return {
			pass: false,
			reason:
				"Model-based quality gate blocked this commit:\n" +
				votes.map((v) => `${v.model} [${v.vote}]: ${v.reason}`).join("\n"),
		};
	}

	// Fallback: pass (shouldn't reach here)
	return { pass: true, reason: "Gate passed (fallback)" };
}
