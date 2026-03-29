#!/usr/bin/env node
// hooks/capability-scan.mjs
// SessionStart hook: scans enabled plugins, merges overrides, writes capability cache.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { atomicWrite } from "./capability-controllers/state.mjs";

const CACHE_PATH =
	process.env.USERTRUST_CACHE_PATH ?? join(process.cwd(), ".usertrust", ".capability-cache.json");
const OVERRIDES_PATH =
	process.env.USERTRUST_CAPABILITIES_PATH ?? join(process.cwd(), ".usertrust", "capabilities.json");
const PLUGINS_CACHE = join(process.env.HOME ?? "", ".claude/plugins/cache");
const SETTINGS_PATH = join(process.env.HOME ?? "", ".claude/settings.json");

/**
 * Read enabled plugins from user settings.
 * @returns {Array<{ name: string, marketplace: string }>}
 */
function getEnabledPlugins() {
	try {
		const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
		const enabled = settings.enabledPlugins ?? {};
		return Object.keys(enabled)
			.filter((k) => enabled[k])
			.map((k) => {
				const [name, marketplace] = k.split("@");
				return { name, marketplace };
			});
	} catch {
		return [];
	}
}

/**
 * Find the most recent cached version of a plugin.
 * @param {string} marketplace
 * @param {string} name
 * @returns {string|null} path to plugin root
 */
function findPluginDir(marketplace, name) {
	const SAFE_SEGMENT = /^[a-zA-Z0-9_@.-]+$/;
	if (!SAFE_SEGMENT.test(name) || !SAFE_SEGMENT.test(marketplace)) return null;
	const pluginBase = join(PLUGINS_CACHE, marketplace, name);
	if (!existsSync(pluginBase)) return null;
	try {
		const hashes = readdirSync(pluginBase)
			.filter((h) => {
				const p = join(pluginBase, h);
				try {
					return statSync(p).isDirectory();
				} catch {
					return false;
				}
			})
			.sort((a, b) => {
				// Most recent mtime first
				try {
					return statSync(join(pluginBase, b)).mtimeMs - statSync(join(pluginBase, a)).mtimeMs;
				} catch {
					return 0;
				}
			});
		return hashes[0] ? join(pluginBase, hashes[0]) : null;
	} catch {
		return null;
	}
}

/**
 * Extract skill/command/agent metadata from a plugin directory.
 */
function extractPluginMeta(pluginDir) {
	const meta = { skills: [], commands: [], agents: [] };
	const pluginJsonPath = join(pluginDir, ".claude-plugin", "plugin.json");

	try {
		const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf8"));

		// Extract skills
		if (pluginJson.skills) {
			for (const skill of pluginJson.skills) {
				meta.skills.push({
					name: skill.name ?? skill,
					description: skill.description ?? "",
				});
			}
		}

		// Extract commands
		if (pluginJson.commands) {
			for (const cmd of pluginJson.commands) {
				meta.commands.push({
					name: cmd.name ?? cmd,
					description: cmd.description ?? "",
				});
			}
		}

		// Extract agents
		if (pluginJson.agents) {
			for (const agent of pluginJson.agents) {
				meta.agents.push({
					name: agent.name ?? agent,
					description: agent.description ?? "",
				});
			}
		}
	} catch {
		// Plugin json not readable — skip
	}

	return meta;
}

async function main() {
	// 1. Scan enabled plugins
	const plugins = getEnabledPlugins();
	const baseline = {};

	for (const plugin of plugins) {
		const dir = findPluginDir(plugin.marketplace, plugin.name);
		if (!dir) continue;
		const meta = extractPluginMeta(dir);
		baseline[`${plugin.name}@${plugin.marketplace}`] = meta;
	}

	// 2. Read overrides
	let overrides = {
		capabilities: {},
		disabled: [],
		maxPerEvent: 3,
		sessionDedup: true,
		debug: false,
	};
	try {
		overrides = { ...overrides, ...JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) };
	} catch {
		// No overrides file — use defaults
	}

	// 3. Build merged cache
	const cache = {
		generatedAt: new Date().toISOString(),
		pluginCount: plugins.length,
		baseline,
		capabilities: overrides.capabilities,
		disabled: overrides.disabled,
		maxPerEvent: overrides.maxPerEvent,
		sessionDedup: overrides.sessionDedup,
		debug: overrides.debug,
	};

	// 4. Ensure cache directory exists and write cache atomically
	const cacheDir = dirname(CACHE_PATH);
	if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
	atomicWrite(CACHE_PATH, JSON.stringify(cache, null, 2));

	if (overrides.debug) {
		console.error(
			`[usertrust-laws] Scanned ${plugins.length} plugins, ${Object.keys(overrides.capabilities).length} capabilities configured`,
		);
	}
}

main().catch((err) => {
	console.error(`[usertrust-laws] Scanner error: ${err.message}`);
	// Don't exit non-zero — scanner failure shouldn't block session start
});
