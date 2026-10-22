import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";
import type { Attribution, SeriesPoint } from "@/data/kausa";

const W = 720;
const H = 260;
const PAD = { top: 20, right: 16, bottom: 28, left: 44 };

function scaleY(v: number, min: number, max: number) {
  const t = (v - min) / (max - min || 1);
  return PAD.top + (1 - t) * (H - PAD.top - PAD.bottom);
}

function compactNum(v: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}

export function ActualVsExpected({ data }: { data: SeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { min, max, xAt } = useMemo(() => {
    const all = data.flatMap((d) => [d.actual, d.expected, d.lo, d.hi]);
    const lo = Math.min(...all) * 0.96;
    const hi = Math.max(...all) * 1.04;
    const step = (W - PAD.left - PAD.right) / Math.max(data.length - 1, 1);
    return {
      min: lo,
      max: hi,
      xAt: (i: number) => PAD.left + i * step,
    };
  }, [data]);

  if (!data || data.length < 2) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-ink-faint">
        Not enough days in this window to plot actual versus expected.
      </div>
    );
  }

  const expectedPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${scaleY(d.expected, min, max)}`)
    .join(" ");
  const actualPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${scaleY(d.actual, min, max)}`)
    .join(" ");
  const bandTop = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${scaleY(d.hi, min, max)}`).join(" ");
  const bandBottom = [...data]
    .reverse()
    .map((d, i) => `L ${xAt(data.length - 1 - i)} ${scaleY(d.lo, min, max)}`)
    .join(" ");

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Actual versus expected net sales with prediction interval"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="band-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c6cff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#7c6cff" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + t * (H - PAD.top - PAD.bottom);
          const value = max - t * (max - min);
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#20242f" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="fill-ink-faint text-[9px]">
                {compactNum(value)}
              </text>
            </g>
          );
        })}

        <motion.path
          d={`${bandTop} ${bandBottom} Z`}
          fill="url(#band-gradient)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1, delay: 0.4 }}
        />
        <motion.path
          d={expectedPath}
          fill="none"
          stroke="#8b8d98"
          strokeWidth={1.6}
          strokeDasharray="5 5"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1.3, ease: "easeInOut", delay: 0.15 }}
        />
        <motion.path
          d={actualPath}
          fill="none"
          stroke="#7c6cff"
          strokeWidth={2.4}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {data.map((d, i) => (
          <g key={d.date}>
            <rect
              x={xAt(i) - (W - PAD.left - PAD.right) / (data.length - 1) / 2}
              y={PAD.top}
              width={(W - PAD.left - PAD.right) / (data.length - 1)}
              height={H - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            <circle cx={xAt(i)} cy={scaleY(d.actual, min, max)} r={2.2} fill="#7c6cff" />
          </g>
        ))}

        {hover !== null && (
          <line
            x1={xAt(hover)}
            x2={xAt(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="#7c6cff"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        )}

        {data.map((d, i) =>
          i % 3 === 0 ? (
            <text
              key={d.date}
              x={xAt(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-ink-faint text-[9px]"
            >
              {d.date}
            </text>
          ) : null
        )}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-accent" /> Actual
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-ink-faint [border-top:1px_dashed]" /> Expected
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-accent/20" /> 80% interval
        </span>
        {hovered && (
          <span className="ml-auto tabular text-ink">
            {hovered.date} · actual {formatCurrency(hovered.actual, { compact: true })} · expected{" "}
            {formatCurrency(hovered.expected, { compact: true })}
          </span>
        )}
      </div>
    </div>
  );
}

export function Waterfall({ items, start, end }: { items: Attribution[]; start: number; end: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const barW = 74;
  const gap = 18;
  const total = items.length + 2;
  const chartW = total * (barW + gap);
  const max = start;
  const min = end * 0.94;

  let running = start;
  const bars = items.map((it) => {
    const from = running;
    const to = running + it.contribution;
    running = to;
    return { it, from, to };
  });

  const yOf = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return 24 + (1 - t) * 240;
  };

  return (
    <div className="relative w-full overflow-x-auto">
      <svg viewBox={`0 0 ${chartW + 20} 300`} className="min-w-[720px] w-full" role="img" aria-label="Contribution waterfall from expected to actual">
        <defs>
          <linearGradient id="wf-end" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e9eaf0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e9eaf0" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        <motion.g
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ type: "spring", stiffness: 130, damping: 10, delay: 0 }}
        >
          <motion.g
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
          >
            <rect x={10} y={yOf(start)} width={barW} height={yOf(min) - yOf(start)} rx={6} fill="url(#wf-end)" opacity={0.85} />
            <text x={10 + barW / 2} y={yOf(start) - 8} textAnchor="middle" className="fill-ink text-[10px]">
              {formatCurrency(start, { compact: true })}
            </text>
            <text x={10 + barW / 2} y={292} textAnchor="middle" className="fill-ink-faint text-[10px]">
              Expected
            </text>
          </motion.g>
        </motion.g>

        {bars.map((b, i) => {
          const x = 10 + (i + 1) * (barW + gap);
          const yTop = yOf(Math.max(b.from, b.to));
          const yBot = yOf(Math.min(b.from, b.to));
          const height = Math.max(yBot - yTop, 2);
          const isHover = hover === i;
          return (
            <motion.g
              key={b.it.key}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 130, damping: 9, delay: 0.1 + i * 0.08 }}
            >
              <motion.g
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
              >
                <rect
                  x={x}
                  y={yTop}
                  width={barW}
                  height={height}
                  rx={6}
                  fill={b.it.color}
                  opacity={isHover ? 1 : 0.82}
                />
                <text x={x + barW / 2} y={yOf(Math.max(b.from, b.to)) - 8} textAnchor="middle" className="fill-ink text-[10px]">
                  {formatCurrency(b.it.contribution, { compact: true })}
                </text>
                <text x={x + barW / 2} y={292} textAnchor="middle" className="fill-ink-faint text-[10px]">
                  {b.it.group.length > 12 ? b.it.group.split(" ")[0] : b.it.group}
                </text>
              </motion.g>
            </motion.g>
          );
        })}

        <motion.g
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ type: "spring", stiffness: 130, damping: 10, delay: (items.length + 1) * 0.08 }}
        >
          <motion.g
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: (items.length + 1) * 0.2 }}
          >
            <rect x={10 + (items.length + 1) * (barW + gap)} y={yOf(end)} width={barW} height={yOf(min) - yOf(end)} rx={6} fill="url(#wf-end)" opacity={0.85} />
            <text x={10 + (items.length + 1) * (barW + gap) + barW / 2} y={yOf(end) - 8} textAnchor="middle" className="fill-ink text-[10px]">
              {formatCurrency(end, { compact: true })}
            </text>
            <text x={10 + (items.length + 1) * (barW + gap) + barW / 2} y={292} textAnchor="middle" className="fill-ink-faint text-[10px]">
              Actual
            </text>
          </motion.g>
        </motion.g>
      </svg>

      {hover !== null && (
        <div className="mt-2 rounded-lg border border-line bg-base-850 px-3 py-2 text-xs text-ink-muted">
          <span className="font-medium text-ink">{items[hover].group}</span> ·{" "}
          {formatCurrency(items[hover].contribution, { compact: true })} · 80% interval [
          {formatCurrency(items[hover].interval[0], { compact: true })},{" "}
          {formatCurrency(items[hover].interval[1], { compact: true })}] ·{" "}
          <span className="capitalize">{items[hover].evidenceStatus}</span>
        </div>
      )}
    </div>
  );
}

export function ContributionRanking({ items }: { items: (Attribution & { status?: string })[] }) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.contribution)), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.key} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3">
          <span className="truncate text-sm text-ink-muted">{it.group}</span>
          <div className="relative h-2.5 w-full rounded-full bg-white/[0.04]">
            <motion.div
              className={cn("absolute inset-y-0 left-0 rounded-full")}
              style={{
                background: it.color,
                opacity: it.kind === "unexplained" ? 0.7 : 1,
              }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(Math.abs(it.contribution) / maxAbs) * 100}%` }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="tabular w-24 text-right text-sm text-ink">
            {formatCurrency(it.contribution, { compact: true })}
          </span>
        </div>
      ))}
    </div>
  );
}
