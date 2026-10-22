import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/section-label";
import { BlurFade } from "@/components/ui/blur-fade";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <BlurFade inView={false} duration={0.5}>
      <div
        className={cn(
          "relative flex flex-col gap-5 border-b border-line/60 pb-8 sm:flex-row sm:items-end sm:justify-between",
          className
        )}
      >
        <div className="min-w-0">
          {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
          <h1 className="mt-4 text-[2rem] font-light tracking-tight text-gradient sm:text-[2.4rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
    </BlurFade>
  );
}
