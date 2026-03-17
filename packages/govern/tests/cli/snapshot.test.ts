import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/cli/snapshot.js";

describe("govern snapshot", () => {
	let tempDir: string;
	let logOutput: string[];
	let originalArgv: string[];

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "govern-snapshot-cli-"));
		logOutput = [];
		originalArgv = [...process.argv];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logOutput.push(args.map(String).join(" "));
		});
	});

	afterEach(() => {
		process.argv = originalArgv;
		vi.restoreAllMocks();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("prints missing vault message when no vault exists", async () => {
		await run(tempDir);

		expect(logOutput.some((l) => l.includes("govern init"))).toBe(true);
	});

	it("prints usage when no subcommand given", async () => {
		const vaultPath = join(tempDir, ".usertools");
		mkdirSync(vaultPath, { recursive: true });
		process.argv = ["node", "govern", "snapshot"];

		await run(tempDir);

		const combined = logOutput.join("\n");
		expect(combined).toContain("Usage:");
	});

	it("creates a snapshot", async () => {
		const vaultPath = join(tempDir, ".usertools");
		mkdirSync(join(vaultPath, "audit"), { recursive: true });
		mkdirSync(join(vaultPath, "policies"), { recursive: true });
		writeFileSync(
			join(vaultPath, "govern.config.json"),
			JSON.stringify({ budget: 50000 }),
			"utf-8",
		);
		writeFileSync(join(vaultPath, "policies", "default.yml"), "rules: []", "utf-8");

		process.argv = ["node", "govern", "snapshot", "create", "test-snap"];

		await run(tempDir);

		const combined = logOutput.join("\n");
		expect(combined).toContain("Snapshot created: test-snap");
		expect(combined).toContain("Files:");
	});

	it("lists snapshots", async () => {
		const vaultPath = join(tempDir, ".usertools");
		mkdirSync(join(vaultPath, "audit"), { recursive: true });
		mkdirSync(join(vaultPath, "policies"), { recursive: true });
		writeFileSync(
			join(vaultPath, "govern.config.json"),
			JSON.stringify({ budget: 50000 }),
			"utf-8",
		);
		writeFileSync(join(vaultPath, "policies", "default.yml"), "rules: []", "utf-8");

		// Create a snapshot first
		process.argv = ["node", "govern", "snapshot", "create", "snap-1"];
		await run(tempDir);

		logOutput = [];
		process.argv = ["node", "govern", "snapshot", "list"];
		await run(tempDir);

		const combined = logOutput.join("\n");
		expect(combined).toContain("snap-1");
	});

	it("shows no snapshots message when empty", async () => {
		const vaultPath = join(tempDir, ".usertools");
		mkdirSync(vaultPath, { recursive: true });
		process.argv = ["node", "govern", "snapshot", "list"];

		await run(tempDir);

		const combined = logOutput.join("\n");
		expect(combined).toContain("No snapshots found");
	});

	it("prints usage for create without name", async () => {
		const vaultPath = join(tempDir, ".usertools");
		mkdirSync(vaultPath, { recursive: true });
		process.argv = ["node", "govern", "snapshot", "create"];

		await run(tempDir);

		const combined = logOutput.join("\n");
		expect(combined).toContain("Usage:");
	});
});
