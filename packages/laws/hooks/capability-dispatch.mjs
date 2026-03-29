#!/usr/bin/env node
// hooks/capability-dispatch.mjs
// Main dispatcher: receives all hook events, reads cache, routes to controllers.
// Usage: node capability-dispatch.mjs <eventType>
//   eventType: userPromptSubmit | preToolUse | postToolUse

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isExcluded } from "./capability-controllers/redact.mjs";
import { route } from "./capability-controllers/route.mjs";
import {
	appendEdit,
	clearEdits,
	consumeResults,
	countInFlight,
	isPending,
	readEdits,
	readState,
	sessionDir,
	writePending,
	writeState,
} from "./capability-controllers/state.mjs";

// Kill switch
if (process.env.CAPABILITY_DISPATCHER_DISABLED === "1") {
	process.exit(0);
}

const EVENT_TYPE = process.argv[2];
const CACHE_PATH =
	process.env.USERTRUST_CACHE_PATH ?? join(process.cwd(), ".usertrust", ".capability-cache.json");
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Read stdin as JSON.
 */
async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	const raw = Buffer.concat(chunks).toString("utf8").trim();
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

/**
 * Read the capability cache.
 */
function readCache() {
	try {
		return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
	} catch {
		return null;
	}
}

/**
 * Match a trigger pattern against tool input.
 * Pattern format: "ToolName:glob" or "Bash:command-substring"
 */
function matchTrigger(pattern, toolName, toolInput) {
	const [patternTool, patternValue] = pattern.split(":", 2);

	if (patternTool !== toolName) return false;
	if (!patternValue) return true; // ToolName-only match

	if (toolName === "Bash") {
		const command = toolInput?.command ?? "";
		// Handle special exit code pattern
		if (patternValue.startsWith("exit!=")) {
			const exitCode = toolInput?.exit_code;
			return exitCode !== undefined && exitCode !== 0;
		}
		// Word-boundary match to avoid false positives like "git committed"
		return new RegExp(`\\b${patternValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(command);
	}

	// File glob match for Write/Edit
	const filePath = toolInput?.file_path ?? "";
	if (isExcluded(filePath)) return false;

	// Glob to regex: escape metacharacters, then convert glob wildcards
	const globToRegex = patternValue
		.replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex metacharacters first
		.replace(/\*\*/g, "DOUBLESTAR")
		.replace(/\*/g, "[^/]*")
		.replace(/DOUBLESTAR/g, ".*");
	return new RegExp(`${globToRegex}$`).test(filePath);
}

/**
 * Find capabilities that match the current event.
 */
function findMatchingCapabilities(cache, eventType, toolName, toolInput) {
	const capabilities = cache?.capabilities ?? {};
	const matches = [];

	for (const [name, cap] of Object.entries(capabilities)) {
		if (cache.disabled?.includes(name)) continue;

		const triggers = cap.triggers?.[eventType] ?? [];

		// Router-activated capabilities with empty triggers are handled by the
		// LLM router in userPromptSubmit — include them so the router sees them
		if (triggers.length === 0) {
			if (cap.routerActivated && eventType === "userPromptSubmit") {
				matches.push({ name, ...cap });
			}
			continue;
		}

		for (const trigger of triggers) {
			if (matchTrigger(trigger, toolName, toolInput)) {
				matches.push({ name, ...cap });
				break;
			}
		}
	}

	// Sort by priority descending
	matches.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

	// Cap at maxPerEvent
	return matches.slice(0, cache.maxPerEvent ?? 3);
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
	const input = await readStdin();
	if (!input) process.exit(0);

	const cache = readCache();
	if (!cache) process.exit(0); // No cache = scanner hasn't run

	const sessionId = input.session_id ?? "unknown";
	const dir = sessionDir(sessionId);
	const state = readState(dir);
	const output = [];

	// Consume pending async results — but NOT during preToolUse.
	// If the gate blocks (exit 2), consumed results would be lost.
	// The gate controller consumes results itself before voting.
	if (EVENT_TYPE !== "preToolUse") {
		const asyncResults = consumeResults(dir, state.lastClearTimestamp);
		for (const result of asyncResults) {
			if (result.content?.output) {
				output.push(result.content.output);
			}
		}
	}

	const toolName = input.tool_name ?? "";
	const toolInput = input.tool_input ?? {};

	// ── UserPromptSubmit ──────────────────────────────────────────
	if (EVENT_TYPE === "userPromptSubmit") {
		const prompt = input.user_prompt ?? input.prompt ?? "";
		if (!prompt) {
			if (output.length > 0) process.stdout.write(output.join("\n\n---\n\n"));
			process.exit(0);
		}

		// Route through prefilter + LLM
		const { capabilities, briefs } = await route(prompt);

		if (capabilities.length > 0 && cache.debug) {
			console.error(`[usertrust-laws] Router activated: ${capabilities.join(", ")}`);
		}

		// enrich:search and enrich:memory are Phase 3
	}

	// ── PreToolUse ────────────────────────────────────────────────
	if (EVENT_TYPE === "preToolUse") {
		const matches = findMatchingCapabilities(cache, "preToolUse", toolName, toolInput);

		for (const cap of matches) {
			if (cap.mode === "block" && cap.name === "gate:quality") {
				// Dynamic import to keep dispatcher lightweight when gate isn't triggered
				const { runGate } = await import("./capability-controllers/gate-quality.mjs");
				const result = await runGate(dir);
				if (!result.pass) {
					process.stdout.write(result.reason);
					process.exit(2); // Block
				}
				if (result.reason) {
					output.push(`[Quality Gate] ${result.reason}`);
				}
			}
			if (cap.name.startsWith("scaffold:")) {
				try {
					const { generateScaffold } = await import("./capability-controllers/scaffold.mjs");
					const scaffoldType = cap.name.split(":")[1] ?? "route";
					const result = await generateScaffold(toolInput.file_path ?? "", scaffoldType);
					if (result) output.push(result);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					console.error(`[usertrust-laws] ${cap.name} error: ${message}`);
				}
			}
		}
	}

	// ── PostToolUse ───────────────────────────────────────────────
	if (EVENT_TYPE === "postToolUse") {
		// Track edits for review:code debouncing
		if ((toolName === "Write" || toolName === "Edit") && toolInput.file_path) {
			if (!isExcluded(toolInput.file_path)) {
				const edit = {
					file: toolInput.file_path,
					timestamp: Date.now(),
					tool: toolName,
				};
				// Append edit to session state via the shared helper
				try {
					appendEdit(dir, edit);
				} catch {
					// Best effort
				}

				// Check debounce thresholds and dispatch async review:code
				const reviewCap = cache.capabilities?.["review:code"];
				if (reviewCap) {
					const edits = readEdits(dir);
					const minEdits = reviewCap.minEdits ?? 3;
					const debounceMs = reviewCap.debounceMs ?? 5000;
					const now = Date.now();

					if (
						edits.length >= minEdits &&
						now - (state.lastReviewTimestamp ?? 0) >= debounceMs &&
						!isPending(dir, "review-code") &&
						countInFlight(dir) < 2
					) {
						// Spawn detached child process for async review
						// Resolve path relative to this file for portability
						const child = spawn(
							process.execPath,
							[join(__dirname, "capability-controllers", "review-code.mjs"), dir],
							{ detached: true, stdio: "ignore", cwd: process.cwd() },
						);
						writePending(dir, "review-code", child.pid);
						child.unref();

						// Update state with review timestamp
						state.lastReviewTimestamp = now;
						writeState(dir, state);

						if (cache.debug) {
							console.error(
								`[usertrust-laws] Dispatched async review:code (${edits.length} edits, PID ${child.pid})`,
							);
						}
					}
				}
			}
		}

		// Check for observe:debug trigger (non-zero exit code)
		if (toolName === "Bash") {
			const matches = findMatchingCapabilities(cache, "postToolUse", toolName, toolInput);
			const debugMatch = matches.find((m) => m.name === "observe:debug");
			if (debugMatch) {
				try {
					const { analyzeFailure } = await import("./capability-controllers/observe-debug.mjs");
					const edits = readEdits(dir);
					const result = await analyzeFailure(
						toolInput.command ?? "",
						toolInput.exit_code ?? 1,
						input.tool_output ?? "",
						edits,
					);
					if (result) output.push(result);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					console.error(`[usertrust-laws] observe:debug error: ${message}`);
				}
			} else if (matches.length > 0 && cache.debug) {
				console.error(
					`[usertrust-laws] PostToolUse matches: ${matches.map((m) => m.name).join(", ")}`,
				);
			}
		}
	}

	// Output accumulated results
	if (output.length > 0) {
		process.stdout.write(output.join("\n\n---\n\n"));
	}
	process.exit(0);
}

main().catch((err) => {
	console.error(`[usertrust-laws] Fatal: ${err.message}`);
	process.exit(0); // Fail-open
});
