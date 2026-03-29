"use client";

import { AnimatedBlueprint } from "./animated-blueprint";
import { LifecycleBlueprint } from "./lifecycle-blueprint";
import { ScrollReveal } from "./scroll-reveal";

/* ------------------------------------------------------------------ */
/*  Flow connector — vertical arrow between pipeline stages            */
/* ------------------------------------------------------------------ */
function FlowConnector({
	label,
	sublabel,
}: {
	label: string;
	sublabel?: string;
}) {
	return (
		<div className="flex flex-col items-center py-5 sm:py-8">
			<div className="w-px h-5 bg-gradient-to-b from-white/[0.06] to-white/[0.12]" />
			<div className="py-2.5 px-4 sm:px-6 text-center">
				<span className="text-[10px] sm:text-[11px] font-mono tracking-[0.12em] text-white/40 block">
					{label}
				</span>
				{sublabel && (
					<span className="text-[9px] font-mono text-white/25 block mt-0.5">{sublabel}</span>
				)}
			</div>
			<svg width="10" height="16" className="text-white/25" role="img" aria-label="Flow arrow">
				<path d="M5,0 L5,11 M2,8 L5,14 L8,8" stroke="currentColor" strokeWidth="0.75" fill="none" />
			</svg>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Architectural annotation block                                     */
/* ------------------------------------------------------------------ */
function ArchAnnotation({
	receives,
	outputs,
	detail,
	constraint,
}: {
	receives: string;
	outputs: string;
	detail?: string;
	constraint: string;
}) {
	return (
		<div className="space-y-3">
			<div>
				<span className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/35 block mb-1">
					Receives
				</span>
				<p className="text-white/50 font-mono text-xs leading-relaxed">{receives}</p>
			</div>
			<div>
				<span className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/35 block mb-1">
					Outputs
				</span>
				<p className="text-white/50 font-mono text-xs leading-relaxed">{outputs}</p>
			</div>
			{detail && <p className="text-white/30 text-xs leading-relaxed italic">{detail}</p>}
			<div>
				<span className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/25 block mb-1">
					Must Never
				</span>
				<p className="text-white/30 font-mono text-[10px] leading-relaxed">{constraint}</p>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Page section                                                       */
/* ------------------------------------------------------------------ */
export function HowItWorks() {
	return (
		<section id="how" className="relative py-24 sm:py-32 px-4 sm:px-6">
			<div className="max-w-5xl mx-auto">
				{/* Header */}
				<div className="text-center mb-12 sm:mb-20">
					<ScrollReveal>
						<div className="flex items-center gap-4 mb-3">
							<div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
							<span className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/40">
								Under the hood
							</span>
							<div className="h-px flex-1 bg-gradient-to-l from-white/[0.06] to-transparent" />
						</div>
					</ScrollReveal>
					<ScrollReveal delay={0.1}>
						<h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
							The two-phase lifecycle
						</h2>
					</ScrollReveal>
					<ScrollReveal delay={0.2}>
						<p className="text-base text-white/60 max-w-2xl mx-auto leading-relaxed">
							Every trust() call follows the same settlement pattern used by payment networks
							worldwide. No step may be skipped.
						</p>
					</ScrollReveal>
					{/* Inline flow summary */}
					<ScrollReveal delay={0.3}>
						<div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-mono text-white/30 mt-4">
							{["PENDING", "EXECUTE", "POST / VOID", "RECEIPT"].map((label, i) => (
								<span key={label} className="flex items-center gap-2">
									<span>{label}</span>
									{i < 3 && <span>→</span>}
								</span>
							))}
						</div>
					</ScrollReveal>
				</div>

				{/* ── PENDING (wide: blueprint left, annotation right) ── */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start mb-2">
					<AnimatedBlueprint phaseId="pending">
						<LifecycleBlueprint phaseId="pending" />
					</AnimatedBlueprint>
					<div>
						<ScrollReveal>
							<div className="flex items-center gap-2.5 mb-1">
								<h3 className="text-2xl font-semibold text-white">PENDING</h3>
								<span className="w-2 h-2 rounded-full bg-warning opacity-25 shrink-0" />
							</div>
							<p className="text-xs font-mono tracking-wide uppercase text-white/30 mb-5">
								Budget hold creation
							</p>
							<ArchAnnotation
								receives="trust(client) call with estimated cost from pricing table"
								outputs="transferId (u128) + PENDING hold on user's budget"
								detail="Double-entry debit from AVAILABLE, credit to RESERVED. Same pattern banks use for credit card holds."
								constraint="Execute the LLM call, skip budget verification, allow negative balances"
							/>
						</ScrollReveal>
					</div>
				</div>

				<FlowConnector
					label="transferId + PENDING hold + estimatedCost"
					sublabel="Hold is active — budget reserved before execution"
				/>

				{/* ── EXECUTE (wide reversed: annotation left, blueprint right) ── */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start mb-2">
					<div className="order-2 lg:order-1">
						<ScrollReveal>
							<div className="flex items-center gap-2.5 mb-1">
								<h3 className="text-2xl font-semibold text-white">EXECUTE</h3>
								<span className="w-2 h-2 rounded-full bg-tim opacity-25 shrink-0" />
							</div>
							<p className="text-xs font-mono tracking-wide uppercase text-white/30 mb-5">
								Policy gate + LLM call
							</p>
							<ArchAnnotation
								receives="ActionRequest with active budget hold"
								outputs="LLM Response + usage metrics (input/output tokens)"
								detail="Policy gate evaluates PII, model allowlist, rate limits, and spend limits before forwarding to the provider."
								constraint="Forward without a PENDING hold, bypass policy evaluation, cache responses"
							/>
						</ScrollReveal>
					</div>
					<div className="order-1 lg:order-2">
						<AnimatedBlueprint phaseId="execute">
							<LifecycleBlueprint phaseId="execute" />
						</AnimatedBlueprint>
					</div>
				</div>

				<FlowConnector
					label="LLM Response + usage (tokens, latency)"
					sublabel="Branches to POST (success) or VOID (failure)"
				/>

				{/* ── POST + VOID (pair) ── */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-12 sm:gap-16 mb-2">
					{/* POST */}
					<div>
						<AnimatedBlueprint phaseId="post" className="mb-6">
							<LifecycleBlueprint phaseId="post" />
						</AnimatedBlueprint>
						<ScrollReveal>
							<div className="flex items-center gap-2.5 mb-1">
								<h3 className="text-xl font-semibold text-white">POST</h3>
								<span className="w-1.5 h-1.5 rounded-full bg-ut opacity-25 shrink-0" />
							</div>
							<p className="text-xs font-mono tracking-wide uppercase text-white/30 mb-5">
								Settlement on success
							</p>
							<ArchAnnotation
								receives="Successful LLM response with token usage"
								outputs="Settled hold + governance receipt + audit chain entry"
								detail="Actual cost calculated from token usage × pricing. Delta refund if overestimated. Hash-chained to all prior events."
								constraint="Settle without a preceding PENDING, skip audit chain append"
							/>
						</ScrollReveal>
					</div>

					{/* VOID */}
					<div>
						<AnimatedBlueprint phaseId="void" className="mb-6">
							<LifecycleBlueprint phaseId="void" />
						</AnimatedBlueprint>
						<ScrollReveal>
							<div className="flex items-center gap-2.5 mb-1">
								<h3 className="text-xl font-semibold text-white">VOID</h3>
								<span className="w-1.5 h-1.5 rounded-full bg-danger opacity-25 shrink-0" />
							</div>
							<p className="text-xs font-mono tracking-wide uppercase text-white/30 mb-5">
								Release on failure
							</p>
							<ArchAnnotation
								receives="LLM failure (transient, permanent, or timeout)"
								outputs="Released hold (full refund) + error audit event"
								detail="Entire hold returned to AVAILABLE. Error classified and recorded. DLQ fallback if audit write fails after void."
								constraint="Charge partial amounts on failure, suppress errors, skip DLQ"
							/>
						</ScrollReveal>
					</div>
				</div>

				{/* POST ↔ VOID badge */}
				<div className="flex items-center justify-center py-2 mb-2">
					<span className="text-[9px] font-mono tracking-[0.1em] text-white/30 border border-white/[0.08] rounded px-2.5 py-1">
						POST xor VOID : exactly one outcome per transferId · never both
					</span>
				</div>

				<FlowConnector
					label="GovernanceReceipt + auditHash"
					sublabel="Immutable proof of settlement or release"
				/>

				{/* ── RECEIPT (wide: blueprint left, annotation right) ── */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
					<AnimatedBlueprint phaseId="receipt">
						<LifecycleBlueprint phaseId="receipt" />
					</AnimatedBlueprint>
					<div>
						<ScrollReveal>
							<div className="flex items-center gap-2.5 mb-1">
								<h3 className="text-2xl font-semibold text-white">RECEIPT</h3>
								<span className="w-2 h-2 rounded-full bg-mem opacity-25 shrink-0" />
							</div>
							<p className="text-xs font-mono tracking-wide uppercase text-white/30 mb-5">
								Hash-chained audit proof
							</p>
							<ArchAnnotation
								receives="Settlement or void outcome from POST/VOID phase"
								outputs="GovernanceReceipt (transferId, cost, settled, auditHash, model)"
								detail="Each receipt's SHA-256 hash covers the previous event's hash. Chain starts from GENESIS_HASH (64 zeros). Tamper-evident by construction."
								constraint="Modify historical receipts, break the hash chain, skip the GENESIS anchor"
							/>
						</ScrollReveal>
					</div>
				</div>

				{/* ── CONNECTION INDEX ── */}
				<div className="mt-16 sm:mt-24">
					<div className="flex items-center gap-4 mb-8">
						<div className="h-px flex-1 bg-gradient-to-r from-white/[0.04] to-transparent" />
						<span className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/40">
							Connection Index
						</span>
						<div className="h-px flex-1 bg-gradient-to-l from-white/[0.04] to-transparent" />
					</div>

					<ScrollReveal>
						<div className="max-w-2xl mx-auto">
							<div className="space-y-2 mb-6">
								{[
									{
										from: "PENDING",
										to: "EXECUTE",
										label: "transferId + budget hold + estimatedCost",
									},
									{
										from: "EXECUTE",
										to: "POST",
										label: "LLM success + token usage",
									},
									{
										from: "EXECUTE",
										to: "VOID",
										label: "LLM failure + error classification",
									},
									{
										from: "POST",
										to: "RECEIPT",
										label: "settled hold + actual cost + audit hash",
									},
									{
										from: "VOID",
										to: "RECEIPT",
										label: "voided hold + error event + audit hash",
									},
								].map((flow) => (
									<div
										key={`${flow.from}-${flow.to}`}
										className="flex items-baseline gap-2 text-[11px] font-mono"
									>
										<span className="text-white/45">{flow.from}</span>
										<span className="text-white/25">→</span>
										<span className="text-white/45">{flow.to}</span>
										<span className="text-white/30 ml-1">{flow.label}</span>
									</div>
								))}
							</div>

							<div className="h-px bg-white/[0.06] mb-6" />

							<div className="space-y-2">
								{[
									{
										system: "TigerBeetle",
										role: "double-entry ledger, two-phase transfers",
									},
									{
										system: "Audit Chain",
										role: "SHA-256 hash-linked JSONL, Merkle proofs",
									},
									{
										system: "Policy Gate",
										role: "12 operators, PII detection, scope globs",
									},
								].map((sys) => (
									<div key={sys.system} className="flex items-baseline gap-2 text-[11px] font-mono">
										<span className="text-white/45">{sys.system}</span>
										<span className="text-white/25">—</span>
										<span className="text-white/30">{sys.role}</span>
									</div>
								))}
							</div>

							<p className="text-[10px] font-mono text-white/20 text-center mt-8">
								5 PHASES · 3 STORAGE SYSTEMS · 1 UNIVERSAL JOIN KEY (transferId)
							</p>
						</div>
					</ScrollReveal>
				</div>
			</div>
		</section>
	);
}
