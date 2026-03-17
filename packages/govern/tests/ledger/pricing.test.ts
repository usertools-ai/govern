import { describe, it, expect } from "vitest";
import {
	estimateCost,
	estimateInputTokens,
	PRICING_TABLE,
	FALLBACK_RATE,
	getModelRates,
} from "../../src/ledger/pricing.js";

describe("PRICING_TABLE", () => {
	it("contains 20 models", () => {
		expect(Object.keys(PRICING_TABLE)).toHaveLength(20);
	});

	it("all rates are positive", () => {
		for (const [model, rates] of Object.entries(PRICING_TABLE)) {
			expect(rates.inputPer1k, `${model} inputPer1k`).toBeGreaterThan(0);
			expect(rates.outputPer1k, `${model} outputPer1k`).toBeGreaterThan(0);
		}
	});
});

describe("FALLBACK_RATE", () => {
	it("is sonnet-class pricing", () => {
		expect(FALLBACK_RATE.inputPer1k).toBe(30);
		expect(FALLBACK_RATE.outputPer1k).toBe(150);
	});
});

describe("getModelRates", () => {
	it("returns exact match for known models", () => {
		const rates = getModelRates("claude-sonnet-4-6");
		expect(rates.inputPer1k).toBe(30);
		expect(rates.outputPer1k).toBe(150);
	});

	it("returns prefix match for versioned model strings", () => {
		// "claude-haiku-4-5-20251001" should match "claude-haiku-4-5"
		const rates = getModelRates("claude-haiku-4-5-20251001");
		expect(rates.inputPer1k).toBe(10);
		expect(rates.outputPer1k).toBe(50);
	});

	it("returns FALLBACK_RATE for unknown model", () => {
		const rates = getModelRates("totally-unknown-model-xyz");
		expect(rates).toEqual(FALLBACK_RATE);
	});
});

describe("estimateCost", () => {
	it("returns correct cost for claude-sonnet-4-6", () => {
		// 1000 input tokens * 30/1k + 500 output tokens * 150/1k = 30 + 75 = 105
		const cost = estimateCost("claude-sonnet-4-6", 1000, 500);
		expect(cost).toBe(105);
	});

	it("returns correct cost for gpt-4o-mini", () => {
		// 1000 input * 1.5/1k + 1000 output * 6/1k = 1.5 + 6 = 7.5 → ceil → 8
		const cost = estimateCost("gpt-4o-mini", 1000, 1000);
		expect(cost).toBe(8);
	});

	it("returns correct cost for deepseek-chat", () => {
		// 2000 input * 2.8/1k + 1000 output * 4.2/1k = 5.6 + 4.2 = 9.8 → ceil → 10
		const cost = estimateCost("deepseek-chat", 2000, 1000);
		expect(cost).toBe(10);
	});

	it("floors to 1 for very small requests", () => {
		const cost = estimateCost("gpt-4o-mini", 1, 0);
		expect(cost).toBe(1);
	});

	it("uses fallback rate for unknown model", () => {
		// fallback: 30 input, 150 output
		// 1000 input * 30/1k + 1000 output * 150/1k = 30 + 150 = 180
		const cost = estimateCost("unknown-model", 1000, 1000);
		expect(cost).toBe(180);
	});

	it("returns integer (ceiling)", () => {
		const cost = estimateCost("claude-sonnet-4-6", 100, 100);
		expect(Number.isInteger(cost)).toBe(true);
	});
});

describe("estimateInputTokens", () => {
	it("estimates ~4 chars/token with 1.5x safety margin", () => {
		const messages = [
			{ role: "user", content: "Hello world!" }, // 12 chars content + 16 overhead = 28 chars
		];
		// textChars = 12 + 16 = 28 → ceil(28/4) = 7 textTokens → raw = 7 → ceil(7 * 1.5) = 11
		const tokens = estimateInputTokens(messages);
		expect(tokens).toBe(11);
	});

	it("handles empty messages array", () => {
		const tokens = estimateInputTokens([]);
		expect(tokens).toBe(1); // floor of 1
	});

	it("handles array content blocks", () => {
		const messages = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Hello world!" },
				],
			},
		];
		// textChars = 12 (text) + 16 (overhead) = 28 → ceil(28/4) = 7 → raw = 7 → ceil(7*1.5) = 11
		const tokens = estimateInputTokens(messages);
		expect(tokens).toBe(11);
	});

	it("handles tool_call_id overhead", () => {
		const messages = [
			{ role: "tool", tool_call_id: "call_123", content: "result" },
		];
		// textChars = 6 (content) + 16 (overhead) = 22 → ceil(22/4) = 6 textTokens
		// blockTokens = 10 (tool_call_id) → raw = 16 → ceil(16*1.5) = 24
		const tokens = estimateInputTokens(messages);
		expect(tokens).toBe(24);
	});

	it("handles multi-message conversation", () => {
		const messages = [
			{ role: "system", content: "You are helpful." },
			{ role: "user", content: "What is 2+2?" },
			{ role: "assistant", content: "4" },
		];
		// Message 1: 16 + 16 = 32 chars
		// Message 2: 12 + 16 = 28 chars
		// Message 3: 1 + 16 = 17 chars
		// Total textChars = 77 → ceil(77/4) = 20 → raw = 20 → ceil(20*1.5) = 30
		const tokens = estimateInputTokens(messages);
		expect(tokens).toBe(30);
	});

	it("safety margin ensures estimate exceeds likely actual", () => {
		const longText = "a".repeat(4000); // ~1000 tokens of actual content
		const messages = [{ role: "user", content: longText }];
		const tokens = estimateInputTokens(messages);
		// Raw tokens ≈ (4000 + 16) / 4 = 1004 → with 1.5x ≈ 1506
		expect(tokens).toBeGreaterThan(1000);
		expect(tokens).toBeLessThan(2000);
	});
});
