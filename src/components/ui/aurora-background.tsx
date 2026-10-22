import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  children?: ReactNode;
  className?: string;
  showRadialGradient?: boolean;
}

export function AuroraBackground({
  children,
  className,
  showRadialGradient = true,
}: AuroraBackgroundProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center bg-base-950 text-ink",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={cn(
            "absolute -inset-[10px] opacity-40 will-change-transform [--aurora:repeating-linear-gradient(100deg,#7c6cff_10%,#3ad6f0_20%,#9d92ff_30%,#3ddc97_40%,#7c6cff_50%)] [--dark-gradient:repeating-linear-gradient(100deg,#05060a_0%,#05060a_7%,transparent_10%,transparent_12%,#05060a_16%)] [--white-gradient:repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)] [background-image:var(--white-gradient),var(--aurora)] [background-position:50%_50%,50%_50%] [background-size:300%,_200%] after:absolute after:inset-0 after:content-[''] after:[background-image:var(--white-gradient),var(--aurora)] after:[background-position:50%_50%,50%_50%] after:[background-size:200%,_100%] after:mix-blend-difference after:animate-aurora",
            showRadialGradient &&
              "[mask-image:radial-gradient(ellipse_at_100%_20%,black_10%,transparent_70%)]"
          )}
        />
      </div>
      {children}
    </div>
  );
}
