// capability-controllers/redact.mjs
// Strips secrets, tokens, connection strings, and env vars from text
// before sending to external models via the proxy.

/**
 * Redact sensitive patterns from text.
 * @param {string} text - raw text (diffs, command output, query results)
 * @returns {string} redacted text safe to send to external models
 */
export function redact(text) {
	if (typeof text !== "string") return "";
	return text
		.replace(/\b(ut-proxy-|sk-|pk_test_|pk_live_)[a-zA-Z0-9_-]{10,}/g, "[REDACTED_KEY]")
		.replace(/\b(Bearer\s+)[a-zA-Z0-9._-]{20,}/g, "$1[REDACTED_TOKEN]")
		.replace(
			/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
			"[REDACTED_JWT]",
		)
		.replace(/(ws|postgres|redis|mongodb|mysql):\/\/[^\s'"]+/g, "[REDACTED_CONN]")
		.replace(/^export\s+\w+=.*/gm, "[REDACTED_ENV]")
		.replace(/password['":\s]*=?\s*['"]?[^\s'"]{8,}/gi, "password=[REDACTED]");
}

/**
 * File exclusion patterns — files matching these should never be
 * sent to models (lockfiles, binaries, secrets, generated code).
 */
export const EXCLUDED_PATTERNS = [
	"*.lock",
	"*.lockb",
	"pnpm-lock.yaml",
	"*.snap",
	"__snapshots__/**",
	"node_modules/**",
	".pnpm/**",
	"*.min.js",
	"*.bundle.js",
	"*.png",
	"*.jpg",
	"*.gif",
	"*.ico",
	".env*",
	"*credentials*",
	"*secret*",
];

/**
 * Check if a file path matches any exclusion pattern.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isExcluded(filePath) {
	const basename = filePath.split("/").pop() ?? "";
	for (const pattern of EXCLUDED_PATTERNS) {
		if (pattern.includes("**")) {
			// Directory glob: check if path contains the directory segment
			const dir = pattern.replace("/**", "");
			if (filePath.includes(`/${dir}/`) || filePath.startsWith(`${dir}/`)) return true;
		} else if (pattern.startsWith("*.")) {
			// Extension glob
			if (basename.endsWith(pattern.slice(1))) return true;
		} else if (pattern.startsWith("*") && pattern.endsWith("*") && pattern.length > 2) {
			// Substring glob (*foo*)
			const inner = pattern.slice(1, -1);
			if (basename.includes(inner)) return true;
		} else if (pattern.startsWith("*")) {
			// Suffix glob (*foo)
			if (basename.endsWith(pattern.slice(1))) return true;
		} else if (pattern.endsWith("*")) {
			// Prefix glob
			if (basename.startsWith(pattern.slice(0, -1))) return true;
		} else {
			// Exact match
			if (basename === pattern) return true;
		}
	}
	return false;
}
