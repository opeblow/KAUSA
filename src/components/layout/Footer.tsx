import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";

export function Footer() {
  return (
    <footer className="border-t border-line/60 bg-base-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm text-ink-muted">
            An investigative agent for business metrics. It tests competing explanations against your
            data and shows the evidence — including what it ruled out.
          </p>
        </div>
        <FooterCol
          title="Product"
          items={[
            { label: "Workspace", to: "/app/workspace" },
            { label: "Overview", to: "/app/overview" },
            { label: "Ask", to: "/app/ask" },
            { label: "Missions", to: "/app/missions" },
          ]}
        />
        <FooterCol
          title="Trust"
          items={[
            { label: "Methodology", to: "/app/methodology" },
            { label: "Evidence ledger", to: "/app/verdict" },
            { label: "Security", to: "/app/methodology" },
          ]}
        />
        <FooterCol
          title="Stack"
          items={[
            { label: "Zetaris · federation", to: "/app/methodology" },
            { label: "NVIDIA · narration", to: "/app/methodology" },
            { label: "SpaceXAI · narration", to: "/app/methodology" },
            { label: "Meterless · H-MEM memory", to: "/app/memory" },
          ]}
        />
      </div>
      <div className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-ink-faint md:flex-row md:items-center">
          <p>Kausa is a working name. Sample data is derived from public retail datasets and is illustrative.</p>
          <p>Evidence-weighted explanations, not proof of causation.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wider text-ink-faint">{title}</h4>
      <ul className="mt-4 flex flex-col gap-2.5">
        {items.map((i) => (
          <li key={i.label}>
            <Link to={i.to} className="text-sm text-ink-muted transition-colors hover:text-ink">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
