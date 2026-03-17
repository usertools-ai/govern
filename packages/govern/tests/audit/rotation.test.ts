import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listReceipts, loadIndex, writeReceipt } from "../../src/audit/rotation.js";
import { RECEIPT_VERSION } from "../../src/shared/constants.js";

describe("Audit Rotation — writeReceipt", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "govern-rotation-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("writes a receipt to a date-organized directory", () => {
		const receipt = writeReceipt(tempDir, {
			kind: "policy",
			subsystem: "policy-gate",
			actor: "agent-1",
			data: { decision: "allow" },
		});

		expect(receipt).toBeDefined();
		expect(receipt!.v).toBe(RECEIPT_VERSION);
		expect(receipt!.kind).toBe("policy");
		expect(receipt!.actor).toBe("agent-1");
		expect(receipt!.ts).toBeDefined();
	});

	it("receipt file exists on disk", () => {
		const receipt = writeReceipt(tempDir, {
			kind: "system",
			subsystem: "audit",
			actor: "sys",
			data: { event: "test" },
		});

		expect(receipt).toBeDefined();
		const receiptId = receipt!.data["receiptId"] as string;
		const today = new Date().toISOString().split("T")[0]!;
		const receiptPath = join(
			tempDir,
			".usertools",
			"audit",
			"system",
			today,
			`${receiptId}.json`,
		);
		expect(existsSync(receiptPath)).toBe(true);

		const parsed = JSON.parse(readFileSync(receiptPath, "utf-8"));
		expect(parsed.kind).toBe("system");
	});

	it("includes correlationId when provided", () => {
		const receipt = writeReceipt(tempDir, {
			kind: "task",
			subsystem: "write-guard",
			actor: "worker-1",
			correlationId: "corr_test_123",
			data: { taskId: "T-001" },
		});

		expect(receipt).toBeDefined();
		expect(receipt!.correlationId).toBe("corr_test_123");
	});

	it("generates unique receipt IDs", () => {
		const ids = new Set<string>();
		for (let i = 0; i < 10; i++) {
			const receipt = writeReceipt(tempDir, {
				kind: "system",
				subsystem: "test",
				actor: "sys",
				data: { n: i },
			});
			if (receipt) {
				ids.add(receipt.data["receiptId"] as string);
			}
		}
		expect(ids.size).toBe(10);
	});
});

describe("Audit Rotation — listReceipts", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "govern-rotation-list-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns empty array for nonexistent kind", () => {
		const results = listReceipts(tempDir, "nonexistent");
		expect(results).toEqual([]);
	});

	it("lists all receipts of a kind", () => {
		writeReceipt(tempDir, {
			kind: "policy",
			subsystem: "gate",
			actor: "a1",
			data: { n: 1 },
		});
		writeReceipt(tempDir, {
			kind: "policy",
			subsystem: "gate",
			actor: "a2",
			data: { n: 2 },
		});
		writeReceipt(tempDir, {
			kind: "system",
			subsystem: "other",
			actor: "a3",
			data: { n: 3 },
		});

		const policyReceipts = listReceipts(tempDir, "policy");
		expect(policyReceipts).toHaveLength(2);

		const systemReceipts = listReceipts(tempDir, "system");
		expect(systemReceipts).toHaveLength(1);
	});

	it("returns receipts sorted newest-first", () => {
		writeReceipt(tempDir, {
			kind: "task",
			subsystem: "wg",
			actor: "w1",
			data: { order: 1 },
		});
		writeReceipt(tempDir, {
			kind: "task",
			subsystem: "wg",
			actor: "w2",
			data: { order: 2 },
		});

		const results = listReceipts(tempDir, "task");
		expect(results).toHaveLength(2);
		// Newest first
		const ts0 = new Date(results[0]!.ts).getTime();
		const ts1 = new Date(results[1]!.ts).getTime();
		expect(ts0).toBeGreaterThanOrEqual(ts1);
	});
});

describe("Audit Rotation — loadIndex", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "govern-rotation-index-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns empty array when no index exists", () => {
		const index = loadIndex(tempDir);
		expect(index).toEqual([]);
	});

	it("index grows with each receipt", () => {
		writeReceipt(tempDir, {
			kind: "policy",
			subsystem: "gate",
			actor: "a1",
			data: {},
		});
		writeReceipt(tempDir, {
			kind: "system",
			subsystem: "audit",
			actor: "a2",
			data: {},
		});

		const index = loadIndex(tempDir);
		expect(index).toHaveLength(2);
		expect(index[0]!.kind).toBe("policy");
		expect(index[1]!.kind).toBe("system");
	});

	it("index is bounded at the configured limit", () => {
		// Write 15 receipts with limit of 10
		for (let i = 0; i < 15; i++) {
			writeReceipt(
				tempDir,
				{
					kind: "system",
					subsystem: "test",
					actor: "sys",
					data: { n: i },
				},
				10,
			);
		}

		const index = loadIndex(tempDir);
		expect(index.length).toBeLessThanOrEqual(10);
	});

	it("index entries have correct path format", () => {
		writeReceipt(tempDir, {
			kind: "policy",
			subsystem: "gate",
			actor: "a1",
			data: {},
		});

		const index = loadIndex(tempDir);
		expect(index).toHaveLength(1);
		const entry = index[0]!;
		expect(entry.path).toMatch(/^policy\/\d{4}-\d{2}-\d{2}\/rcpt_/);
		expect(entry.kind).toBe("policy");
		expect(entry.actor).toBe("a1");
	});
});
