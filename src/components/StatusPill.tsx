import { cn } from "@/lib/utils";
import type { HypothesisStatus } from "@/data/kausa";

const styles: Record<HypothesisStatus, string> = {
  queued: "text-ink-faint border-line bg-white/[0.02]",
  testing: "text-accent-soft border-accent/30 bg-accent/10",
  supported: "text-positive border-positive/30 bg-positive/10",
  weak: "text-warning border-warning/30 bg-warning/10",
  refuted: "text-negative border-negative/30 bg-negative/10",
  untestable: "text-ink-faint border-line bg-white/[0.02]",
};

const dotStyles: Record<HypothesisStatus, string> = {
  queued: "bg-ink-faint",
  testing: "bg-accent animate-pulse",
  supported: "bg-positive",
  weak: "bg-warning",
  refuted: "bg-negative",
  untestable: "bg-ink-faint",
};

const labels: Record<HypothesisStatus, string> = {
  queued: "Queued",
  testing: "Testing",
  supported: "Supported",
  weak: "Weak",
  refuted: "Refuted",
  untestable: "Untestable",
};

export function StatusPill({
  status,
  className,
}: {
  status: HypothesisStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        styles[status],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotStyles[status])} />
      {labels[status]}
    </span>
  );
}

export function Chip({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "accent" | "positive" | "warning" | "negative";
}) {
  const tones = {
    neutral: "border-line bg-white/[0.02] text-ink-muted",
    accent: "border-accent/30 bg-accent/10 text-accent-soft",
    positive: "border-positive/30 bg-positive/10 text-positive",
    warning: "border-warning/30 bg-warning/10 text-warning",
    negative: "border-negative/30 bg-negative/10 text-negative",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
