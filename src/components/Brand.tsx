import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
        <svg viewBox="0 0 32 32" className="size-4" aria-hidden>
          <path
            d="M9 22V10l7 7 7-7v12"
            fill="none"
            stroke="#9d92ff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">Kausa</span>
    </span>
  );
}
