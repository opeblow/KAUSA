import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MovingBorder({
  children,
  className,
  containerClassName,
  duration = 3000,
  ...props
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  duration?: number;
  onClick?: () => void;
  type?: "button" | "submit";
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative inline-flex overflow-hidden rounded-full bg-transparent p-px text-sm font-medium",
        containerClassName
      )}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-[-150%] rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, #7c6cff 120deg, #3ad6f0 200deg, transparent 340deg)",
          animation: `spin-around ${duration * 2}ms linear infinite`,
        }}
      />
      <span
        className={cn(
          "relative z-10 inline-flex h-full w-full items-center justify-center gap-2 rounded-full bg-base-900 px-6 py-3 text-ink transition-colors hover:bg-base-850",
          className
        )}
      >
        {children}
      </span>
    </button>
  );
}
