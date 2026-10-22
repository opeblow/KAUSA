import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BorderBeam } from "./border-beam";

export function BentoGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-6xl grid-cols-1 gap-4 md:auto-rows-[18rem] md:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoCard({
  className,
  children,
  beam = false,
}: {
  className?: string;
  children: ReactNode;
  beam?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-line/80 bg-base-900/60 p-6 transition-colors hover:border-line",
        className
      )}
    >
      {children}
      {beam && <BorderBeam size={160} duration={14} />}
    </div>
  );
}
