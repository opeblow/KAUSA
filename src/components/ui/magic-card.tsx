import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function MagicCard({
  children,
  className,
  gradientSize = 220,
  gradientColor = "#7c6cff",
  gradientOpacity = 0.18,
}: {
  children: ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -gradientSize, y: -gradientSize });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    []
  );

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseenter", () => setOpacity(gradientOpacity));
    card.addEventListener("mouseleave", () => setOpacity(0));
    return () => card.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove, gradientOpacity]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative flex size-full overflow-hidden rounded-2xl border border-line/80 bg-base-900/70 p-px",
        className
      )}
    >
      <div className="absolute inset-0 rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-500"
          style={{
            opacity,
            background: `radial-gradient(${gradientSize}px circle at ${pos.x}px ${pos.y}px, ${gradientColor}, transparent 100%)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}

export function CardSpotlight({
  children,
  className,
  radius = 320,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0, active: false });

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
      }}
      onMouseLeave={() => setMouse((m) => ({ ...m, active: false }))}
      className={cn(
        "group/spot relative overflow-hidden rounded-3xl border border-line/80 bg-base-900/60 p-6",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl transition-opacity duration-300"
        style={{
          opacity: mouse.active ? 1 : 0,
          background: `radial-gradient(${radius}px circle at ${mouse.x}px ${mouse.y}px, rgba(124,108,255,0.12), transparent 60%)`,
        }}
      />
      {children}
    </motion.div>
  );
}
