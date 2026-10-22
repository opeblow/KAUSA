import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function Meteors({ number = 20, className }: { number?: number; className?: string }) {
  const [styles, setStyles] = useState<CSSProperties[]>([]);

  useEffect(() => {
    const s = Array.from({ length: number }).map(() => ({
      "--angle": "-45deg",
      top: "-5%",
      left: `calc(0% + ${Math.floor(Math.random() * 100)}%)`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${Math.floor(Math.random() * (10 - 2) + 2)}s`,
    })) as CSSProperties[];
    setStyles(s);
  }, [number]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {styles.map((style, idx) => (
        <span
          key={idx}
          className="animate-meteor absolute top-1/2 left-1/2 h-0.5 w-0.5 rotate-[215deg] rounded-full bg-slate-300 shadow-[0_0_0_1px_#ffffff10] before:absolute before:top-1/2 before:h-px before:w-[56px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-slate-200 before:to-transparent before:content-['']"
          style={style}
        >
          <div className="absolute top-1/2 h-px w-[56px] -translate-y-1/2 bg-gradient-to-r from-slate-200 to-transparent" />
        </span>
      ))}
    </div>
  );
}
