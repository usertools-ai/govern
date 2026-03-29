"use client";

import { ScrollReveal } from "./scroll-reveal";

const stepColorStyles = {
	ut: {
		border: "border-ut/30",
		hoverBorder: "hover:border-ut/50",
		text: "text-ut",
		bg: "rgba(52,211,153,0.06)",
	},
	tim: {
		border: "border-tim/30",
		hoverBorder: "hover:border-tim/50",
		text: "text-tim",
		bg: "rgba(108,160,192,0.06)",
	},
	mem: {
		border: "border-mem/30",
		hoverBorder: "hover:border-mem/50",
		text: "text-mem",
		bg: "rgba(192,132,252,0.06)",
	},
	warning: {
		border: "border-warning/30",
		hoverBorder: "hover:border-warning/50",
		text: "text-warning",
		bg: "rgba(245,158,11,0.06)",
	},
	danger: {
		border: "border-danger/30",
		hoverBorder: "hover:border-danger/50",
		text: "text-danger",
		bg: "rgba(239,68,68,0.06)",
	},
} as const;

type StepColor = keyof typeof stepColorStyles;

export function HowItWorks() {
	return (
		<section id="how" className="relative py-24 sm:py-32 px-6">
			<div className="max-w-5xl mx-auto flex flex-col gap-12">
				{/* Header */}
				<div className="flex flex-col gap-4 max-w-xl">
					<ScrollReveal>
						<p className="text-xs font-mono font-medium text-ut uppercase tracking-widest">
							Under the hood
						</p>
					</ScrollReveal>
					<ScrollReveal delay={0.1}>
						<h2 className="text-3xl sm:text-4xl font-bold leading-tight">
							The two-phase lifecycle
						</h2>
					</ScrollReveal>
					<ScrollReveal delay={0.2}>
						<p className="text-base text-white/60 leading-relaxed">
							Every trust() call follows the same settlement pattern used by
							payment networks worldwide.
						</p>
					</ScrollReveal>
				</div>

				{/* Lifecycle flow */}
				<ScrollReveal delay={0.3}>
					<div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
						<StepCard
							label="PENDING"
							description="Budget hold created. Tokens reserved before execution begins."
							color="warning"
						/>

						<Arrow />

						<StepCard
							label="EXECUTE"
							description="LLM call runs. Policy gate already checked. Hold is active."
							color="tim"
						/>

						<Arrow />

						<div className="flex-1 flex flex-col gap-3">
							<StepCard
								label="POST"
								description="Success. Hold settled. Receipt generated with audit hash."
								color="ut"
							/>
							<StepCard
								label="VOID"
								description="Failure. Hold released. No charge. Error recorded in audit trail."
								color="danger"
							/>
						</div>

						<Arrow />

						<StepCard
							label="RECEIPT"
							description="Immutable proof of settlement. Hash-chained to every prior call."
							color="mem"
						/>
					</div>
				</ScrollReveal>
			</div>
		</section>
	);
}

function StepCard({
	label,
	description,
	color,
}: {
	label: string;
	description: string;
	color: StepColor;
}) {
	const s = stepColorStyles[color];
	return (
		<div
			className={`flex-1 flex flex-col gap-2 p-5 rounded-xl border ${s.border} ${s.hoverBorder} transition-colors duration-200`}
			style={{ background: s.bg }}
		>
			<span
				className={`font-mono text-xs font-semibold ${s.text} uppercase tracking-widest`}
			>
				{label}
			</span>
			<p className="text-sm text-white/60 leading-snug">{description}</p>
		</div>
	);
}

function Arrow() {
	return (
		<div
			className="hidden lg:flex items-center justify-center text-white/20 text-xl shrink-0"
			aria-hidden="true"
		>
			→
		</div>
	);
}
