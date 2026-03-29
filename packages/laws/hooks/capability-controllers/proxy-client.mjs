// capability-controllers/proxy-client.mjs
// Shared proxy call helper — wraps fetch with timeout, error handling, and redaction.

import { redact } from "./redact.mjs";

const PROXY_URL = process.env.USERTRUST_PROXY_URL
	?? "https://proxy.usertools.ai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Call the Usertools proxy with a model and prompt.
 * Redacts the prompt before sending. Returns parsed JSON response or null on failure.
 *
 * @param {string} model — API model string (e.g., "gpt-5.4", "o3")
 * @param {string} prompt — raw prompt text (will be redacted)
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] — request timeout (default 25s)
 * @param {number} [opts.maxTokens] — max response tokens (default 4096)
 * @param {boolean} [opts.skipRedaction] — skip redaction (use sparingly — most callers should redact)
 * @returns {Promise<object|null>} parsed response or null on error
 */
export async function callProxy(model, prompt, opts = {}) {
	const apiKey = process.env.USERTRUST_API_KEY ?? process.env.USERTOOLS_API_KEY;
	if (!apiKey) {
		console.error("[usertrust-laws] USERTRUST_API_KEY not set");
		return null;
	}

	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
	const safePrompt = opts.skipRedaction ? prompt : redact(prompt);

	try {
		const response = await fetch(PROXY_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify({
				model,
				messages: [{ role: "user", content: safePrompt }],
				max_tokens: maxTokens,
				stream: false,
			}),
			signal: AbortSignal.timeout(timeoutMs),
		});

		if (!response.ok) {
			console.error(`[usertrust-laws] proxy ${response.status}: ${model}`);
			return null;
		}

		const data = await response.json();
		return data;
	} catch (err) {
		console.error(`[usertrust-laws] proxy error (${model}): ${err.message}`);
		return null;
	}
}

/**
 * Extract the text content from a proxy response.
 * Handles both string content and array-of-parts content formats.
 * @param {object|null} response — proxy response from callProxy
 * @returns {string} extracted text or empty string
 */
export function extractContent(response) {
	if (!response) return "";
	const choice = response.choices?.[0];
	const raw = choice?.message?.content ?? choice?.delta?.content ?? "";
	// Some APIs return content as an array of parts
	if (Array.isArray(raw)) {
		return raw
			.filter((p) => p.type === "text" || typeof p === "string")
			.map((p) => (typeof p === "string" ? p : p.text ?? ""))
			.join("");
	}
	return typeof raw === "string" ? raw : String(raw);
}

/**
 * Call multiple models in parallel with the same prompt.
 * Returns an array of { model, content, raw } objects.
 *
 * @param {string[]} models
 * @param {string} prompt
 * @param {object} [opts] — passed to callProxy
 * @returns {Promise<Array<{ model: string, content: string, raw: object|null }>>}
 */
export async function callParallel(models, prompt, opts = {}) {
	const results = await Promise.all(
		models.map(async (model) => {
			const raw = await callProxy(model, prompt, opts);
			return { model, content: extractContent(raw), raw };
		}),
	);
	return results;
}
