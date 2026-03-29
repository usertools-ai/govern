// capability-controllers/state.mjs
// Atomic session state operations with flock-based concurrency control.

import { createHash } from "node:crypto";
import {
	appendFileSync,
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

const STATE_ROOT = process.env.USERTRUST_STATE_DIR
	?? ".usertrust/.capability-state";

/**
 * Derive session directory path from session_id.
 * @param {string} sessionId — raw session_id from hook stdin
 * @returns {string} absolute path to session state directory
 */
export function sessionDir(sessionId) {
	const hash = createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
	const dir = join(process.cwd(), STATE_ROOT, hash);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const resultsDir = join(dir, "results");
	if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
	return dir;
}

/**
 * Atomically write a file using tmp + fsync + rename.
 * Node 22+ supports { flush: true } which calls fsync before close.
 * @param {string} filePath — target file path
 * @param {string} content — file content
 */
export function atomicWrite(filePath, content) {
	const tmp = `${filePath}.tmp`;
	writeFileSync(tmp, content, { flush: true });
	renameSync(tmp, filePath);
}

// NOTE: Locking deferred to Phase 2. State operations are best-effort and
// tolerate races — hooks are short-lived and concurrent writes to edits.jsonl
// use appendFileSync (atomic for single-line appends on POSIX). The atomicWrite
// function uses tmp+rename which prevents partial reads.

/**
 * Read and parse state.json from session directory.
 * Returns default state if file doesn't exist or is corrupt.
 * @param {string} dir — session directory
 * @returns {object} state object
 */
export function readState(dir) {
	const path = join(dir, "state.json");
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return { editCount: 0, lastReviewTimestamp: 0, dedup: {}, lastClearTimestamp: 0 };
	}
}

/**
 * Atomically write state.json.
 * @param {string} dir — session directory
 * @param {object} state — state object to persist
 */
export function writeState(dir, state) {
	atomicWrite(join(dir, "state.json"), JSON.stringify(state));
}

/**
 * Append an edit record to edits.jsonl.
 * @param {string} dir — session directory
 * @param {object} edit — { file, timestamp, tool }
 */
export function appendEdit(dir, edit) {
	const filePath = join(dir, "edits.jsonl");
	const line = JSON.stringify(edit) + "\n";
	// appendFileSync is atomic enough for single-line appends on POSIX
	appendFileSync(filePath, line);
}

/**
 * Read all edits from edits.jsonl.
 * @param {string} dir — session directory
 * @returns {object[]} array of edit records
 */
export function readEdits(dir) {
	const path = join(dir, "edits.jsonl");
	try {
		return readFileSync(path, "utf8")
			.split("\n")
			.filter(Boolean)
			.flatMap((line) => {
				try { return [JSON.parse(line)]; }
				catch { return []; }
			});
	} catch {
		return [];
	}
}

/**
 * Clear edits.jsonl (after dispatching a review).
 * @param {string} dir — session directory
 */
export function clearEdits(dir) {
	atomicWrite(join(dir, "edits.jsonl"), "");
}

/**
 * Check if an async job is in-flight (pending marker exists).
 * @param {string} dir — session directory
 * @param {string} capability — capability name (e.g., "review-code")
 * @returns {boolean}
 */
export function isPending(dir, capability) {
	const resultsDir = join(dir, "results");
	try {
		const files = readdirSync(resultsDir);
		return files.some((f) => f.startsWith(`${capability}-`) && f.endsWith(".pending"));
	} catch {
		return false;
	}
}

/**
 * Write a pending marker for an async job. Includes PID for cancellation.
 * @param {string} dir — session directory
 * @param {string} capability — capability name
 * @param {number} pid — process ID of the detached child
 */
export function writePending(dir, capability, pid) {
	const ts = Date.now();
	atomicWrite(join(dir, "results", `${capability}-${ts}.pending`), String(pid));
}

/**
 * Consume completed async results. Reads .json files, renames to .consumed.
 * Rejects results older than lastClearTimestamp.
 * @param {string} dir — session directory
 * @param {number} lastClearTimestamp — reject results older than this
 * @returns {Array<{ capability: string, content: object }>}
 */
export function consumeResults(dir, lastClearTimestamp = 0) {
	const resultsDir = join(dir, "results");
	const consumed = [];
	try {
		const files = readdirSync(resultsDir).filter((f) => f.endsWith(".json"));
		for (const file of files) {
			const filePath = join(resultsDir, file);
			try {
				const raw = JSON.parse(readFileSync(filePath, "utf8"));
				// Reject stale results
				if (raw.originEventTimestamp && raw.originEventTimestamp < lastClearTimestamp) {
					renameSync(filePath, filePath.replace(".json", ".stale"));
					continue;
				}
				consumed.push({
					capability: file.replace(/-\d+\.json$/, ""),
					content: raw,
				});
				renameSync(filePath, filePath.replace(".json", ".consumed"));
			} catch {
				// Corrupt result — skip
			}
		}
	} catch {
		// No results dir
	}
	return consumed;
}

/**
 * Count in-flight async jobs (pending markers).
 * @param {string} dir — session directory
 * @returns {number}
 */
export function countInFlight(dir) {
	const resultsDir = join(dir, "results");
	try {
		return readdirSync(resultsDir).filter((f) => f.endsWith(".pending")).length;
	} catch {
		return 0;
	}
}
