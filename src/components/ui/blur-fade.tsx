import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.5,
  yOffset = 12,
  inView = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
  inView?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: yOffset, filter: "blur(8px)" }}
      whileInView={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
      animate={inView ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1], type: "tween" }}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
