// capability-controllers/route.mjs
// Deterministic keyword prefilter + Opus LLM router for capability activation.

import { callProxy, extractContent } from "./proxy-client.mjs";

const PROJECT_NAME = process.env.USERTRUST_PROJECT_NAME ?? "this project";
const PROJECT_DESC = process.env.USERTRUST_PROJECT_DESC ?? "A software project";

const SEARCH_SIGNALS =
	/\b(how does|what is|best practice|compare|alternative|competitor|latest|current)\b/i;
const MEMORY_SIGNALS =
	/\b(we discussed|last time|remember|previous|earlier|before)\b/i;

const ROUTER_MODEL = "claude-opus-4-6";

/**
 * Run deterministic prefilter against prompt text.
 * @param {string} prompt
 * @returns {string[]} candidate capability names
 */
export function prefilter(prompt) {
	const candidates = [];
	if (SEARCH_SIGNALS.test(prompt)) candidates.push("enrich:search");
	if (MEMORY_SIGNALS.test(prompt)) candidates.push("enrich:memory");
	return candidates;
}

/**
 * Invoke the LLM router to refine capability activation and generate briefs.
 * Only called when the prefilter found candidates.
 *
 * @param {string} prompt — user's prompt text
 * @param {string[]} candidates — prefilter results
 * @returns {Promise<{ capabilities: string[], briefs: Record<string, string> }>}
 */
export async function routeWithModel(prompt, candidates) {
	const candidateDescriptions = candidates
		.map((c) => {
			if (c === "enrich:search")
				return "- enrich:search — Live web research on external technologies, competitors, best practices.";
			if (c === "enrich:memory")
				return "- enrich:memory — Recall past session context from vector memory.";
			return "";
		})
		.filter(Boolean)
		.join("\n");

	const routerPrompt = `You are a capability router for a software development session on ${PROJECT_NAME}.

Project: ${PROJECT_DESC}

Given the user's message, decide which of these capabilities to activate. Only activate capabilities that would genuinely help with THIS specific message.

Available capabilities:
${candidateDescriptions}

User's message:
${prompt}

Respond with JSON only:
{
  "capabilities": ["enrich:search"],
  "briefs": {
    "enrich:search": "Research best practices for X"
  }
}

If no capabilities should activate, respond: { "capabilities": [], "briefs": {} }`;

	const response = await callProxy(ROUTER_MODEL, routerPrompt, {
		timeoutMs: 15_000,
		maxTokens: 512,
	});

	const content = extractContent(response);
	try {
		// Extract JSON from response (may have markdown fences)
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return { capabilities: [], briefs: {} };
		const parsed = JSON.parse(jsonMatch[0]);

		// Validate/sanitize — model output is untrusted input
		const allowed = new Set(candidates);
		const capabilities = Array.isArray(parsed.capabilities)
			? parsed.capabilities.filter((c) => typeof c === "string" && allowed.has(c))
			: [];
		const briefs = {};
		if (parsed.briefs && typeof parsed.briefs === "object") {
			for (const c of capabilities) {
				const v = parsed.briefs[c];
				if (typeof v === "string") briefs[c] = v.slice(0, 500);
			}
		}
		return { capabilities, briefs };
	} catch {
		// Parse failed — return empty
		return { capabilities: [], briefs: {} };
	}
}

/**
 * Full routing pipeline: prefilter → optional LLM refinement.
 * On LLM failure, falls back to prefilter results with generic briefs.
 *
 * @param {string} prompt
 * @returns {Promise<{ capabilities: string[], briefs: Record<string, string> }>}
 */
export async function route(prompt) {
	const candidates = prefilter(prompt);

	// No candidates → no enrichment needed
	if (candidates.length === 0) {
		return { capabilities: [], briefs: {} };
	}

	// Try LLM refinement
	const result = await routeWithModel(prompt, candidates);

	// If LLM returned valid results, use them
	if (result.capabilities && result.capabilities.length > 0) {
		return result;
	}

	// LLM returned empty or failed — fall back to prefilter with generic briefs
	const fallbackBriefs = {};
	for (const c of candidates) {
		fallbackBriefs[c] = `Activated by keyword match (LLM router unavailable)`;
	}
	return { capabilities: candidates, briefs: fallbackBriefs };
}
