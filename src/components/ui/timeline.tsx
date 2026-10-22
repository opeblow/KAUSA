import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

export function ScrollBeam({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.25", "end 0.6"] });
  const pathLength = useSpring(scrollYProgress, { stiffness: 400, damping: 90 });

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="absolute top-0 left-4 hidden h-full w-px bg-line md:block" aria-hidden />
      <svg
        viewBox="0 0 20 2000"
        className="sticky top-24 left-4 hidden h-[calc(100%-6rem)] w-5 md:block"
        preserveAspectRatio="none"
        aria-hidden
      >
        <motion.path
          d="M 10 0 V 2000"
          fill="none"
          stroke="url(#beam-gradient)"
          strokeWidth={2}
          style={{ pathLength }}
        />
        <defs>
          <linearGradient id="beam-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c6cff" />
            <stop offset="100%" stopColor="#3ad6f0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="md:pl-16">{children}</div>
    </div>
  );
}

export function TimelineItem({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "start 0.4"] });
  const opacity = useTransform(scrollYProgress, [0, 1], [0.35, 1]);

  return (
    <motion.div ref={ref} style={{ opacity }} className="relative mb-14 last:mb-0">
      <div className="absolute -left-16 top-1 hidden size-8 items-center justify-center rounded-full border border-line bg-base-950 text-xs text-ink-muted md:flex">
        {String(index).padStart(2, "0")}
      </div>
      <h3 className="text-lg font-medium text-ink">{title}</h3>
      <div className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{children}</div>
    </motion.div>
  );
}

export function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
