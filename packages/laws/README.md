# @usertrust/laws

AI-powered dev-time governance for Claude Code. Quality gates, continuous code review, debug analysis, and scaffolding -- the rules your AI agents can't break.

Laws is a Claude Code plugin that intercepts tool calls and prompts at key moments, routing them through multi-model AI ensembles to catch bugs, enforce standards, and accelerate development.

## What Laws Does

| Capability | Hook | Mode | What It Does |
|---|---|---|---|
| `gate:quality` | PreToolUse (git commit, PR create) | **Block** | Runs tsc + biome, then dual-model vote. Blocks commits that fail. |
| `review:code` | PostToolUse (Write/Edit) | Advisory | Triple-model async code review. Debounced -- triggers after N edits. |
| `observe:debug` | PostToolUse (Bash exit!=0) | Inject | Dual-model root cause analysis on command failures. |
| `scaffold:route` | PreToolUse (Write routes) | Inject | Reads sibling files, generates pattern-aware guidance. |
| `scaffold:test` | PreToolUse (Write tests) | Inject | Same as above, scoped to test file conventions. |

## Installation

```bash
# Install the plugin via Claude Code
claude plugin install @usertrust/laws
```

Or manually: clone this repo and symlink `packages/laws/` into your Claude Code plugins directory.

## Configuration

1. Copy the template to your project:

```bash
mkdir -p .usertrust
cp node_modules/@usertrust/laws/capabilities.template.json .usertrust/capabilities.json
```

2. Set your API key:

```bash
export USERTRUST_API_KEY="your-proxy-api-key"
```

3. (Optional) Customize project context for better results:

```bash
export USERTRUST_PROJECT_NAME="my-app"
export USERTRUST_PROJECT_DESC="A Next.js e-commerce platform with Stripe integration"
export USERTRUST_PROJECT_CONTEXT="TypeScript 5.9 strict, Next.js App Router, Prisma ORM, Tailwind CSS"
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `USERTRUST_API_KEY` | _(falls back to `USERTOOLS_API_KEY`)_ | API key for the governance proxy |
| `USERTRUST_PROXY_URL` | `https://proxy.usertools.ai/v1/chat/completions` | Proxy endpoint URL |
| `USERTRUST_PROJECT_NAME` | `"this project"` | Project name used in model prompts |
| `USERTRUST_PROJECT_DESC` | `"A software project"` | One-line project description for the router |
| `USERTRUST_PROJECT_CONTEXT` | `"TypeScript project with strict mode enabled."` | Stack/convention details for review and debug prompts |
| `USERTRUST_STATE_DIR` | `.usertrust/.capability-state` | Directory for session state (edits, reviews, pending jobs) |
| `USERTRUST_CACHE_PATH` | `.usertrust/.capability-cache.json` | Path to the merged capability cache |
| `USERTRUST_CAPABILITIES_PATH` | `.usertrust/capabilities.json` | Path to capability overrides file |
| `USERTRUST_SCAFFOLD_ROUTE_CONTEXT` | _(generic)_ | Custom context for route scaffolding |
| `USERTRUST_SCAFFOLD_TEST_CONTEXT` | _(generic)_ | Custom context for test scaffolding |
| `USERTRUST_SCAFFOLD_PROVIDER_CONTEXT` | _(generic)_ | Custom context for provider scaffolding |

## Kill Switch

Disable all governance hooks instantly:

```bash
export CAPABILITY_DISPATCHER_DISABLED=1
```

## Capability Modes

- **block** -- Prevents the tool call from proceeding (exit code 2). Used by `gate:quality`.
- **advisory** -- Results are injected into the conversation on the next event. Used by `review:code`.
- **inject** -- Results are injected immediately into the current event. Used by `observe:debug` and `scaffold:*`.

## How It Works

1. **SessionStart**: `capability-scan.mjs` reads your `.usertrust/capabilities.json`, scans installed plugins, and writes a merged cache.
2. **On each hook event**: `capability-dispatch.mjs` reads the cache, matches triggers against the current tool/prompt, and dispatches to the appropriate controller.
3. **Controllers** call the UserTrust proxy with redacted context, parse multi-model responses, and return structured output.

All prompts are redacted before leaving your machine -- secrets, tokens, JWTs, connection strings, and env vars are stripped by `redact.mjs`.

## trust() vs Laws

| | `trust()` (SDK) | `@usertrust/laws` (Plugin) |
|---|---|---|
| **What** | Runtime governance for LLM API calls | Dev-time governance for Claude Code sessions |
| **How** | JS Proxy wrapping Anthropic/OpenAI/Google clients | Claude Code hooks intercepting tool calls |
| **When** | Your app calls an LLM | An AI agent writes/edits/runs code |
| **Ledger** | TigerBeetle double-entry accounting | N/A (stateless quality gates) |
| **Audit** | SHA-256 hash-chained JSONL | Session state files |

Use both together: `trust()` governs your production AI calls, Laws governs your development AI agents.

## File Structure

```
packages/laws/
  package.json
  .claude-plugin/plugin.json
  hooks/
    hooks.json                        # Event registrations
    capability-scan.mjs               # SessionStart scanner
    capability-dispatch.mjs           # Main dispatcher
    capability-controllers/
      redact.mjs                      # Secret redaction
      proxy-client.mjs                # Proxy API client
      state.mjs                       # Atomic session state
      route.mjs                       # Keyword prefilter + LLM router
      gate-quality.mjs                # Quality gate (block mode)
      review-code.mjs                 # Triple-model code review (async)
      observe-debug.mjs               # Dual-model debug analysis
      scaffold.mjs                    # Context-aware scaffolding
  capabilities.template.json          # Default capability config
```

## License

MIT
