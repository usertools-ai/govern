// capability-controllers/scaffold.mjs
// Context-aware scaffolding controller.
// Triggered on PreToolUse Write matching scaffold patterns.
// Reads existing files in the target directory and generates pattern-aware
// guidance via Opus. Returns context for injection before file creation.

import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { callProxy, extractContent } from "./proxy-client.mjs";
import { isExcluded, redact } from "./redact.mjs";

const PROJECT_NAME = process.env.USERTRUST_PROJECT_NAME ?? "this project";

const MODEL = "claude-opus-4-6";

/**
 * Scaffold type configurations.
 * Each defines the directory to read patterns from and type-specific prompt context.
 */
const SCAFFOLD_CONFIGS = {
	route: {
		context:
			process.env.USERTRUST_SCAFFOLD_ROUTE_CONTEXT ??
			"This is a route handler file.\n\nFollow the existing patterns in the directory for imports, exports, and structure.",
		glob: "*.ts",
	},
	test: {
		context:
			process.env.USERTRUST_SCAFFOLD_TEST_CONTEXT ??
			"This is a test file.\n\nFollow the existing patterns in the directory for test structure, imports, and assertions.",
		glob: "*.test.ts",
	},
	provider: {
		context:
			process.env.USERTRUST_SCAFFOLD_PROVIDER_CONTEXT ??
			"This is a provider adapter file.\n\nFollow the existing patterns in the directory.",
		glob: "*.ts",
	},
};

/**
 * Read existing files in the target directory for pattern reference.
 * Returns up to 3 files, each truncated to ~2000 chars.
 *
 * @param {string} dir — directory to read from
 * @param {string} glob — file extension filter (e.g., "*.ts")
 * @returns {Array<{ name: string, content: string }>}
 */
function readExistingPatterns(dir, glob) {
	const ext = glob.replace("*", "");
	try {
		const files = readdirSync(dir)
			.filter((f) => f.endsWith(ext) && !isExcluded(join(dir, f)))
			.slice(0, 3);

		return files.map((f) => {
			try {
				const content = readFileSync(join(dir, f), "utf8");
				return {
					name: f,
					content: content.slice(0, 2000) + (content.length > 2000 ? "\n... (truncated)" : ""),
				};
			} catch {
				return { name: f, content: "(unreadable)" };
			}
		});
	} catch {
		return [];
	}
}

/**
 * Generate context-aware scaffolding guidance for a new file.
 *
 * @param {string} filePath — absolute path of the file being created
 * @param {string} scaffoldType — one of: 'route', 'test', 'provider'
 * @returns {Promise<string|null>} scaffolding guidance for injection, or null on failure
 */
export async function generateScaffold(filePath, scaffoldType) {
	const config = SCAFFOLD_CONFIGS[scaffoldType];
	if (!config) return null;

	const dir = dirname(filePath);
	const fileName = basename(filePath);

	// Read existing files for pattern reference
	const existingFiles = readExistingPatterns(dir, config.glob);

	const existingContext =
		existingFiles.length > 0
			? existingFiles.map((f) => `--- ${f.name} ---\n${f.content}`).join("\n\n")
			: "(no existing files in this directory)";

	const prompt = `You are generating scaffolding guidance for a new file in ${PROJECT_NAME}.

${config.context}

New file being created: ${fileName}
Directory: ${dir}

Existing files in this directory (for pattern reference):
${redact(existingContext)}

Based on the existing patterns and conventions above, provide:
1. The imports this file will likely need
2. The export structure (interface, function signature)
3. Key patterns to follow from the existing files
4. Any gotchas specific to this file type

Format as concise guidance that helps write this file correctly on the first try.
Do NOT write the full file — provide guidance only. Keep under 200 words.`;

	const response = await callProxy(MODEL, prompt, {
		timeoutMs: 20_000,
		maxTokens: 1024,
		skipRedaction: true, // Already redacted in prompt
	});

	const guidance = extractContent(response);
	if (!guidance) return null;

	return `**Scaffold Guidance** (${scaffoldType}: \`${fileName}\`)\n\n${guidance}`;
}
