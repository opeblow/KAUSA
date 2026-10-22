import { cn } from "@/lib/utils";

export function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 100,
}: {
  children: React.ReactNode;
  className?: string;
  shimmerWidth?: number;
}) {
  return (
    <span
      style={{ "--shiny-width": `${shimmerWidth}px` } as React.CSSProperties}
      className={cn(
        "mx-auto max-w-md text-ink-muted/90",
        "animate-shiny-text bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shiny-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",
        "bg-gradient-to-r from-transparent via-white/70 to-transparent",
        className
      )}
    >
      {children}
    </span>
  );
}
