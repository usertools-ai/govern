"use client";

import { ScrollReveal } from "./scroll-reveal";

const colorStyles = {
	ut: {
		hover: "hover:border-ut/25",
		iconBg: "bg-ut/20",
		icon: "bg-ut",
	},
	mem: {
		hover: "hover:border-mem/25",
		iconBg: "bg-mem/20",
		icon: "bg-mem",
	},
	tim: {
		hover: "hover:border-tim/25",
		iconBg: "bg-tim/20",
		icon: "bg-tim",
	},
	warning: {
		hover: "hover:border-warning/25",
		iconBg: "bg-warning/20",
		icon: "bg-warning",
	},
	danger: {
		hover: "hover:border-danger/25",
		iconBg: "bg-danger/20",
		icon: "bg-danger",
	},
} as const;

type ColorKey = keyof typeof colorStyles;

const cards: { title: string; description: string; color: ColorKey }[] = [
	{
		title: "Two-phase settlement",
		description:
			"Budget held before execution. Settled on success. Voided on failure. Like a credit card hold at a gas pump.",
		color: "ut",
	},
	{
		title: "Policy engine",
		description:
			"Spend limits, model allowlists, PII blocking, rate limits. Enforced before the call — not after.",
		color: "mem",
	},
	{
		title: "Hash-chained audit",
		description:
			"Every transaction links to its predecessor via SHA-256. Tamper-evident by construction. SOC 2 ready.",
		color: "tim",
	},
	{
		title: "Bring your own keys",
		description:
			"Keep your API keys. Keep your billing. trust() wraps your existing client — zero migration, zero lock-in.",
		color: "warning",
	},
	{
		title: "Apache 2.0 licensed",
		description:
			"Run locally with JSON receipts. No account needed. No SaaS dependency. Read every line of code.",
		color: "danger",
	},
	{
		title: "Three lines to ship",
		description:
			"Import, wrap, done. No config files, no dashboard setup, no SDK initialization ceremony.",
		color: "ut",
	},
];

export function Features() {
	return (
		<section id="features" className="relative py-24 sm:py-32 px-6">
			<div className="max-w-5xl mx-auto flex flex-col gap-12">
				{/* Header */}
				<div className="flex flex-col gap-4 max-w-xl">
					<ScrollReveal>
						<p className="text-xs font-mono font-medium text-ut uppercase tracking-widest">
							What you get
						</p>
					</ScrollReveal>
					<ScrollReveal delay={0.1}>
						<h2 className="text-3xl sm:text-4xl font-bold leading-tight">
							Not observability.
							<br />
							Governance.
						</h2>
					</ScrollReveal>
					<ScrollReveal delay={0.2}>
						<p className="text-base text-white/60 leading-relaxed">
							Observability tells you what happened. Governance prevents what shouldn&apos;t.
						</p>
					</ScrollReveal>
				</div>

				{/* Cards grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{cards.map((card, i) => {
						const styles = colorStyles[card.color];
						return (
							<ScrollReveal key={card.title} delay={i * 0.1}>
								<div
									className={`group flex flex-col gap-4 p-7 rounded-xl border border-white/[0.08] ${styles.hover} hover:bg-white/[0.03] transition-all duration-200`}
									style={{ background: "rgba(255,255,255,0.02)" }}
								>
									<div
										className={`w-8 h-8 rounded-md ${styles.iconBg} flex items-center justify-center`}
									>
										<div className={`w-3 h-3 rounded-sm ${styles.icon}`} />
									</div>
									<div className="flex flex-col gap-1.5">
										<h3 className="font-semibold text-white text-base">{card.title}</h3>
										<p className="text-sm text-white/55 leading-relaxed">{card.description}</p>
									</div>
								</div>
							</ScrollReveal>
						);
					})}
				</div>
			</div>
		</section>
	);
}
