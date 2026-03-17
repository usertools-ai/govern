/**
 * Policy Gate Tests
 *
 * Tests all 12 field operators, hard/soft enforcement, dot-notation
 * field resolution, glob scope matching, time-window constraints,
 * priority ordering, and default rules.
 */

import { describe, expect, it } from "vitest";
import {
	evaluatePolicy,
	isWithinTimeWindow,
	loadPolicies,
	matchesScope,
	type GateRule,
	type PolicyContext,
} from "../../src/policy/gate.js";
import { DEFAULT_RULES, isBudgetExceeded } from "../../src/policy/default-rules.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rule(overrides: Partial<GateRule> = {}): GateRule {
	return {
		name: "test-rule",
		effect: "deny",
		enforcement: "hard",
		conditions: [],
		priority: 10,
		enabled: true,
		...overrides,
	};
}

// ===========================================================================
// 12 Operators — each tested individually
// ===========================================================================

describe("operators", () => {
	describe("exists", () => {
		it("matches when field is present and non-null", () => {
			const r = rule({
				conditions: [{ field: "token", operator: "exists" }],
			});
			const result = evaluatePolicy([r], { token: "abc" });
			expect(result.matched).toHaveLength(1);
		});

		it("does not match when field is undefined", () => {
			const r = rule({
				conditions: [{ field: "token", operator: "exists" }],
			});
			const result = evaluatePolicy([r], {});
			expect(result.matched).toHaveLength(0);
		});

		it("does not match when field is null", () => {
			const r = rule({
				conditions: [{ field: "token", operator: "exists" }],
			});
			const result = evaluatePolicy([r], { token: null });
			expect(result.matched).toHaveLength(0);
		});
	});

	describe("not_exists", () => {
		it("matches when field is undefined", () => {
			const r = rule({
				conditions: [{ field: "token", operator: "not_exists" }],
			});
			const result = evaluatePolicy([r], {});
			expect(result.matched).toHaveLength(1);
		});

		it("matches when field is null", () => {
			const r = rule({
				conditions: [{ field: "token", operator: "not_exists" }],
			});
			const result = evaluatePolicy([r], { token: null });
			expect(result.matched).toHaveLength(1);
		});

		it("does not match when field is present", () => {
			const r = rule({
				conditions: [{ field: "token", operator: "not_exists" }],
			});
			const result = evaluatePolicy([r], { token: "abc" });
			expect(result.matched).toHaveLength(0);
		});
	});

	describe("eq", () => {
		it("matches on strict equality", () => {
			const r = rule({
				conditions: [{ field: "model", operator: "eq", value: "gpt-4" }],
			});
			const result = evaluatePolicy([r], { model: "gpt-4" });
			expect(result.matched).toHaveLength(1);
		});

		it("does not match different values", () => {
			const r = rule({
				conditions: [{ field: "model", operator: "eq", value: "gpt-4" }],
			});
			const result = evaluatePolicy([r], { model: "gpt-3.5" });
			expect(result.matched).toHaveLength(0);
		});

		it("does not coerce types", () => {
			const r = rule({
				conditions: [{ field: "count", operator: "eq", value: "5" }],
			});
			const result = evaluatePolicy([r], { count: 5 });
			expect(result.matched).toHaveLength(0);
		});
	});

	describe("neq", () => {
		it("matches when values differ", () => {
			const r = rule({
				conditions: [{ field: "status", operator: "neq", value: "active" }],
			});
			const result = evaluatePolicy([r], { status: "inactive" });
			expect(result.matched).toHaveLength(1);
		});

		it("does not match when values are equal", () => {
			const r = rule({
				conditions: [{ field: "status", operator: "neq", value: "active" }],
			});
			const result = evaluatePolicy([r], { status: "active" });
			expect(result.matched).toHaveLength(0);
		});
	});

	describe("gt", () => {
		it("matches when field > value", () => {
			const r = rule({
				conditions: [{ field: "cost", operator: "gt", value: 100 }],
			});
			const result = evaluatePolicy([r], { cost: 150 });
			expect(result.matched).toHaveLength(1);
		});

		it("does not match when field <= value", () => {
			const r = rule({
				conditions: [{ field: "cost", operator: "gt", value: 100 }],
			});
			expect(evaluatePolicy([r], { cost: 100 }).matched).toHaveLength(0);
			expect(evaluatePolicy([r], { cost: 50 }).matched).toHaveLength(0);
		});

		it("does not match non-numeric fields", () => {
			const r = rule({
				conditions: [{ field: "cost", operator: "gt", value: 100 }],
			});
			const result = evaluatePolicy([r], { cost: "150" });
			expect(result.matched).toHaveLength(0);
		});
	});

	describe("gte", () => {
		it("matches when field >= value", () => {
			const r = rule({
				conditions: [{ field: "count", operator: "gte", value: 10 }],
			});
			expect(evaluatePolicy([r], { count: 10 }).matched).toHaveLength(1);
			expect(evaluatePolicy([r], { count: 11 }).matched).toHaveLength(1);
		});

		it("does not match when field < value", () => {
			const r = rule({
				conditions: [{ field: "count", operator: "gte", value: 10 }],
			});
			expect(evaluatePolicy([r], { count: 9 }).matched).toHaveLength(0);
		});
	});

	describe("lt", () => {
		it("matches when field < value", () => {
			const r = rule({
				conditions: [{ field: "balance", operator: "lt", value: 100 }],
			});
			const result = evaluatePolicy([r], { balance: 50 });
			expect(result.matched).toHaveLength(1);
		});

		it("does not match when field >= value", () => {
			const r = rule({
				conditions: [{ field: "balance", operator: "lt", value: 100 }],
			});
			expect(evaluatePolicy([r], { balance: 100 }).matched).toHaveLength(0);
			expect(evaluatePolicy([r], { balance: 200 }).matched).toHaveLength(0);
		});
	});

	describe("lte", () => {
		it("matches when field <= value", () => {
			const r = rule({
				conditions: [{ field: "attempts", operator: "lte", value: 3 }],
			});
			expect(evaluatePolicy([r], { attempts: 3 }).matched).toHaveLength(1);
			expect(evaluatePolicy([r], { attempts: 2 }).matched).toHaveLength(1);
		});

		it("does not match when field > value", () => {
			const r = rule({
				conditions: [{ field: "attempts", operator: "lte", value: 3 }],
			});
			expect(evaluatePolicy([r], { attempts: 4 }).matched).toHaveLength(0);
		});
	});

	describe("in", () => {
		it("matches when field value is in array", () => {
			const r = rule({
				conditions: [
					{ field: "role", operator: "in", value: ["admin", "manager"] },
				],
			});
			expect(evaluatePolicy([r], { role: "admin" }).matched).toHaveLength(1);
			expect(evaluatePolicy([r], { role: "manager" }).matched).toHaveLength(1);
		});

		it("does not match when field value is not in array", () => {
			const r = rule({
				conditions: [
					{ field: "role", operator: "in", value: ["admin", "manager"] },
				],
			});
			expect(evaluatePolicy([r], { role: "worker" }).matched).toHaveLength(0);
		});
	});

	describe("not_in", () => {
		it("matches when field value is not in array", () => {
			const r = rule({
				conditions: [
					{ field: "provider", operator: "not_in", value: ["blocked-co"] },
				],
			});
			expect(evaluatePolicy([r], { provider: "openai" }).matched).toHaveLength(1);
		});

		it("does not match when field value is in array", () => {
			const r = rule({
				conditions: [
					{ field: "provider", operator: "not_in", value: ["blocked-co"] },
				],
			});
			expect(evaluatePolicy([r], { provider: "blocked-co" }).matched).toHaveLength(0);
		});
	});

	describe("contains", () => {
		it("matches when string field contains substring", () => {
			const r = rule({
				conditions: [{ field: "prompt", operator: "contains", value: "secret" }],
			});
			const result = evaluatePolicy([r], { prompt: "this is a secret message" });
			expect(result.matched).toHaveLength(1);
		});

		it("does not match when substring absent", () => {
			const r = rule({
				conditions: [{ field: "prompt", operator: "contains", value: "secret" }],
			});
			const result = evaluatePolicy([r], { prompt: "hello world" });
			expect(result.matched).toHaveLength(0);
		});

		it("does not match non-string fields", () => {
			const r = rule({
				conditions: [{ field: "count", operator: "contains", value: "5" }],
			});
			const result = evaluatePolicy([r], { count: 5 });
			expect(result.matched).toHaveLength(0);
		});
	});

	describe("regex", () => {
		it("matches when string field matches regex", () => {
			const r = rule({
				conditions: [{ field: "email", operator: "regex", value: ".*@example\\.com$" }],
			});
			const result = evaluatePolicy([r], { email: "user@example.com" });
			expect(result.matched).toHaveLength(1);
		});

		it("does not match when regex fails", () => {
			const r = rule({
				conditions: [{ field: "email", operator: "regex", value: "^admin@" }],
			});
			const result = evaluatePolicy([r], { email: "user@example.com" });
			expect(result.matched).toHaveLength(0);
		});

		it("handles invalid regex gracefully", () => {
			const r = rule({
				conditions: [{ field: "text", operator: "regex", value: "[invalid" }],
			});
			const result = evaluatePolicy([r], { text: "anything" });
			expect(result.matched).toHaveLength(0);
		});

		it("does not match non-string fields", () => {
			const r = rule({
				conditions: [{ field: "count", operator: "regex", value: "\\d+" }],
			});
			const result = evaluatePolicy([r], { count: 42 });
			expect(result.matched).toHaveLength(0);
		});
	});
});

// ===========================================================================
// Enforcement: hard vs soft
// ===========================================================================

describe("enforcement", () => {
	it("hard enforcement denies", () => {
		const r = rule({
			effect: "deny",
			enforcement: "hard",
			conditions: [{ field: "blocked", operator: "eq", value: true }],
		});
		const result = evaluatePolicy([r], { blocked: true });

		expect(result.decision).toBe("deny");
		expect(result.hardViolations).toHaveLength(1);
		expect(result.softViolations).toHaveLength(0);
	});

	it("soft enforcement warns but allows", () => {
		const r = rule({
			effect: "deny",
			enforcement: "soft",
			conditions: [{ field: "flagged", operator: "eq", value: true }],
		});
		const result = evaluatePolicy([r], { flagged: true });

		expect(result.decision).toBe("allow");
		expect(result.hasWarnings).toBe(true);
		expect(result.softViolations).toHaveLength(1);
	});

	it("warn effect with soft enforcement produces warning", () => {
		const r = rule({
			effect: "warn",
			enforcement: "soft",
			conditions: [{ field: "risk", operator: "gt", value: 0.5 }],
		});
		const result = evaluatePolicy([r], { risk: 0.8 });

		expect(result.decision).toBe("allow");
		expect(result.hasWarnings).toBe(true);
		expect(result.reasons.length).toBeGreaterThan(0);
		expect(result.reasons[0]).toMatch(/\[WARN\]/);
	});

	it("no matching rules = allow", () => {
		const r = rule({
			conditions: [{ field: "never", operator: "exists" }],
		});
		const result = evaluatePolicy([r], {});

		expect(result.decision).toBe("allow");
		expect(result.matched).toHaveLength(0);
	});
});

// ===========================================================================
// Dot-notation field resolution
// ===========================================================================

describe("dot-notation field resolution", () => {
	it("resolves nested field paths", () => {
		const r = rule({
			conditions: [{ field: "context.data.model", operator: "eq", value: "gpt-4" }],
		});
		const result = evaluatePolicy([r], {
			context: { data: { model: "gpt-4" } },
		});
		expect(result.matched).toHaveLength(1);
	});

	it("returns undefined for missing nested paths", () => {
		const r = rule({
			conditions: [{ field: "a.b.c", operator: "exists" }],
		});
		const result = evaluatePolicy([r], { a: { b: {} } });
		expect(result.matched).toHaveLength(0);
	});

	it("handles null in path gracefully", () => {
		const r = rule({
			conditions: [{ field: "a.b", operator: "exists" }],
		});
		const result = evaluatePolicy([r], { a: null });
		expect(result.matched).toHaveLength(0);
	});
});

// ===========================================================================
// Glob matching on scope patterns
// ===========================================================================

describe("scope glob matching", () => {
	it("matches exact paths", () => {
		expect(matchesScope(["src/index.ts"], ["src/index.ts"])).toBe(true);
	});

	it("matches ** glob patterns", () => {
		expect(matchesScope(["src/**"], ["src/routes/api.ts"])).toBe(true);
		expect(matchesScope(["src/**"], ["lib/utils.ts"])).toBe(false);
	});

	it("matches * single-level glob", () => {
		expect(matchesScope(["src/*.ts"], ["src/index.ts"])).toBe(true);
		expect(matchesScope(["src/*.ts"], ["src/routes/index.ts"])).toBe(false);
	});

	it("integrates with rule evaluation", () => {
		const r = rule({
			conditions: [{ field: "action", operator: "eq", value: "file.write" }],
			scopePatterns: ["src/routes/**"],
		});

		const allowed = evaluatePolicy([r], {
			action: "file.write",
			scope: ["src/routes/api.ts"],
		});
		expect(allowed.matched).toHaveLength(1);

		const blocked = evaluatePolicy([r], {
			action: "file.write",
			scope: ["lib/utils.ts"],
		});
		expect(blocked.matched).toHaveLength(0);
	});

	it("no scope in context fails scope rule", () => {
		const r = rule({
			scopePatterns: ["src/**"],
			conditions: [],
		});
		const result = evaluatePolicy([r], {});
		expect(result.matched).toHaveLength(0);
	});
});

// ===========================================================================
// Time-window constraints
// ===========================================================================

describe("time-window constraints", () => {
	// Build a Date in local time at a specific hour/day so getDay()/getHours()
	// return predictable values regardless of the machine's timezone.
	function localDate(hour: number, dayOffset = 0): Date {
		const d = new Date();
		d.setHours(hour, 0, 0, 0);
		if (dayOffset) d.setDate(d.getDate() + dayOffset);
		return d;
	}

	it("matches when within time window", () => {
		const d = localDate(12); // noon local
		const ts = d.toISOString();
		const day = d.getDay();

		expect(
			isWithinTimeWindow(
				[{ daysOfWeek: [day], startHour: 9, endHour: 17 }],
				ts,
			),
		).toBe(true);
	});

	it("does not match outside day-of-week", () => {
		const d = localDate(12);
		const ts = d.toISOString();
		const day = d.getDay();
		const otherDay = (day + 3) % 7; // guaranteed different day

		expect(
			isWithinTimeWindow(
				[{ daysOfWeek: [otherDay], startHour: 9, endHour: 17 }],
				ts,
			),
		).toBe(false);
	});

	it("does not match outside hour range", () => {
		const d = localDate(20); // 8 PM local
		const ts = d.toISOString();

		expect(
			isWithinTimeWindow(
				[{ startHour: 9, endHour: 17 }],
				ts,
			),
		).toBe(false);
	});

	it("returns true when no time windows specified", () => {
		const ts = new Date().toISOString();
		expect(isWithinTimeWindow(undefined, ts)).toBe(true);
		expect(isWithinTimeWindow([], ts)).toBe(true);
	});

	it("integrates with rule evaluation via timeWindows on rule", () => {
		const d = localDate(14); // 2 PM local
		const day = d.getDay();

		const r = rule({
			conditions: [],
			timeWindows: [{ daysOfWeek: [day], startHour: 9, endHour: 17 }],
		});

		// Within window
		const inWindow = evaluatePolicy([r], { timestamp: d.toISOString() });
		expect(inWindow.matched).toHaveLength(1);

		// Outside window (different day)
		const otherDay = localDate(14, 1);
		if (otherDay.getDay() !== day) {
			const outOfWindow = evaluatePolicy([r], {
				timestamp: otherDay.toISOString(),
			});
			expect(outOfWindow.matched).toHaveLength(0);
		}
	});
});

// ===========================================================================
// Priority ordering
// ===========================================================================

describe("priority ordering", () => {
	it("sorts rules by priority (lower = higher)", () => {
		const low = rule({
			name: "low-priority",
			priority: 100,
			effect: "deny",
			enforcement: "hard",
			conditions: [{ field: "x", operator: "eq", value: 1 }],
		});
		const high = rule({
			name: "high-priority",
			priority: 1,
			effect: "deny",
			enforcement: "hard",
			conditions: [{ field: "x", operator: "eq", value: 1 }],
		});

		const result = evaluatePolicy([low, high], { x: 1 });
		expect(result.matched).toHaveLength(2);
		// First match should be the higher priority rule
		expect(result.matched[0]?.name).toBe("high-priority");
	});

	it("defaults priority to 100 when not set", () => {
		const withPriority = rule({
			name: "explicit",
			priority: 50,
			conditions: [{ field: "x", operator: "eq", value: 1 }],
		});
		const withoutPriority = rule({
			name: "default",
			conditions: [{ field: "x", operator: "eq", value: 1 }],
		});
		delete (withoutPriority as Record<string, unknown>)["priority"];

		const result = evaluatePolicy([withoutPriority, withPriority], { x: 1 });
		// explicit (50) should come before default (100)
		expect(result.matched[0]?.name).toBe("explicit");
	});
});

// ===========================================================================
// Disabled rules
// ===========================================================================

describe("disabled rules", () => {
	it("skips disabled rules", () => {
		const r = rule({
			enabled: false,
			conditions: [{ field: "always", operator: "exists" }],
		});
		const result = evaluatePolicy([r], { always: true });
		expect(result.matched).toHaveLength(0);
	});

	it("defaults enabled to true", () => {
		const r = rule({ conditions: [] });
		delete (r as Record<string, unknown>)["enabled"];
		const result = evaluatePolicy([r], {});
		expect(result.matched).toHaveLength(1);
	});
});

// ===========================================================================
// Multiple conditions (AND logic)
// ===========================================================================

describe("multiple conditions (AND)", () => {
	it("requires all conditions to match", () => {
		const r = rule({
			conditions: [
				{ field: "role", operator: "eq", value: "admin" },
				{ field: "level", operator: "gte", value: 5 },
			],
		});

		// Both match
		expect(evaluatePolicy([r], { role: "admin", level: 10 }).matched).toHaveLength(1);

		// Only first matches
		expect(evaluatePolicy([r], { role: "admin", level: 3 }).matched).toHaveLength(0);

		// Only second matches
		expect(evaluatePolicy([r], { role: "user", level: 10 }).matched).toHaveLength(0);
	});
});

// ===========================================================================
// Result structure
// ===========================================================================

describe("result structure", () => {
	it("includes all required fields", () => {
		const result = evaluatePolicy([], {});
		expect(result).toHaveProperty("decision");
		expect(result).toHaveProperty("hasWarnings");
		expect(result).toHaveProperty("matched");
		expect(result).toHaveProperty("hardViolations");
		expect(result).toHaveProperty("softViolations");
		expect(result).toHaveProperty("reasons");
		expect(result).toHaveProperty("evaluatedAt");
	});

	it("includes rule id in reasons when present", () => {
		const r = rule({
			id: "rule-42",
			name: "Test rule",
			description: "Blocks everything",
			conditions: [{ field: "x", operator: "exists" }],
		});
		const result = evaluatePolicy([r], { x: true });
		expect(result.reasons[0]).toContain("[rule-42]");
	});

	it("falls back to name in reasons when no id", () => {
		const r = rule({
			name: "my-rule",
			conditions: [{ field: "x", operator: "exists" }],
		});
		const result = evaluatePolicy([r], { x: true });
		expect(result.reasons[0]).toContain("[my-rule]");
	});
});

// ===========================================================================
// Default rules
// ===========================================================================

describe("default rules", () => {
	it("blocks zero-budget calls", () => {
		const result = evaluatePolicy(DEFAULT_RULES, {
			budget: 0,
			estimated_cost: 100,
			budget_remaining: 0,
		});
		expect(result.decision).toBe("deny");
	});

	it("blocks negative-budget calls", () => {
		const result = evaluatePolicy(DEFAULT_RULES, {
			budget: -5,
			estimated_cost: 100,
			budget_remaining: -5,
		});
		expect(result.decision).toBe("deny");
	});

	it("warns on high-cost operations", () => {
		const result = evaluatePolicy(DEFAULT_RULES, {
			budget: 50000,
			estimated_cost: 2000,
			budget_remaining: 50000,
		});
		expect(result.hasWarnings).toBe(true);
		expect(result.softViolations.length).toBeGreaterThan(0);
	});

	it("allows normal operations", () => {
		const result = evaluatePolicy(DEFAULT_RULES, {
			budget: 50000,
			estimated_cost: 100,
			budget_remaining: 50000,
		});
		expect(result.decision).toBe("allow");
		expect(result.hasWarnings).toBe(false);
	});

	it("isBudgetExceeded detects overspend", () => {
		expect(
			isBudgetExceeded({ budget_remaining: 50, estimated_cost: 100 }),
		).toBe(true);
		expect(
			isBudgetExceeded({ budget_remaining: 200, estimated_cost: 100 }),
		).toBe(false);
	});

	it("isBudgetExceeded returns false for non-numeric fields", () => {
		expect(isBudgetExceeded({ budget_remaining: "50", estimated_cost: 100 })).toBe(false);
		expect(isBudgetExceeded({})).toBe(false);
	});
});

// ===========================================================================
// loadPolicies
// ===========================================================================

describe("loadPolicies", () => {
	it("returns empty array for non-existent file", () => {
		const rules = loadPolicies("/tmp/does-not-exist-govern-test.json");
		expect(rules).toEqual([]);
	});
});
