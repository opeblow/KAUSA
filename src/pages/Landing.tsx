import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Play,
  Search,
  GitBranch,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Database,
  Workflow,
  Cpu,
  Sparkles,
  Boxes,
  Zap,
} from "lucide-react";
import { SiteNav } from "@/components/layout/SiteNav";
import { Footer } from "@/components/layout/Footer";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Spotlight } from "@/components/ui/spotlight";
import { Meteors } from "@/components/ui/meteors";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import { Lamp } from "@/components/ui/lamp";
import { BorderBeam } from "@/components/ui/border-beam";
import { MagicCard, CardSpotlight } from "@/components/ui/magic-card";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { MovingBorder } from "@/components/ui/moving-border";
import { SectionLabel } from "@/components/ui/section-label";
import { Waterfall } from "@/components/charts";
import { attribution, headline } from "@/data/kausa";
import { formatCurrency } from "@/lib/utils";

export function Landing() {
  return (
    <div className="bg-base-950">
      <SiteNav />

      <AuroraBackground className="min-h-[92vh] justify-start overflow-hidden">
        <Spotlight />
        <Meteors number={16} />
        <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pt-24 pb-16 text-center">
          <BlurFade delay={0.05}>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-xs">
              <span className="size-1.5 rounded-full bg-accent" />
              <AnimatedShinyText>Open Agent Hackathon 2026 · Track 02: The Agent That Can Explain Why</AnimatedShinyText>
            </span>
          </BlurFade>

          <BlurFade delay={0.12}>
            <h1 className="mt-8 max-w-4xl text-display font-light text-gradient">
              Know why your numbers moved.
            </h1>
          </BlurFade>

          <BlurFade delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
              Kausa is an investigative agent for business metrics. Ask why sales dropped. It tests
              competing explanations against your data with real statistics — and shows the evidence,
              including the explanations it ruled out.
            </p>
          </BlurFade>

          <BlurFade delay={0.28}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link to="/app/workspace">
                <MovingBorder duration={2800}>
                  <span>Get started</span>
                  <ArrowRight className="size-4" />
                </MovingBorder>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2.5 rounded-full border border-line px-6 py-3 text-sm text-ink-muted transition-colors hover:border-line hover:bg-white/[0.03] hover:text-ink"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-white/[0.06]">
                  <Play className="size-3 fill-current" />
                </span>
                See how it works
              </a>
            </div>
          </BlurFade>

          <BlurFade delay={0.36} className="mt-4">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-ink-faint">
              <span>Upload a CSV or Excel file. Numbers come from your data, not the model.</span>
            </div>
          </BlurFade>
        </section>

        <BlurFade delay={0.4} className="relative z-10 w-full px-6 pb-24">
          <ProductFrame />
        </BlurFade>
      </AuroraBackground>

      <ProblemSection />
      <HowItWorks />
      <ProofSection />
      <TechnologySection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function ProductFrame() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-base-900/80 p-2 shadow-2xl">
        <BorderBeam size={260} duration={16} />
        <div className="rounded-[18px] border border-line/70 bg-base-950/60">
          <div className="flex items-center gap-2 border-b border-line/70 px-4 py-3">
            <span className="size-2.5 rounded-full bg-negative/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-positive/70" />
            <span className="ml-3 font-mono text-[11px] text-ink-faint">
              kausa · example verdict
            </span>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-faint">Verdict · Net sales · All stores · Sep 2024</p>
              <div className="mt-3 flex items-end gap-4">
                <span className="tabular text-5xl font-light text-ink">
                  <NumberTicker value={-8.4} decimalPlaces={1} format={(v) => `${v.toFixed(1)}%`} />
                </span>
                <span className="mb-2 text-sm text-ink-muted">
                  {formatCurrency(headline.gap, { compact: true })} vs expected · high confidence
                </span>
              </div>
              <div className="mt-6">
                <Waterfall items={attribution} start={headline.expected} end={headline.actual} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { label: "Promotion depth reduced", value: "−$186K", tone: "positive" },
                { label: "Competitor opening nearby", value: "−$98K", tone: "positive" },
                { label: "External shock (weak)", value: "−$54K", tone: "warning" },
                { label: "Weather anomaly", value: "refuted", tone: "negative" },
                { label: "Stores closed / missing days", value: "refuted", tone: "negative" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl border border-line/70 bg-white/[0.02] px-4 py-3"
                >
                  <span className="text-sm text-ink-muted">{row.label}</span>
                  <span
                    className={
                      row.tone === "positive"
                        ? "tabular text-sm text-ink"
                        : row.tone === "warning"
                        ? "tabular text-sm text-warning"
                        : "text-xs uppercase tracking-wide text-negative"
                    }
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section className="border-t border-line/60 py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-2 md:items-center">
        <BlurFade>
          <SectionLabel>The problem</SectionLabel>
          <p className="mt-6 text-headline font-light text-ink">
            Your numbers moved and the reason is scattered across six systems.
          </p>
          <p className="mt-6 max-w-md text-ink-muted">
            Sales are in the POS export. Promotions are in a calendar. Competitor activity is in a
            spreadsheet someone updates by hand. Dashboards show what happened. They never tell you
            why — and a plausible story is not an answer.
          </p>
        </BlurFade>
        <BlurFade delay={0.15}>
          <CardSpotlight className="p-8">
            <p className="text-xs uppercase tracking-wider text-ink-faint">September, all stores</p>
            <div className="mt-5 flex items-end gap-3">
              <span className="tabular text-6xl font-light text-negative">−8.4%</span>
              <span className="mb-2 text-sm text-ink-muted">net sales</span>
            </div>
            <div className="mt-6 rounded-xl border border-line/70 bg-base-950/50 p-4">
              <p className="text-sm text-ink-muted">No explanation in the dashboard.</p>
              <p className="mt-1 tabular text-sm text-ink">
                −{formatCurrency(Math.abs(headline.gap), { compact: true })} against expected.
              </p>
            </div>
            <p className="mt-5 text-xs text-ink-faint">Illustrative example, not your data.</p>
          </CardSpotlight>
        </BlurFade>
      </div>
    </section>
  );
}

const steps = [
  {
    icon: Search,
    title: "Ask",
    body: "Type a question or pick one. Kausa parses it into a structured scope — metric, entity and windows — and confirms the data covers it before spending compute.",
  },
  {
    icon: GitBranch,
    title: "Test",
    body: "Kausa estimates what would have happened from a weekday baseline of your comparison window, measures the gap, and regresses the metric on your numeric driver columns to attribute it — with a labelled unexplained remainder.",
  },
  {
    icon: CheckCircle2,
    title: "Prove",
    body: "Each claim links to its query, rows and calculation. A verifier rejects any sentence whose numbers don't match the ledger, falling back to a deterministic template if needed.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-t border-line/60 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <BlurFade className="text-center">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mx-auto mt-6 max-w-2xl text-headline font-light text-ink">
            Compute, then explain.
          </h2>
        </BlurFade>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <BlurFade key={s.title} delay={i * 0.12}>
              <MagicCard className="h-full">
                <div className="flex h-full flex-col p-7">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10">
                    <s.icon className="size-5 text-accent-soft" />
                  </div>
                  <span className="mt-6 text-xs font-mono text-ink-faint">0{i + 1}</span>
                  <h3 className="mt-1 text-xl font-medium text-ink">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">{s.body}</p>
                </div>
              </MagicCard>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProofSection() {
  return (
    <section id="proof" className="border-t border-line/60 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Lamp>
          <BlurFade className="text-center">
            <SectionLabel>Proof</SectionLabel>
            <h2 className="mx-auto mt-6 max-w-2xl text-headline font-light text-ink">
              It shows what it disproved.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-ink-muted">
              Most agents list what they found. Kausa also lists the explanations it tested and rejected,
              with the reason — and a contribution waterfall that adds up to the total change.
            </p>
          </BlurFade>
        </Lamp>

        <BlurFade delay={0.1} className="mt-14">
          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <div className="panel relative overflow-hidden p-6">
              <BorderBeam size={180} duration={18} />
              <h3 className="text-sm font-medium text-ink">What we ruled out</h3>
              <div className="mt-4 flex flex-col gap-3">
                <RefutedRow
                  title="Weather was anomalous"
                  reason="Placebo windows reproduced a similar deviation; no effect beyond normal variation."
                />
                <RefutedRow
                  title="Stores closed or sales days missing"
                  reason="Open-day coverage unchanged at 99.8% versus the comparison window."
                />
              </div>
              <div className="mt-6 rounded-xl border border-line/70 bg-base-950/50 p-4">
                <div className="flex items-center gap-2 text-xs text-positive">
                  <ShieldCheck className="size-3.5" /> Claim verifier
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  0 mismatches. Every number in the narrative was matched to the ledger within tolerance.
                </p>
              </div>
            </div>

            <div className="panel p-6">
              <h3 className="text-sm font-medium text-ink">The language model never calculates</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Numbers come from your uploaded data and statistical code. The narrator — NVIDIA
                Nemotron on NIM by default, with SpaceXAI Grok or the Meterless Runtime as drop-in
                backends — writes prose about computed results only. A runtime verifier checks every
                number against the claim ledger before it is shown.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { k: "Data access", v: "Federated query via Zetaris" },
                  { k: "Expected value", v: "Weekday seasonal-naive baseline" },
                  { k: "Attribution", v: "OLS on your numeric drivers + unexplained remainder" },
                  { k: "Narration", v: "Nemotron · Grok · Meterless (swappable)" },
                  { k: "Memory", v: "Meterless H-MEM across investigations" },
                  { k: "Verification", v: "Every number matched to the claim ledger" },
                ].map((r) => (
                  <div key={r.k} className="flex items-center justify-between border-b border-line/50 pb-2.5 text-sm last:border-0">
                    <span className="text-ink-muted">{r.k}</span>
                    <span className="text-right text-ink">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

function RefutedRow({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-xl border border-negative/20 bg-negative/[0.04] p-4">
      <div className="flex items-center gap-2">
        <XCircle className="size-4 text-negative" />
        <span className="text-sm text-ink line-through decoration-negative/40">{title}</span>
      </div>
      <p className="mt-2 pl-6 text-xs text-ink-muted">{reason}</p>
    </div>
  );
}

const tech = [
  {
    icon: Database,
    name: "Convex",
    body: "Your datasets, investigations and evidence live in one reactive, type-safe backend — database, file storage, auth and realtime updates in a single deploy.",
  },
  {
    icon: Workflow,
    name: "Zetaris AI Data Harness",
    body: "The analysis query is federated through Zetaris and reads the aggregated slice where the data lives — one SQL statement across warehouse, object store and APIs — instead of copying raw rows into the agent.",
  },
  {
    icon: Cpu,
    name: "NVIDIA Nemotron",
    body: "On NVIDIA NIM, Nemotron writes the verdict prose from the computed numbers only. A runtime verifier rejects any sentence whose numbers don't match the ledger.",
  },
  {
    icon: Sparkles,
    name: "SpaceXAI Grok",
    body: "A second narration backend behind the same interface: Kausa can draft the explanation with Grok and swap providers without touching the analysis.",
  },
  {
    icon: Boxes,
    name: "Meterless H-MEM",
    body: "Durable memory built on Meterless's H-MEM engine: Kausa mines reusable facts from each investigation and recalls the most relevant ones next time, ranked by a hybrid of semantic, keyword, tag, domain, entity, layer and recency signals — with feedback and a trust ledger.",
  },
  {
    icon: Zap,
    name: "Deterministic statistics",
    body: "Every number is computed in code over your data: a weekday baseline for expected value, a regression over your driver columns for attribution, and a stored claim for each figure.",
  },
];

function TechnologySection() {
  return (
    <section className="border-t border-line/60 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <BlurFade className="text-center">
          <SectionLabel>How it's built</SectionLabel>
          <h2 className="mx-auto mt-6 max-w-2xl text-headline font-light text-ink">
            Compute, then explain.
          </h2>
        </BlurFade>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {tech.map((t, i) => (
            <BlurFade key={t.name} delay={i * 0.1}>
              <div className="h-full rounded-2xl border border-line/70 bg-base-900/50 p-7">
                <t.icon className="size-6 text-accent-soft" />
                <h3 className="mt-5 text-lg font-medium text-ink">{t.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.body}</p>
              </div>
            </BlurFade>
          ))}
        </div>

        <BlurFade delay={0.2} className="mt-14">
          <Marquee pauseOnHover className="[--duration:36s]">
            {["Convex backend", "Zetaris federation", "Realtime updates", "File storage", "Claim ledger", "Runtime verifier", "Weekday baseline", "OLS attribution", "NVIDIA Nemotron", "SpaceXAI Grok", "Meterless H-MEM memory", "Replayable investigations", "Private workspaces"].map(
              (item) => (
                <span key={item} className="whitespace-nowrap text-sm text-ink-faint">
                  {item}
                </span>
              )
            )}
          </Marquee>
        </BlurFade>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-line/60 py-28">
      <Spotlight className="opacity-60" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto max-w-3xl px-6 text-center"
      >
        <h2 className="text-headline font-light text-ink">See it explain a real drop.</h2>
        <p className="mx-auto mt-5 max-w-xl text-ink-muted">
          Upload your own CSV or Excel file, ask a question, and watch Kausa compute the gap, test
          explanations, and open the evidence behind each number.
        </p>
        <div className="mt-9 flex justify-center">
          <Link to="/app/workspace">
            <MovingBorder duration={2800}>
              <span>Upload your data</span>
              <ArrowRight className="size-4" />
            </MovingBorder>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
