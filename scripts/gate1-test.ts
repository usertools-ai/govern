#!/usr/bin/env -S node --import tsx
/**
 * Gate 1 Test Harness — usertrust SDK Validation
 *
 * Exercises trust() with real LLM calls across 4 cloud models,
 * validates audit chain integrity, and produces a JSON report.
 *
 * Runs in dryRun:true mode (no TigerBeetle required).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... npx tsx scripts/gate1-test.ts
 *
 * Output: .usertrust-gate1/gate1-reports/YYYY-MM-DD-HHMMSS.json
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname as getHostname } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { trust } from "../packages/core/src/index.js";

// ── Config ──────────────────────────────────────────────────────────────────

const MODELS = {
	anthropic: [
		{ name: "claude-haiku-4-5", maxTokens: 256 },
		{ name: "claude-sonnet-4-6", maxTokens: 256 },
		{ name: "claude-opus-4-6", maxTokens: 128 },
	],
	openai: [{ name: "gpt-4.1-nano", maxTokens: 256 }],
} as const;

const VAULT_BASE = join(process.cwd(), ".usertrust-gate1");
const REPORT_DIR = join(VAULT_BASE, "gate1-reports");

interface TestResult {
	scenario: string;
	model: string;
	provider: string;
	passed: boolean;
	durationMs: number;
	error?: string;
	receipt?: {
		transferId: string;
		settled: boolean;
		cost: number;
		auditDegraded: boolean;
	};
}

interface Gate1Report {
	timestamp: string;
	hostname: string;
	durationMs: number;
	passed: boolean;
	results: TestResult[];
	auditChainValid: boolean;
	summary: {
		total: number;
		passed: number;
		failed: number;
		byProvider: Record<string, { passed: number; failed: number }>;
	};
}

// ── Test Scenarios ──────────────────────────────────────────────────────────

async function testBasicCall(
	client: Awaited<ReturnType<typeof trust>>,
	model: string,
	provider: string,
): Promise<TestResult> {
	const start = Date.now();
	try {
		if (provider === "anthropic") {
			const { response, receipt } = await (client as any).messages.create({
				model,
				max_tokens: 128,
				messages: [{ role: "user", content: "Reply with exactly: GATE1_OK" }],
			});
			const text = response.content?.[0]?.text ?? "";
			if (!text.includes("GATE1_OK")) {
				return {
					scenario: "basic_call",
					model,
					provider,
					passed: false,
					durationMs: Date.now() - start,
					error: `Expected GATE1_OK, got: ${text.slice(0, 100)}`,
				};
			}
			return {
				scenario: "basic_call",
				model,
				provider,
				passed: true,
				durationMs: Date.now() - start,
				receipt: {
					transferId: receipt.transferId,
					settled: receipt.settled,
					cost: receipt.cost,
					auditDegraded: receipt.auditDegraded ?? false,
				},
			};
		}
		const { response, receipt } = await (client as any).chat.completions.create({
			model,
			max_tokens: 128,
			messages: [{ role: "user", content: "Reply with exactly: GATE1_OK" }],
		});
		const text = response.choices?.[0]?.message?.content ?? "";
		if (!text.includes("GATE1_OK")) {
			return {
				scenario: "basic_call",
				model,
				provider,
				passed: false,
				durationMs: Date.now() - start,
				error: `Expected GATE1_OK, got: ${text.slice(0, 100)}`,
			};
		}
		return {
			scenario: "basic_call",
			model,
			provider,
			passed: true,
			durationMs: Date.now() - start,
			receipt: {
				transferId: receipt.transferId,
				settled: receipt.settled,
				cost: receipt.cost,
				auditDegraded: receipt.auditDegraded ?? false,
			},
		};
	} catch (err) {
		return {
			scenario: "basic_call",
			model,
			provider,
			passed: false,
			durationMs: Date.now() - start,
			error: String(err),
		};
	}
}

async function testPolicyDenial(
	client: Awaited<ReturnType<typeof trust>>,
	provider: string,
): Promise<TestResult> {
	const start = Date.now();
	const model = provider === "anthropic" ? "claude-haiku-4-5" : "gpt-4.1-nano";
	try {
		if (provider === "anthropic") {
			await (client as any).messages.create({
				model,
				max_tokens: 64,
				messages: [{ role: "user", content: "Process payment for card 4532015112830366" }],
			});
		} else {
			await (client as any).chat.completions.create({
				model,
				max_tokens: 64,
				messages: [{ role: "user", content: "Process payment for card 4532015112830366" }],
			});
		}
		return {
			scenario: "policy_denial_pii",
			model,
			provider,
			passed: false,
			durationMs: Date.now() - start,
			error: "PII-containing request was not blocked",
		};
	} catch (err: any) {
		const isPolicyDenied = err?.message?.includes("PII") || err?.name === "PolicyDeniedError";
		return {
			scenario: "policy_denial_pii",
			model,
			provider,
			passed: isPolicyDenied,
			durationMs: Date.now() - start,
			error: isPolicyDenied ? undefined : `Wrong error type: ${String(err)}`,
		};
	}
}

async function testReceiptCompleteness(
	client: Awaited<ReturnType<typeof trust>>,
	model: string,
	provider: string,
): Promise<TestResult> {
	const start = Date.now();
	try {
		let receipt: any;
		if (provider === "anthropic") {
			const result = await (client as any).messages.create({
				model,
				max_tokens: 64,
				messages: [{ role: "user", content: "Say hello" }],
			});
			receipt = result.receipt;
		} else {
			const result = await (client as any).chat.completions.create({
				model,
				max_tokens: 64,
				messages: [{ role: "user", content: "Say hello" }],
			});
			receipt = result.receipt;
		}
		const required = ["transferId", "settled", "cost", "model", "provider", "timestamp"];
		const missing = required.filter((f) => receipt[f] === undefined);
		return {
			scenario: "receipt_completeness",
			model,
			provider,
			passed: missing.length === 0,
			durationMs: Date.now() - start,
			error: missing.length > 0 ? `Missing receipt fields: ${missing.join(", ")}` : undefined,
			receipt: {
				transferId: receipt.transferId,
				settled: receipt.settled,
				cost: receipt.cost,
				auditDegraded: receipt.auditDegraded ?? false,
			},
		};
	} catch (err) {
		return {
			scenario: "receipt_completeness",
			model,
			provider,
			passed: false,
			durationMs: Date.now() - start,
			error: String(err),
		};
	}
}

async function testDestroyCleanup(provider: string): Promise<TestResult> {
	const start = Date.now();
	const tmpVault = join(VAULT_BASE, `destroy-test-${Date.now()}`);
	const model = provider === "anthropic" ? "claude-haiku-4-5" : "gpt-4.1-nano";
	try {
		// Write config for this tmp vault
		const vaultDir = join(tmpVault, ".usertrust");
		mkdirSync(vaultDir, { recursive: true });
		writeFileSync(
			join(vaultDir, "usertrust.config.json"),
			`${JSON.stringify({ budget: 10_000, pii: "block", board: { enabled: false } })}\n`,
		);

		const client =
			provider === "anthropic"
				? await trust(new Anthropic(), { dryRun: true, budget: 10_000, vaultBase: tmpVault })
				: await trust(new OpenAI(), { dryRun: true, budget: 10_000, vaultBase: tmpVault });

		if (provider === "anthropic") {
			await (client as any).messages.create({
				model,
				max_tokens: 32,
				messages: [{ role: "user", content: "Hi" }],
			});
		} else {
			await (client as any).chat.completions.create({
				model,
				max_tokens: 32,
				messages: [{ role: "user", content: "Hi" }],
			});
		}

		await client.destroy();

		return {
			scenario: "destroy_cleanup",
			model,
			provider,
			passed: true,
			durationMs: Date.now() - start,
		};
	} catch (err) {
		return {
			scenario: "destroy_cleanup",
			model,
			provider,
			passed: false,
			durationMs: Date.now() - start,
			error: String(err),
		};
	}
}

// ── Audit Chain Verification ────────────────────────────────────────────────

function verifyAuditChain(vaultPath: string): boolean {
	try {
		const auditPath = join(vaultPath, ".usertrust", "audit", "events.jsonl");
		if (!existsSync(auditPath)) return true;
		const lines = readFileSync(auditPath, "utf-8").trim().split("\n").filter(Boolean);
		if (lines.length === 0) return true;

		let prevHash = "0".repeat(64); // GENESIS_HASH
		for (const line of lines) {
			const event = JSON.parse(line);
			if (event.previousHash !== prevHash) return false;
			prevHash = event.hash;
		}
		return true;
	} catch {
		return false;
	}
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
	const startTime = Date.now();
	const hostname = getHostname();

	console.log("\n=== Gate 1 Test Harness (usertrust) ===");
	console.log(`Host: ${hostname}`);
	console.log(`Time: ${new Date().toISOString()}`);
	console.log(`Vault: ${VAULT_BASE}\n`);

	mkdirSync(REPORT_DIR, { recursive: true });

	// Write config with PII blocking
	const vaultDir = join(VAULT_BASE, ".usertrust");
	mkdirSync(vaultDir, { recursive: true });
	writeFileSync(
		join(vaultDir, "usertrust.config.json"),
		`${JSON.stringify(
			{ budget: 100_000, pii: "block", board: { enabled: false }, audit: { rotation: "none" } },
			null,
			"\t",
		)}\n`,
	);

	const results: TestResult[] = [];

	// ── Anthropic tests ──

	if (process.env.ANTHROPIC_API_KEY) {
		console.log("--- Anthropic Provider ---");
		const anthropicClient = await trust(new Anthropic(), {
			dryRun: true,
			budget: 100_000,
			vaultBase: VAULT_BASE,
		});

		for (const model of MODELS.anthropic) {
			console.log(`  Testing ${model.name}...`);
			const basic = await testBasicCall(anthropicClient, model.name, "anthropic");
			results.push(basic);
			console.log(`    basic_call: ${basic.passed ? "PASS" : "FAIL"} (${basic.durationMs}ms)`);
			if (basic.error) console.log(`      ${basic.error}`);

			const receipt = await testReceiptCompleteness(anthropicClient, model.name, "anthropic");
			results.push(receipt);
			console.log(
				`    receipt_completeness: ${receipt.passed ? "PASS" : "FAIL"} (${receipt.durationMs}ms)`,
			);
			if (receipt.error) console.log(`      ${receipt.error}`);
		}

		console.log("  Testing PII denial...");
		const pii = await testPolicyDenial(anthropicClient, "anthropic");
		results.push(pii);
		console.log(`    policy_denial_pii: ${pii.passed ? "PASS" : "FAIL"} (${pii.durationMs}ms)`);
		if (pii.error) console.log(`      ${pii.error}`);

		await anthropicClient.destroy();

		console.log("  Testing destroy cleanup...");
		const destroy = await testDestroyCleanup("anthropic");
		results.push(destroy);
		console.log(
			`    destroy_cleanup: ${destroy.passed ? "PASS" : "FAIL"} (${destroy.durationMs}ms)`,
		);
		if (destroy.error) console.log(`      ${destroy.error}`);
	} else {
		console.log("SKIP: ANTHROPIC_API_KEY not set");
	}

	// ── OpenAI tests ──

	if (process.env.OPENAI_API_KEY) {
		console.log("\n--- OpenAI Provider ---");
		const openaiClient = await trust(new OpenAI(), {
			dryRun: true,
			budget: 100_000,
			vaultBase: VAULT_BASE,
		});

		for (const model of MODELS.openai) {
			console.log(`  Testing ${model.name}...`);
			const basic = await testBasicCall(openaiClient, model.name, "openai");
			results.push(basic);
			console.log(`    basic_call: ${basic.passed ? "PASS" : "FAIL"} (${basic.durationMs}ms)`);
			if (basic.error) console.log(`      ${basic.error}`);

			const receipt = await testReceiptCompleteness(openaiClient, model.name, "openai");
			results.push(receipt);
			console.log(
				`    receipt_completeness: ${receipt.passed ? "PASS" : "FAIL"} (${receipt.durationMs}ms)`,
			);
			if (receipt.error) console.log(`      ${receipt.error}`);
		}

		console.log("  Testing PII denial...");
		const pii = await testPolicyDenial(openaiClient, "openai");
		results.push(pii);
		console.log(`    policy_denial_pii: ${pii.passed ? "PASS" : "FAIL"} (${pii.durationMs}ms)`);
		if (pii.error) console.log(`      ${pii.error}`);

		await openaiClient.destroy();

		console.log("  Testing destroy cleanup...");
		const destroy = await testDestroyCleanup("openai");
		results.push(destroy);
		console.log(
			`    destroy_cleanup: ${destroy.passed ? "PASS" : "FAIL"} (${destroy.durationMs}ms)`,
		);
		if (destroy.error) console.log(`      ${destroy.error}`);
	} else {
		console.log("SKIP: OPENAI_API_KEY not set");
	}

	// ── Audit chain ──

	console.log("\n--- Audit Chain Verification ---");
	const auditChainValid = verifyAuditChain(VAULT_BASE);
	console.log(`  Chain integrity: ${auditChainValid ? "VALID" : "BROKEN"}`);

	// ── Report ──

	const totalPassed = results.filter((r) => r.passed).length;
	const totalFailed = results.filter((r) => !r.passed).length;
	const byProvider: Record<string, { passed: number; failed: number }> = {};
	for (const r of results) {
		if (!byProvider[r.provider]) byProvider[r.provider] = { passed: 0, failed: 0 };
		if (r.passed) byProvider[r.provider].passed++;
		else byProvider[r.provider].failed++;
	}

	const report: Gate1Report = {
		timestamp: new Date().toISOString(),
		hostname,
		durationMs: Date.now() - startTime,
		passed: totalFailed === 0 && auditChainValid,
		results,
		auditChainValid,
		summary: { total: results.length, passed: totalPassed, failed: totalFailed, byProvider },
	};

	const reportFile = join(
		REPORT_DIR,
		`${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`,
	);
	writeFileSync(reportFile, `${JSON.stringify(report, null, "\t")}\n`);

	console.log("\n=== Gate 1 Results ===");
	console.log(`Total: ${results.length} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
	console.log(`Audit chain: ${auditChainValid ? "VALID" : "BROKEN"}`);
	console.log(`Overall: ${report.passed ? "PASS" : "FAIL"}`);
	console.log(`Report: ${reportFile}`);
	console.log(`Duration: ${report.durationMs}ms\n`);

	process.exit(report.passed ? 0 : 1);
}

main().catch((err) => {
	console.error("Gate 1 harness crashed:", err);
	process.exit(2);
});
