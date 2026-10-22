import { Link } from "react-router-dom";
import { ShieldCheck, FlaskConical, Database, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ScrollBeam, TimelineItem } from "@/components/ui/timeline";
import { Chip } from "@/components/StatusPill";
import { Lamp } from "@/components/ui/lamp";
import { glossary } from "@/data/kausa";

const anchors = [
  { id: "approach", label: "Approach" },
  { id: "verify", label: "Verification" },
  { id: "limits", label: "Limits" },
  { id: "sources", label: "Data" },
  { id: "glossary", label: "Glossary" },
];

export function Methodology() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Methodology"
        title="How Kausa reasons, and what it cannot claim"
        description="A plain-language account of the approach, its assumptions and its limits. Results are evidence-weighted explanations, not proof of causation."
      />

      <nav className="mt-6 flex flex-wrap gap-2">
        {anchors.map((a) => (
          <a
            key={a.id}
            href={`#${a.id}`}
            className="rounded-full border border-line bg-white/[0.02] px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            {a.label}
          </a>
        ))}
      </nav>

      <section id="approach" className="mt-14 scroll-mt-24">
        <Lamp className="items-start">
          <h2 className="text-2xl font-light text-gradient">Approach</h2>
        </Lamp>
        <div className="mt-8">
          <ScrollBeam>
            <TimelineItem index={1} title="Estimate what would have happened">
              Kausa builds a weekday seasonal-naive baseline from your comparison window — the expected value
              for each day of the analysis window is the average of the same weekday in the comparison period.
              This removes normal weekly rhythm before the gap is measured.
            </TimelineItem>
            <TimelineItem index={2} title="Measure the gap honestly">
              The gap is actual minus expected over the window, with a 90% interval from the comparison-window
              residual spread. If the interval crosses zero, the change is within normal variation and Kausa
              says so rather than inventing a cause.
            </TimelineItem>
            <TimelineItem index={3} title="Split the gap across your drivers">
              Kausa fits an ordinary-least-squares regression of the metric on the numeric driver columns you
              uploaded (plus an intercept and weekday terms). Each driver's contribution is its coefficient times
              the change in that driver's mean between the two windows, scaled by the number of days. Whatever is
              left over is reported as an explicit unexplained remainder.
            </TimelineItem>
            <TimelineItem index={4} title="Explain only from computed numbers">
              A Narrator writes the verdict prose from the computed numbers only. A runtime verifier parses every
              number in the narrative and compares it to the claim ledger; a mismatch triggers a fallback to a
              deterministic template.
            </TimelineItem>
          </ScrollBeam>
        </div>
      </section>

      <section id="verify" className="mt-16 scroll-mt-24">
        <h2 className="text-2xl font-light text-gradient">Verification</h2>
        <p className="mt-3 text-sm text-ink-muted">
          Every figure Kausa reports is stored as a claim: its value, interval, the query over your data, the
          calculation steps, and the code and data versions behind it. Open any number in a verdict to inspect
          the claim that produced it.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Metric
            icon={<FlaskConical className="size-4 text-accent-soft" />}
            label="Numbers from"
            value="Your data"
            target="computed in code, never by the model"
            tone="positive"
          />
          <Metric
            icon={<Database className="size-4 text-accent-soft" />}
            label="Evidence"
            value="Claim ledger"
            target="query, rows and steps stored per figure"
            tone="positive"
          />
          <Metric
            icon={<ShieldCheck className="size-4 text-accent-soft" />}
            label="Narration check"
            value="Runtime verifier"
            target="rejects prose that disagrees with the ledger"
            tone="positive"
          />
          <Metric
            icon={<FlaskConical className="size-4 text-accent-soft" />}
            label="Fallback"
            value="Template"
            target="deterministic wording when verification fails"
            tone="positive"
          />
        </div>
      </section>

      <section id="limits" className="mt-16 scroll-mt-24">
        <h2 className="text-2xl font-light text-gradient">Assumptions and limits</h2>
        <div className="mt-5 flex flex-col gap-3">
          {[
            "We report evidence-weighted explanations, not causal proof. A regression association is not causation.",
            "A factor that is absent from your columns cannot be attributed; it lands in the unexplained remainder.",
            "The weekday baseline assumes the comparison window is representative of normal conditions for the same weekdays.",
            "Contributions use a linear model, so non-linear or interacting effects may be understated.",
            "Attribution is only as good as the driver columns you upload. More relevant drivers sharpen the split.",
          ].map((t) => (
            <p key={t} className="rounded-xl border border-line bg-white/[0.02] p-4 text-sm text-ink-muted">
              {t}
            </p>
          ))}
        </div>
      </section>

      <section id="sources" className="mt-16 scroll-mt-24">
        <h2 className="text-2xl font-light text-gradient">Data</h2>
        <div className="mt-5 flex flex-col gap-3">
          <SourceRow
            name="Your uploaded files"
            role="Source of truth"
            note="CSV, TSV or Excel with a date column and numeric metric/driver columns. Parsed and stored privately to your account."
          />
          <SourceRow
            name="Zetaris AI Data Harness"
            role="Federated query"
            note="When configured, the per-day aggregate slice is read through Zetaris SQL federation — one statement across warehouse, lake and APIs — rather than only the local store."
          />
          <SourceRow
            name="Convex file storage & database"
            role="Persistence"
            note="Datasets, investigations and claims are stored per user with authentication. Nothing is shared between accounts."
          />
          <SourceRow
            name="NVIDIA Nemotron via NIM"
            role="Narration"
            note="Default narrator. Receives only compact computed summaries — never your raw rows — to write the verdict prose."
          />
          <SourceRow
            name="SpaceXAI Grok · Meterless Runtime"
            role="Narration alternates"
            note="Drop-in narration backends behind the same interface. Kausa uses whichever provider is configured, in order, and records the one that wrote the verdict."
          />
          <SourceRow
            name="Meterless H-MEM engine"
            role="Durable memory"
            note="A Convex-native port of Meterless's H-MEM memory engine. Kausa mines durable facts from each investigation and recalls the most relevant ones into the next, ranked by a hybrid of semantic, keyword, tag, domain, entity, layer and recency signals, with feedback and a trust ledger. Recalled context is stripped of digits so it can never bypass the number firewall."
          />
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-faint">
          <Database className="size-3.5" /> Your data is private to your account and never sent to the model as
          raw rows.
        </p>
      </section>

      <section id="glossary" className="mt-16 scroll-mt-24">
        <h2 className="flex items-center gap-2 text-2xl font-light text-ink">
          <BookOpen className="size-5 text-ink-muted" /> Glossary
        </h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {glossary.map((g) => (
            <div key={g.term} className="rounded-xl border border-line bg-white/[0.02] p-4">
              <dt className="text-sm text-ink">{g.term}</dt>
              <dd className="mt-1 text-xs text-ink-muted">{g.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-16 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-base-900/50 p-6">
        <Chip tone="accent">Evidence, not proof</Chip>
        <p className="text-sm text-ink-muted">
          Run an investigation to see every claim behind the answer.{" "}
          <Link to="/app/ask" className="text-accent-soft hover:underline">
            Ask a question →
          </Link>
        </p>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  target,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  target: string;
  tone: "positive" | "warning";
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-xs text-ink-faint">
        {icon} {label}
      </div>
      <p className="mt-3 tabular text-2xl font-light text-ink">{value}</p>
      <p className={tone === "positive" ? "mt-1 text-xs text-positive" : "mt-1 text-xs text-warning"}>
        {target}
      </p>
    </div>
  );
}

function SourceRow({ name, role, note }: { name: string; role: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-ink">{name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{note}</p>
      </div>
      <Chip>{role}</Chip>
    </div>
  );
}
