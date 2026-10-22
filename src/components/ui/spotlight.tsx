import { cn } from "@/lib/utils";

export function Spotlight({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-64 left-1/2 h-[42rem] w-[52rem] -translate-x-1/2 animate-pulse-glow rounded-full bg-[radial-gradient(closest-side,rgba(124,108,255,0.28),rgba(58,214,240,0.08),transparent)] blur-3xl",
        className
      )}
    />
  );
}
