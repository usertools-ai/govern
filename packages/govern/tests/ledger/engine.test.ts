import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock tigerbeetle-node (needed because engine.ts imports CreateTransferError)
vi.mock("tigerbeetle-node", () => ({
	createClient: vi.fn(),
	AccountFlags: { debits_must_not_exceed_credits: 1 << 2, history: 1 << 5 },
	TransferFlags: { pending: 1, post_pending_transfer: 2, void_pending_transfer: 4 },
	CreateAccountError: { exists: 1 },
	CreateTransferError: {
		exceeds_credits: 22,
		overflows_debits: 30,
		overflows_debits_pending: 31,
	},
	amount_max: (1n << 128n) - 1n,
}));

// Mock fs for DLQ writes
vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		existsSync: vi.fn(() => true),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
	};
});

import { GovernEngine } from "../../src/ledger/engine.js";
import type { SpendAction } from "../../src/ledger/engine.js";
import { InsufficientBalanceError } from "../../src/shared/errors.js";
import { XFER_SPEND } from "../../src/ledger/client.js";

/** Create a mock GovernTBClient with vi.fn() methods. */
function createMockTBClient() {
	return {
		getAccountId: vi.fn((userId: string) => BigInt(userId.length) * 1000n),
		getTreasuryId: vi.fn(() => 1n),
		lookupBalance: vi.fn(),
		createPendingTransfer: vi.fn(),
		postTransfer: vi.fn(),
		voidTransfer: vi.fn(),
		immediateTransfer: vi.fn(),
		lookupTransfer: vi.fn(),
		lookupAccounts: vi.fn(),
		createUserWallet: vi.fn(),
		createTreasury: vi.fn(),
		setTreasuryId: vi.fn(),
		setAccountMapping: vi.fn(),
		ping: vi.fn(),
		destroy: vi.fn(),
	};
}

const DEFAULT_ACTION: SpendAction = {
	type: "ai_compute",
	model: "claude-sonnet-4-6",
	inputTokens: 1000,
	outputTokens: 500,
};

describe("GovernEngine", () => {
	let mockTB: ReturnType<typeof createMockTBClient>;
	let engine: GovernEngine;

	beforeEach(() => {
		vi.clearAllMocks();
		mockTB = createMockTBClient();
		engine = new GovernEngine({
			tbClient: mockTB as any,
			dlqPath: "/tmp/test-dlq",
		});
	});

	describe("spendPending", () => {
		it("creates a PENDING transfer", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});
			mockTB.createPendingTransfer.mockResolvedValueOnce(42n);

			const result = await engine.spendPending({
				userId: "user_1",
				action: DEFAULT_ACTION,
			});

			expect(result.pending).toBe(true);
			expect(result.transferId).toBe("42");
			expect(mockTB.createPendingTransfer).toHaveBeenCalledOnce();

			// Verify the transfer was created with correct code
			const call = mockTB.createPendingTransfer.mock.calls[0]![0];
			expect(call.code).toBe(XFER_SPEND);
		});

		it("calculates cost using pricing table", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});
			mockTB.createPendingTransfer.mockResolvedValueOnce(42n);

			const result = await engine.spendPending({
				userId: "user_1",
				action: DEFAULT_ACTION,
			});

			// claude-sonnet-4-6: 1000 input * 30/1k + 500 output * 150/1k = 30 + 75 = 105
			expect(result.amount).toBe(105);
		});

		it("throws InsufficientBalanceError when balance too low", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 10,
				pending: 0,
				total: 10,
			});

			await expect(
				engine.spendPending({ userId: "user_1", action: DEFAULT_ACTION }),
			).rejects.toThrow(InsufficientBalanceError);
		});

		it("catches TB insufficient balance error and wraps it", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});

			// Simulate TB rejecting due to concurrent depletion
			const tbErr = new Error("Pending transfer failed: exceeds_credits");
			Object.assign(tbErr, { name: "TBTransferError", code: 22 });
			mockTB.createPendingTransfer.mockRejectedValueOnce(tbErr);

			await expect(
				engine.spendPending({ userId: "user_1", action: DEFAULT_ACTION }),
			).rejects.toThrow(InsufficientBalanceError);
		});

		it("includes agentRef as userData32 when provided", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});
			mockTB.createPendingTransfer.mockResolvedValueOnce(42n);

			await engine.spendPending({
				userId: "user_1",
				action: DEFAULT_ACTION,
				metadata: { agentRef: "agent_abc" },
			});

			const call = mockTB.createPendingTransfer.mock.calls[0]![0];
			expect(call.userData32).toBeDefined();
			expect(typeof call.userData32).toBe("number");
		});

		it("propagates non-balance errors from TB", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});

			const tbErr = new Error("Connection refused");
			mockTB.createPendingTransfer.mockRejectedValueOnce(tbErr);

			await expect(
				engine.spendPending({ userId: "user_1", action: DEFAULT_ACTION }),
			).rejects.toThrow("Connection refused");
		});
	});

	describe("postPendingSpend", () => {
		it("settles a pending transfer", async () => {
			mockTB.postTransfer.mockResolvedValueOnce(100n);
			await engine.postPendingSpend("42");
			expect(mockTB.postTransfer).toHaveBeenCalledWith(42n, undefined);
		});

		it("settles with actual amount when provided", async () => {
			mockTB.postTransfer.mockResolvedValueOnce(100n);
			await engine.postPendingSpend("42", 50);
			expect(mockTB.postTransfer).toHaveBeenCalledWith(42n, 50);
		});

		it("attempts void on post failure, then throws", async () => {
			mockTB.postTransfer.mockRejectedValueOnce(new Error("post failed"));
			mockTB.voidTransfer.mockResolvedValueOnce(101n);

			await expect(engine.postPendingSpend("42")).rejects.toThrow(
				"pending transfer voided after post failure",
			);
			expect(mockTB.voidTransfer).toHaveBeenCalledWith(42n);
		});

		it("writes to DLQ when both post and void fail", async () => {
			const { writeFileSync } = await import("node:fs");
			mockTB.postTransfer.mockRejectedValueOnce(new Error("post failed"));
			mockTB.voidTransfer.mockRejectedValueOnce(new Error("void failed"));

			await expect(engine.postPendingSpend("42")).rejects.toThrow(
				"Spend settlement ambiguous",
			);

			expect(writeFileSync).toHaveBeenCalled();
		});
	});

	describe("voidPendingSpend", () => {
		it("releases a pending hold", async () => {
			mockTB.voidTransfer.mockResolvedValueOnce(101n);
			await engine.voidPendingSpend("42");
			expect(mockTB.voidTransfer).toHaveBeenCalledWith(42n);
		});

		it("propagates void errors", async () => {
			mockTB.voidTransfer.mockRejectedValueOnce(new Error("void failed"));
			await expect(engine.voidPendingSpend("42")).rejects.toThrow("void failed");
		});
	});

	describe("balance", () => {
		it("returns balance for a user", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 5000,
				pending: 200,
				total: 5200,
			});
			const bal = await engine.balance("user_1");
			expect(bal.available).toBe(5000);
			expect(bal.pending).toBe(200);
			expect(bal.total).toBe(5200);
		});
	});

	describe("configurable hold TTL", () => {
		it("uses custom hold TTL when provided", async () => {
			const customEngine = new GovernEngine({
				tbClient: mockTB as any,
				holdTtlMs: 120_000, // 2 minutes
			});

			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});
			mockTB.createPendingTransfer.mockResolvedValueOnce(42n);

			await customEngine.spendPending({
				userId: "user_1",
				action: DEFAULT_ACTION,
			});

			const call = mockTB.createPendingTransfer.mock.calls[0]![0];
			expect(call.timeoutSeconds).toBe(120); // 120_000ms / 1000 = 120s
		});

		it("uses default hold TTL (5 min) when not specified", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});
			mockTB.createPendingTransfer.mockResolvedValueOnce(42n);

			await engine.spendPending({
				userId: "user_1",
				action: DEFAULT_ACTION,
			});

			const call = mockTB.createPendingTransfer.mock.calls[0]![0];
			expect(call.timeoutSeconds).toBe(300); // 300_000ms / 1000 = 300s
		});
	});

	describe("two-phase lifecycle", () => {
		it("spendPending -> postPendingSpend (success path)", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});
			mockTB.createPendingTransfer.mockResolvedValueOnce(42n);
			mockTB.postTransfer.mockResolvedValueOnce(100n);

			const result = await engine.spendPending({
				userId: "user_1",
				action: DEFAULT_ACTION,
			});
			expect(result.pending).toBe(true);

			await engine.postPendingSpend(result.transferId);
			expect(mockTB.postTransfer).toHaveBeenCalledWith(42n, undefined);
		});

		it("spendPending -> voidPendingSpend (failure path)", async () => {
			mockTB.lookupBalance.mockResolvedValueOnce({
				available: 100_000,
				pending: 0,
				total: 100_000,
			});
			mockTB.createPendingTransfer.mockResolvedValueOnce(42n);
			mockTB.voidTransfer.mockResolvedValueOnce(101n);

			const result = await engine.spendPending({
				userId: "user_1",
				action: DEFAULT_ACTION,
			});
			expect(result.pending).toBe(true);

			await engine.voidPendingSpend(result.transferId);
			expect(mockTB.voidTransfer).toHaveBeenCalledWith(42n);
		});
	});
});
