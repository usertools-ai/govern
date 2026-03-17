// @usertools/govern — AI Financial Governance SDK

// Core
export { govern } from "./govern.js";
export type { GovernOpts, GovernedClient } from "./govern.js";

// Config
export { loadConfig, defineConfig } from "./config.js";

// Types
export type {
	GovernedResponse,
	GovernanceReceipt,
	GovernConfig,
	PolicyRule,
	FieldCondition,
	BoardDecision,
	AuditEvent,
	LLMClientKind,
} from "./shared/types.js";

// Errors
export {
	InsufficientBalanceError,
	PolicyDeniedError,
	LedgerUnavailableError,
	AuditDegradedError,
	VaultNotInitializedError,
} from "./shared/errors.js";
