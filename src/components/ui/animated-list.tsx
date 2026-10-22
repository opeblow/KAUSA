import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function AnimatedList({
  children,
  className,
  delay = 120,
}: {
  children: React.ReactNode[];
  className?: string;
  delay?: number;
}) {
  const [items, setItems] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const count = children.length;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setItems(Math.min(i, count));
      if (i >= count) clearInterval(interval);
    }, delay);
    return () => clearInterval(interval);
  }, [children.length, delay]);

  return (
    <div ref={containerRef} className={cn("flex flex-col gap-3", className)}>
      <AnimatePresence>
        {children.slice(0, items).map((child, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
