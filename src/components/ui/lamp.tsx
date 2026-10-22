import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Lamp({
  children,
  className,
  color = "#7c6cff",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <div className="relative flex w-full flex-1 scale-y-125 items-center justify-center" aria-hidden>
        <div
          className="absolute h-56 w-[30rem] opacity-30 blur-3xl sm:w-[40rem]"
          style={{ background: `conic-gradient(from 70deg at center top, ${color}, transparent, ${color})` }}
        />
        <div className="absolute inset-auto h-40 w-[36rem] rounded-full bg-gradient-to-r from-transparent via-accent to-transparent blur-2xl sm:w-[48rem]" />
        <div className="absolute inset-auto z-20 h-0.5 w-[24rem] bg-gradient-to-r from-transparent via-accent to-transparent sm:w-[32rem]" />
      </div>
      <div className="relative z-30">{children}</div>
    </div>
  );
}
