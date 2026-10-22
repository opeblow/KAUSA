import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { MovingBorder } from "@/components/ui/moving-border";

const links = [
  { label: "How it works", href: "#how" },
  { label: "Evidence", href: "#proof" },
  { label: "Methodology", href: "/app/methodology" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-base-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" aria-label="Kausa home">
          <Brand />
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) =>
            l.href.startsWith("#") ? (
              <a key={l.label} href={l.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
                {l.label}
              </a>
            ) : (
              <Link key={l.label} to={l.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
                {l.label}
              </Link>
            )
          )}
        </div>
        <Link to="/app/workspace" aria-label="Open the live demo">
          <MovingBorder duration={2600}>
            <span className="text-sm">Open live demo</span>
            <span aria-hidden className="text-accent-soft">→</span>
          </MovingBorder>
        </Link>
      </nav>
    </header>
  );
}
