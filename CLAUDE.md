# usertrust

Open-source AI financial governance SDK. Wraps any LLM client (Anthropic, OpenAI, Google) with a JS Proxy so every AI call becomes an immutable, auditable, double-entry financial transaction.

## Architecture Invariants

These are load-bearing. Violating any one breaks the system.

- **Two-phase spend lifecycle** — Every LLM call follows PENDING hold -> LLM call -> POST (success) or VOID (failure). No LLM call executes without a PENDING hold first. This is the same pattern banks use.
- **SHA-256 hash-chained audit trail** — Append-only JSONL. Each event's hash covers the previous event's hash via deterministic canonicalization (sorted keys, stripped `undefined`). The first event chains from GENESIS_HASH (64 zeros). Tamper-evident by construction.
- **Merkle proofs (RFC 6962)** — Domain-separated hashing (0x00 leaf prefix, 0x01 internal prefix). Inclusion and consistency proofs for public verifiability. Odd leaves are promoted (NOT duplicated) to avoid CVE-2012-2459.
- **TigerBeetle ledger** — Real double-entry accounting with 7 transfer codes (PURCHASE, SPEND, TRANSFER, REFUND, ALLOCATION, TOOL_CALL, A2A_DELEGATION). Not a counter.
- **`usertrust-verify` is zero-dependency** — Intentionally duplicates `canonicalize()`, `verifyChain()`, `buildMerkleTree()`, and all Merkle proof functions. Do NOT import from `usertrust`. Only uses Node built-ins (`node:crypto`, `node:fs`, `node:path`).
- **Duck-typed client detection** — `trust()` identifies LLM SDKs by structural shape (Anthropic: `client.messages.create`, OpenAI: `client.chat.completions.create`, Google: `client.models.generateContent`). Never import provider SDKs directly.
- **Dead-letter queue** — On audit write failure after TigerBeetle success, write to DLQ (fsync'd JSONL). Never throw on audit degradation after the LLM call succeeds.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node 22, ESM (`"type": "module"`) |
| Language | TypeScript 5.9 — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Ledger | TigerBeetle (tigerbeetle-node ^0.16) |
| Validation | Zod ^3.23 |
| Policy | YAML (yaml ^2.7) + minimatch ^10 for glob matching |
| Linter | Biome — **tabs** (not spaces), 100-char line width. Fix: `npx biome check --write .` |
| Test | Vitest 4 — `globals: false`. Run: `npx vitest run` from repo root |
| Monorepo | npm workspaces |
| CI | GitHub Actions on ubuntu-latest (lint + typecheck + test). Codex review on PRs. |

## Packages

| Package | Purpose | LOC | Dependencies |
|---------|---------|-----|-------------|
| `usertrust` | SDK — proxy wrapper, ledger, audit, policy, board, circuit breaker, patterns | ~6,400 source | tigerbeetle-node, minimatch, zod, yaml |
| `usertrust-verify` | Standalone vault verifier | ~600 source | **ZERO** (Node built-ins only) |

## Layout

```
packages/core/
├── src/
│   ├── index.ts              # Public API barrel (trust, defineConfig, errors, types)
│   ├── govern.ts             # trust() — the convergence point. Two-phase lifecycle, proxy builders
│   ├── config.ts             # loadConfig(), defineConfig() — reads usertrust.config.json
│   ├── detect.ts             # detectClientKind() — duck typing for Anthropic/OpenAI/Google
│   ├── proxy.ts              # ProxyConnection — remote governance (stub for v1)
│   ├── streaming.ts          # GovernedStream — per-provider token accumulation for streaming
│   ├── audit/
│   │   ├── chain.ts          # AuditWriter — SHA-256 hash-chained JSONL with advisory lock + async mutex
│   │   ├── canonical.ts      # canonicalize() — deterministic JSON for hash computation
│   │   ├── entropy.ts        # 6 entropy signals for governance health diagnostics
│   │   ├── merkle.ts         # RFC 6962 Merkle tree — build, inclusion proofs, consistency proofs
│   │   ├── rotation.ts       # Daily-rotated audit receipts with bounded index
│   │   └── verify.ts         # verifyChain() — linear hash chain verification
│   ├── board/
│   │   ├── board.ts          # Board of Directors — 2 Directors, democratic oversight
│   │   ├── concerns.ts       # 6 concern detectors (hallucination, bias, safety, scope_creep, resource_abuse, policy_violation)
│   │   └── director.ts       # Director Alpha/Beta — heuristic review, NOT LLM calls
│   ├── cli/
│   │   ├── main.ts           # CLI entry: init, inspect, health, verify, snapshot, tb
│   │   ├── init.ts           # `usertrust init` — creates .usertrust/ vault
│   │   ├── inspect.ts        # `usertrust inspect` — vault bank statement
│   │   ├── health.ts         # `usertrust health` — entropy diagnostics
│   │   ├── verify.ts         # `usertrust verify` — chain integrity check
│   │   ├── snapshot.ts       # `usertrust snapshot` — checkpoint/restore
│   │   └── tb.ts             # `usertrust tb` — TigerBeetle process management
│   ├── ledger/
│   │   ├── client.ts         # TrustTBClient — TigerBeetle CRUD with reconnect logic
│   │   ├── engine.ts         # TrustEngine — two-phase spend with DLQ fallback
│   │   └── pricing.ts        # 20-model pricing table (usertokens per 1K LLM tokens)
│   ├── memory/
│   │   └── patterns.ts       # Pattern memory — prompt hash -> model -> cost -> success routing
│   ├── policy/
│   │   ├── gate.ts           # PolicyGate — 12 field operators, scope globs, time windows
│   │   ├── pii.ts            # PII detector — email, phone, SSN, credit card (Luhn), IPv4
│   │   ├── decay.ts          # Exponential decay rate calculator for time-weighted budgets
│   │   └── default-rules.ts  # 3 default rules (zero-budget, high-cost, budget-exhausted)
│   ├── resilience/
│   │   ├── circuit.ts        # CircuitBreaker + Registry — per-provider failure isolation
│   │   └── scope.ts          # ScopeManager — minimatch lease management for parallel workers
│   ├── shared/
│   │   ├── constants.ts      # GENESIS_HASH, VAULT_DIR, AUDIT_DIR, DEFAULT_BUDGET
│   │   ├── errors.ts         # 7 domain errors (InsufficientBalance, PolicyDenied, LedgerUnavailable, etc.)
│   │   ├── ids.ts            # tbId() (u128 bigint), trustId() (string), fnv1a32()
│   │   └── types.ts          # TrustConfig (Zod schema), GovernanceReceipt, PolicyRule, AuditEvent, etc.
│   └── snapshot/
│       └── checkpoint.ts     # Vault snapshot — create, restore, list
├── tests/                    # Mirrors src/ structure — 38 test files
├── bin/
│   └── govern.ts             # CLI shebang entry point
└── package.json

packages/verify/
├── src/
│   ├── index.ts              # Public API — verifyVault(), verifyChain(), Merkle proofs
│   ├── verify.ts             # Zero-dep chain verifier + Merkle (INTENTIONAL DUPLICATION)
│   ├── canonical.ts          # Zero-dep canonicalize (INTENTIONAL DUPLICATION)
│   └── constants.ts          # GENESIS_HASH
├── tests/
│   └── verify.test.ts
├── bin/
│   └── verify.ts             # CLI shebang entry point
└── package.json
```

## TypeScript Strictness

This project uses aggressive settings. Code that ignores these will fail typecheck.

- **`noUncheckedIndexedAccess`**: `arr[0]` returns `T | undefined`. Always narrow before use.
- **`exactOptionalPropertyTypes`**: `prop?: string` means the key may not exist — not that it can be `undefined`. To unset: use `delete obj.prop` or conditional spread `...(val !== undefined ? { prop: val } : {})`. Never `obj.prop = undefined`.
- **ESM only**: `import`/`export` everywhere. No `require()`. File extensions required in imports (`.js` suffix even for `.ts` sources, per NodeNext resolution).

## Coding Patterns

### The `trust()` Function

The core API. Async factory that returns a Proxy-wrapped client.

```typescript
import { trust } from "usertrust";

// trust() is async
const client = await trust(new Anthropic(), { dryRun: true, budget: 50_000 });

// Returns { response, governance } — NOT response._governance
const { response, governance } = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});

// REQUIRED — process hangs without this
await client.destroy();
```

### Two-Phase Spend (the critical pattern)

Every governed LLM call uses a hold-then-settle flow inside `govern.ts`. Do not skip this.

```typescript
// 1. PENDING — reserve tokens atomically
await engine.spendPending({ transferId, amount: estimatedCost });
try {
  // 2. Forward to LLM SDK
  const response = await originalFn.apply(thisArg, args);
  // 3. POST — settle the hold
  await engine.postPendingSpend(transferId);
  return { response, governance: receipt };
} catch (err) {
  // 4. VOID — release the hold
  await engine.voidPendingSpend(transferId);
  throw err;
}
```

### Five Failure Modes (Spec Section 15)

All five are tested in `tests/govern/failure-modes.test.ts`:

1. **15.1** — LLM succeeds, POST fails: `settled: false`, `settlement_ambiguous` audit event
2. **15.2** — LLM fails (retryable): VOID pending hold, propagate error
3. **15.3** — Audit write fails after POST: `auditDegraded` flag, still return response (never fail the user)
4. **15.4** — TigerBeetle unreachable: throw `LedgerUnavailableError`, do NOT forward to provider
5. **Streaming failure** — Stream error: VOID pending hold, reject governance promise

### Error Classes

Throw domain errors from `shared/errors.ts`. Seven error classes:

```typescript
InsufficientBalanceError(userId, required, available)  // budget exceeded
PolicyDeniedError(reason)                               // policy gate or PII block
AccountNotFoundError(userId)                            // no TB account
IdempotencyConflictError(key)                           // duplicate transfer
LedgerUnavailableError(reason)                          // TB unreachable
AuditDegradedError(reason)                              // audit chain write failure
VaultNotInitializedError(path)                          // no .usertrust/ vault
```

### ID Generation

```typescript
import { tbId, trustId, fnv1a32 } from "./shared/ids.js";
tbId()            // bigint — time-ordered u128, for TigerBeetle accounts/transfers
trustId("tx")     // string — "tx_<base36timestamp>_<hex>", for audit/receipts
fnv1a32("str")    // number — FNV-1a 32-bit hash, for user_data_32 fingerprints
```

### Config

Config file is `usertrust.config.json` (JSON, NOT TypeScript). Located at `.usertrust/usertrust.config.json`. Validated by `TrustConfigSchema` (Zod). `defineConfig()` is a type-checking helper only.

Key config fields: `budget`, `tier` (free/mini/pro/mega/ultra), `pii` (redact/warn/block/off), `board.enabled`, `board.vetoThreshold`, `circuitBreaker.failureThreshold`, `circuitBreaker.resetTimeout`, `patterns.enabled`, `audit.rotation` (daily/weekly/none), `audit.indexLimit`, `tigerbeetle.addresses`, `tigerbeetle.clusterId`.

### Dry-Run Mode

Set `dryRun: true` in options or `USERTRUST_DRY_RUN=true` env var. Skips TigerBeetle entirely — audit chain and policy engine still run. Use in CI/testing.

### Pattern Memory

Never stores raw prompts — only SHA-256 hashes. Memory file: `.usertrust/patterns/memory.json`. Capped at 10,000 entries (FIFO eviction). `suggestModel()` scores by `successRate / avgCost`.

### Board of Directors

Two directors with complementary focus areas. Pure heuristic pattern matching — no LLM calls.

- **Director Alpha**: hallucination, safety, policy_violation
- **Director Beta**: bias, scope_creep, resource_abuse

Decision matrix: Both APPROVE -> approved. Unanimous VETO -> blocked. VETO + APPROVE -> escalated. Both ABSTAIN -> escalated.

### Policy Gate

12 field operators: `exists`, `not_exists`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `regex`. Rules loaded from YAML or JSON. Dot-notation field resolution. Glob-based scope matching via minimatch. Time-window constraints.

Hard enforcement -> deny. Soft enforcement -> warn (allow with warnings).

### Vault Structure

```
.usertrust/
├── usertrust.config.json    # Config
├── audit/
│   ├── events.jsonl         # Hash-chained audit log
│   ├── events.jsonl.meta    # Last hash + sequence sidecar
│   ├── index.json           # Bounded receipt index
│   └── <kind>/<YYYY-MM-DD>/ # Daily-rotated receipts
├── board/
│   ├── session.json         # Board session state
│   └── history.jsonl        # Board review history
├── policies/
│   └── default.yml          # Policy rules
├── patterns/
│   └── memory.json          # Prompt hash -> model -> cost patterns
├── leases.json              # Scope lock leases
├── snapshots/               # Checkpoint/restore snapshots
├── dlq/
│   └── dead-letters.jsonl   # Dead-letter queue (fsync'd)
└── tigerbeetle/             # TB data (git-ignored)
```

## Testing

979 tests, 38 files. 2.09:1 test-to-source ratio. Run from repo root:

```bash
npx vitest run                 # all tests
npx vitest run --coverage      # with coverage report
npx vitest run tests/govern/   # specific directory
npx vitest run -t "pattern"    # by test name pattern
```

### Coverage Thresholds (enforced in CI)

| Metric | Global | Critical Tier (ledger/, audit/) |
|--------|--------|-------------------------------|
| Lines | 92%+ | 95%+ |
| Branches | 85%+ | 90%+ |
| Functions | 90%+ | — |

### Test Conventions

- **`globals: false`** — Always import `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` from `vitest`.
- **Mock TigerBeetle** — `vi.mock("tigerbeetle-node", ...)` at module level in every test file that touches the ledger. TB is a native module and never loads in tests.
- **Temp vaults** — Create isolated temp directories with `mkdirSync(join(tmpdir(), "trust-test-" + randomUUID()))`. Clean up in `afterEach` with `rmSync(dir, { recursive: true, force: true })`.
- **Inject test engines** — Use `trust(client, { _engine: mockEngine, _audit: mockAudit, dryRun: true, vaultBase: tmpDir })` to inject mock subsystems.
- **All 5 failure modes tested** — `tests/govern/failure-modes.test.ts` covers every combination.
- **All 12 policy operators tested** — `tests/policy/gate.test.ts` has positive, negative, and edge-case tests for each operator.
- **Destroy after each test** — Always call `client.destroy()` to prevent process hangs and lock file leaks.

### Test File Organization

Tests mirror `src/` structure under `tests/`:

```
tests/
├── audit/          # chain, canonical, entropy, merkle, rotation, verify
├── board/          # board, concerns
├── cli/            # init, inspect, health, verify, snapshot, tb, security
├── e2e/            # Full trust() end-to-end
├── govern/         # config, destroy, detect, dry-run, failure-modes, govern, proxy, streaming
├── ledger/         # client, engine, pricing
├── memory/         # patterns
├── policy/         # decay, gate, pii
├── resilience/     # circuit, scope
├── shared/         # errors, ids
└── snapshot/       # checkpoint
```

## CLI Commands

```bash
npx usertrust init       # Create .usertrust/ vault
npx usertrust inspect    # Show vault bank statement
npx usertrust health     # Entropy diagnostics (6 signals, 0-100 score)
npx usertrust verify     # Verify audit chain integrity
npx usertrust snapshot   # Checkpoint/restore vault state
npx usertrust tb         # TigerBeetle process management

npx usertrust-verify .usertrust # Standalone zero-dep vault verification
```

## CI

Three required status checks on PRs to `master`:

1. **lint** — `npx biome check .`
2. **typecheck** — `npx tsc -b --noEmit`
3. **test** — `npx vitest run --coverage` with threshold enforcement

Codex review runs on PR open/sync (separate workflow, `ubuntu-latest`, uses `OPENAI_API_KEY` secret).

## Agent Workflow (Boris Cherny)

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### Task Management
1. **Plan First**: Write plan to tasks/todo.md with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to tasks/todo.md
6. **Capture Lessons**: Update tasks/lessons.md after corrections

### Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. No side effects with new bugs.

## Rules

1. **`usertrust-verify` must remain ZERO dependency.** Code is intentionally duplicated from `usertrust`. Do NOT add imports. Do NOT refactor into a shared package.
2. **Never store raw prompts** — only SHA-256 hashes in pattern memory. Privacy by construction.
3. **Two-phase lifecycle is non-negotiable.** No LLM call without a PENDING hold. No POST without a preceding PENDING. VOID on every failure path.
4. **`trust()` must work with any LLM SDK via duck typing.** Do not import `@anthropic-ai/sdk`, `openai`, or `@google/generative-ai` directly in `usertrust` source code. They are optional peer dependencies.
5. **Audit chain integrity must be verifiable by `usertrust-verify` independently.** Changes to canonicalization, hashing, or event format must be mirrored in both packages.
6. **Board uses heuristic detection, NOT LLM calls.** The 6 concern detectors are pure functions. Do not add API calls to the board module.
7. **All changes must go through PR with passing CI.** Branch protection enforces lint + typecheck + test.
8. **Test-to-source ratio must stay above 1.65:1** (financial infrastructure standard). Current: 2.09:1.
9. **Report ALL test failures** — not just new ones. Run the full suite, report every failure with file:line.
10. **`transferId` is the universal join key** across the ledger, audit chain, and receipts. Do not create parallel ID schemes.

## Lineage

This SDK converges code from three upstream repos. When reading source, comments reference the origin:

| Module | Origin Repo | Origin File |
|--------|------------|-------------|
| Ledger (client, engine) | usertools-stealth | `token-engine/tb-client.ts`, `engine.ts` |
| Audit (chain, verify, merkle) | usertools-stealth | `governance/audit/writer.ts`, `verifier.ts` |
| Policy gate | turf | `policy-gate.ts` |
| Board of Directors | turf | `governance audit.ts` |
| Audit rotation | turf | `governance audit.ts` |
| PII detector | field project/fermion | `higgs/pii-detector.ts` |
| Decay calculator | field project/fermion | `higgs/decay-rate.ts` |
| Circuit breaker | field project/fermion | resilience module |
| Entropy diagnostics | field project/fermion | `neutrino/entropy.ts` |

## Pricing

All costs are in **usertokens** (UT). 1 UT = $0.0001 (one basis point of a cent). Pricing table in `ledger/pricing.ts` covers 20 models. Unknown models fall back to sonnet-class pricing (30 input / 150 output per 1K tokens). `estimateCost()` always returns at least 1 (floor to prevent zero-amount transfers).
