"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

/* ─── Nav ─────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.1 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 sm:px-10"
    >
      {/* Logo pill */}
      <a
        href="#"
        className="rounded-full bg-white/[0.06] border border-white/[0.1] px-4 py-1.5 text-sm font-medium text-[var(--text-primary)] backdrop-blur-sm hover:bg-white/[0.1] transition-all"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        usertrust
      </a>

      {/* Nav links — hidden on mobile */}
      <div className="hidden sm:flex items-center gap-6">
        <a
          href="#code"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Code
        </a>
        <a
          href="#features"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Features
        </a>
        <a
          href="#how"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          How it works
        </a>
        <a
          href="https://github.com/usertools/usertrust"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.1] px-4 py-1.5 text-sm text-[var(--text-primary)] backdrop-blur-sm hover:bg-white/[0.1] transition-all"
        >
          <GitHubIcon className="w-4 h-4" />
          GitHub
        </a>
      </div>

      {/* Mobile GitHub only */}
      <a
        href="https://github.com/usertools/usertrust"
        target="_blank"
        rel="noopener noreferrer"
        className="sm:hidden flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.1] px-4 py-1.5 text-sm text-[var(--text-primary)] backdrop-blur-sm hover:bg-white/[0.1] transition-all"
      >
        <GitHubIcon className="w-4 h-4" />
      </a>
    </motion.nav>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────── */

function Hero() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText("npm install usertrust").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="relative min-h-screen overflow-hidden flex items-start justify-start pt-[18vh]">
      {/* Bliss background with Ken Burns */}
      <div
        className="absolute inset-0 z-0"
        style={{
          animation: "ken-burns 30s ease-in-out infinite alternate",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bliss.jpg"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
      </div>

      {/* Glass content pane */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-6 sm:px-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.0, delay: 0.2 }}
          className="rounded-2xl px-8 py-10 sm:px-12 sm:py-14"
          style={{
            background: "rgba(10,10,26,0.35)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 0 80px rgba(10,10,26,0.3)",
          }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3 }}
          >
            <span className="inline-block rounded-full bg-white/[0.06] border border-white/[0.1] px-3 py-1 text-xs text-[var(--text-secondary)]">
              Open source &middot; Apache 2.0
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight"
          >
            <span
              className="text-[var(--accent-ut)]"
              style={{
                fontFamily: "var(--font-mono)",
                textShadow:
                  "0 0 60px rgba(52,211,153,0.4), 0 0 120px rgba(52,211,153,0.15), 0 0 80px rgba(0,0,0,0.8), 0 4px 40px rgba(0,0,0,0.6)",
              }}
            >
              trust()
            </span>{" "}
            <span
              style={{
                textShadow:
                  "0 0 80px rgba(0,0,0,0.8), 0 4px 40px rgba(0,0,0,0.6)",
              }}
            >
              your AI spend
            </span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.0 }}
            className="mt-4 text-base sm:text-lg text-[var(--text-secondary)] max-w-lg leading-relaxed"
          >
            Budget holds, audit trails, and spend limits for every LLM call.
            Keep your keys, keep your billing. Add trust in one line.
          </motion.p>

          {/* Install command */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.3 }}
            className="mt-8"
          >
            <button
              onClick={handleCopy}
              className="group flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.08] px-5 py-3 backdrop-blur-sm hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              <span className="text-[var(--text-tertiary)] text-sm">$</span>
              <code
                className="text-sm text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                npm install usertrust
              </code>
              <span className="ml-2 text-xs text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">
                {copied ? "copied!" : "copy"}
              </span>
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* Hero-to-body gradient transition */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a1a] to-transparent z-10" />
    </section>
  );
}

/* ─── Section 1: Code ─────────────────────────────────────────────── */

function CodeSection() {
  return (
    <section id="code" className="py-24 sm:py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent-ut)] mb-3">
            One line
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Wrap any client. Keep your keys.
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="mt-4 text-[var(--text-secondary)] text-base sm:text-lg max-w-xl leading-relaxed">
            Your API keys. Your billing. Your provider. trust() adds budget
            holds and audit trails on top — nothing changes except now you have
            control.
          </p>
        </ScrollReveal>

        {/* Code block */}
        <ScrollReveal delay={0.3}>
          <div className="mt-10 rounded-2xl bg-white/[0.02] border border-white/[0.08] p-6 sm:p-8 overflow-x-auto">
            <pre
              className="text-sm sm:text-base leading-relaxed"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <code>
                <span className="text-[#C084FC]">import</span>
                <span className="text-white/90"> {"{ "}</span>
                <span className="text-[#6CA0C0]">trust</span>
                <span className="text-white/90">{" }"} </span>
                <span className="text-[#C084FC]">from</span>
                <span className="text-[#34D399]"> &quot;usertrust&quot;</span>
                {"\n"}
                <span className="text-[#C084FC]">import</span>
                <span className="text-white/90"> Anthropic </span>
                <span className="text-[#C084FC]">from</span>
                <span className="text-[#34D399]">
                  {" "}
                  &quot;@anthropic-ai/sdk&quot;
                </span>
                {"\n\n"}
                <span className="text-white/30">
                  {"// Your keys. Your billing. Now trusted."}
                </span>
                {"\n"}
                <span className="text-[#C084FC]">const</span>
                <span className="text-white/90"> client = </span>
                <span className="text-[#C084FC]">await</span>
                <span className="text-white/90"> </span>
                <span className="text-[#6CA0C0]">trust</span>
                <span className="text-white/90">(</span>
                <span className="text-[#C084FC]">new</span>
                <span className="text-white/90"> Anthropic())</span>
                {"\n\n"}
                <span className="text-[#C084FC]">const</span>
                <span className="text-white/90">
                  {" "}
                  {"{ response, receipt }"} ={" "}
                </span>
                <span className="text-[#C084FC]">await</span>
                <span className="text-white/90"> client.</span>
                <span className="text-[#6CA0C0]">messages.create</span>
                <span className="text-white/90">({"{"}</span>
                {"\n"}
                <span className="text-white/90">{"  "}model: </span>
                <span className="text-[#34D399]">
                  &quot;claude-sonnet-4-20250514&quot;
                </span>
                <span className="text-white/90">,</span>
                {"\n"}
                <span className="text-white/90">
                  {"  "}messages: [{"{ "}role:{" "}
                </span>
                <span className="text-[#34D399]">&quot;user&quot;</span>
                <span className="text-white/90">, content: </span>
                <span className="text-[#34D399]">&quot;Hello&quot;</span>
                <span className="text-white/90">{" }"}]</span>
                {"\n"}
                <span className="text-white/90">{"}"})</span>
                {"\n\n"}
                <span className="text-white/90">receipt.</span>
                <span className="text-[#6CA0C0]">auditHash</span>
                <span className="text-white/30">
                  {"       // SHA-256 hash-chained audit link"}
                </span>
                {"\n"}
                <span className="text-white/90">receipt.</span>
                <span className="text-[#6CA0C0]">cost</span>
                <span className="text-white/30">
                  {"            // 0.0032"}
                </span>
                {"\n"}
                <span className="text-white/90">receipt.</span>
                <span className="text-[#6CA0C0]">settled</span>
                <span className="text-white/30">
                  {"         // true"}
                </span>
                {"\n"}
                <span className="text-white/90">receipt.</span>
                <span className="text-[#6CA0C0]">model</span>
                <span className="text-white/30">
                  {"           // \"claude-sonnet-4-20250514\""}
                </span>
              </code>
            </pre>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* ─── Section 2: Features ─────────────────────────────────────────── */

const features = [
  {
    color: "var(--accent-ut)",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
    title: "Two-phase settlement",
    desc: "Budget held before execution. Settled on success. Voided on failure. Like a credit card hold at a gas pump.",
  },
  {
    color: "var(--accent-mem)",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
        />
      </svg>
    ),
    title: "Policy engine",
    desc: "Spend limits, model allowlists, PII blocking, rate limits. Enforced before the call — not after.",
  },
  {
    color: "var(--accent-tim)",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
        />
      </svg>
    ),
    title: "Hash-chained audit",
    desc: "Every transaction links to its predecessor via SHA-256. Tamper-evident by construction. SOC 2 ready.",
  },
  {
    color: "var(--warning)",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
        />
      </svg>
    ),
    title: "Bring your own keys",
    desc: "Keep your API keys. Keep your billing. trust() wraps your existing client — zero migration, zero lock-in.",
  },
  {
    color: "var(--danger)",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>
    ),
    title: "Apache 2.0 licensed",
    desc: "Run locally with JSON receipts. No account needed. No SaaS dependency. Read every line of code.",
  },
  {
    color: "var(--accent-ut)",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
        />
      </svg>
    ),
    title: "Three lines to ship",
    desc: "Import, wrap, done. No config files, no dashboard setup, no SDK initialization ceremony.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <ScrollReveal>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent-ut)] mb-3">
            What you get
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Not observability. Governance.
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="mt-4 text-[var(--text-secondary)] text-base sm:text-lg max-w-xl leading-relaxed">
            Observability tells you what happened. Governance prevents what
            shouldn&apos;t.
          </p>
        </ScrollReveal>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={0.1 * i}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-6 hover:bg-white/[0.04] transition-all h-full">
                <div
                  className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center mb-4"
                  style={{ color: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 3: How It Works (lifecycle) ─────────────────────────── */

function LifecycleSection() {
  return (
    <section id="how" className="py-24 sm:py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent-ut)] mb-3">
            Under the hood
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            The two-phase lifecycle
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="mt-4 text-[var(--text-secondary)] text-base sm:text-lg max-w-xl leading-relaxed">
            Every trust() call follows the same settlement pattern used by
            payment networks worldwide.
          </p>
        </ScrollReveal>

        {/* Desktop: horizontal flow */}
        <ScrollReveal delay={0.3}>
          <div className="mt-12 hidden sm:flex items-center justify-center gap-3">
            {/* PENDING */}
            <StepPill label="PENDING" color="var(--warning)" />
            <Arrow />
            {/* EXECUTE */}
            <StepPill label="EXECUTE" color="var(--accent-tim)" />
            <Arrow />
            {/* POST / VOID branch */}
            <div className="flex flex-col items-center gap-2">
              <StepPill label="POST" color="var(--accent-ut)" />
              <span className="text-xs text-[var(--text-tertiary)]">/</span>
              <StepPill label="VOID" color="var(--danger)" />
            </div>
            <Arrow />
            {/* RECEIPT */}
            <StepPill label="RECEIPT" color="var(--accent-mem)" />
          </div>
        </ScrollReveal>

        {/* Mobile: vertical flow */}
        <ScrollReveal delay={0.3}>
          <div className="mt-12 flex sm:hidden flex-col items-center gap-3">
            <StepPill label="PENDING" color="var(--warning)" />
            <ArrowDown />
            <StepPill label="EXECUTE" color="var(--accent-tim)" />
            <ArrowDown />
            <div className="flex items-center gap-3">
              <StepPill label="POST" color="var(--accent-ut)" />
              <span className="text-xs text-[var(--text-tertiary)]">/</span>
              <StepPill label="VOID" color="var(--danger)" />
            </div>
            <ArrowDown />
            <StepPill label="RECEIPT" color="var(--accent-mem)" />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function StepPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-lg border px-4 py-2 text-xs font-semibold tracking-wider"
      style={{
        fontFamily: "var(--font-mono)",
        borderColor: color,
        color: color,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

function Arrow() {
  return (
    <svg
      className="w-6 h-6 text-[var(--text-tertiary)] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
      />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg
      className="w-6 h-6 text-[var(--text-tertiary)] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75"
      />
    </svg>
  );
}

/* ─── Section 4: BYOK ─────────────────────────────────────────────── */

const providers = [
  { name: "Anthropic", desc: "Claude SDK" },
  { name: "OpenAI", desc: "GPT SDK" },
  { name: "Google", desc: "Gemini SDK" },
  { name: "xAI", desc: "Grok SDK" },
  { name: "Groq", desc: "Fast inference" },
  { name: "+ more", desc: "Any provider" },
];

function BYOKSection() {
  return (
    <section className="py-24 sm:py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Your keys. Your billing. Our trust layer.
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <p className="mt-4 text-[var(--text-secondary)] text-base sm:text-lg max-w-xl leading-relaxed">
            trust() wraps your existing provider client. No proxy. No routing.
            No new accounts. Just trust on top of what you already use.
          </p>
        </ScrollReveal>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {providers.map((p, i) => (
            <ScrollReveal key={p.name} delay={0.08 * i}>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.08] p-4 hover:bg-white/[0.04] transition-all">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {p.name}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {p.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 5: OSS CTA ──────────────────────────────────────────── */

function CTASection() {
  return (
    <section className="py-24 sm:py-32 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Read every line
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <p className="mt-4 text-[var(--text-secondary)] text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Your trust layer shouldn&apos;t be a black box. UserTrust is open
            source under the Apache 2.0 license.
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://github.com/usertools/usertrust"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-ut)] text-[#0a0a1a] px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <GitHubIcon className="w-4 h-4" />
              View on GitHub
            </a>
            <a
              href="https://github.com/usertools/usertrust#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-transparent border border-white/[0.12] text-[var(--text-primary)] px-6 py-3 text-sm font-semibold hover:bg-white/[0.04] transition-all"
            >
              Read the docs
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* ─── Section 6: Footer ───────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-[var(--text-tertiary)]">
          usertrust &middot; part of{" "}
          <a
            href="https://usertools.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-secondary)] transition-colors"
          >
            usertools.ai
          </a>
        </p>
        <div className="flex items-center gap-5">
          <a
            href="https://userbank.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            userbank.ai
          </a>
          <a
            href="https://userintel.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            userintel.ai
          </a>
          <a
            href="https://usermemory.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            usermemory.ai
          </a>
          <a
            href="https://github.com/usertools/usertrust"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <GitHubIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─── Shared: GitHub Icon ─────────────────────────────────────────── */

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <CodeSection />
        <FeaturesSection />
        <LifecycleSection />
        <BYOKSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
