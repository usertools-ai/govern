import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { VAULT_DIR } from "./shared/constants.js";
import { GovernConfigSchema } from "./shared/types.js";
import type { GovernConfig } from "./shared/types.js";

/**
 * Load govern config from `.usertools/govern.config.json`, merged with
 * optional runtime overrides. Returns a validated GovernConfig.
 */
export async function loadConfig(overrides?: Partial<GovernConfig>): Promise<GovernConfig> {
	const configPath = join(VAULT_DIR, "govern.config.json");
	let raw: Record<string, unknown> = {};
	if (existsSync(configPath)) {
		raw = JSON.parse(await readFile(configPath, "utf-8")) as Record<string, unknown>;
	}
	const merged = { ...raw };
	if (overrides) {
		for (const [key, val] of Object.entries(overrides)) {
			if (val !== undefined) {
				(merged as Record<string, unknown>)[key] = val;
			}
		}
	}
	return GovernConfigSchema.parse(merged);
}

/** Identity function for TypeScript config intellisense. */
export function defineConfig(config: GovernConfig): GovernConfig {
	return GovernConfigSchema.parse(config);
}
