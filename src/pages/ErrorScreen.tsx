import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, ServerCrash, WifiOff, TimerReset, Wrench, RotateCw, Home } from "lucide-react";
import { SiteNav } from "@/components/layout/SiteNav";
import { Footer } from "@/components/layout/Footer";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { MovingBorder } from "@/components/ui/moving-border";
import { cn } from "@/lib/utils";

type Variant = "notFound" | "server" | "offline" | "rateLimited" | "maintenance";

const variants: Record<
  Variant,
  { code: string; icon: typeof Compass; title: string; body: string; retry: boolean }
> = {
  notFound: {
    code: "404",
    icon: Compass,
    title: "We can't find that page",
    body: "The link may be broken, or the page may have moved. Nothing was lost — your missions and evidence are safe.",
    retry: false,
  },
  server: {
    code: "500",
    icon: ServerCrash,
    title: "Something failed on our side",
    body: "An unexpected error occurred while handling this request. The team has been notified with the request ID below.",
    retry: true,
  },
  offline: {
    code: "offline",
    icon: WifiOff,
    title: "You appear to be offline",
    body: "Progress updates stream over a live connection. Reconnect and Kausa will resume from the last event we received.",
    retry: true,
  },
  rateLimited: {
    code: "429",
    icon: TimerReset,
    title: "Too many requests",
    body: "You've reached the rate limit for this session. Wait a moment and try again — running investigations keep their place in the queue.",
    retry: true,
  },
  maintenance: {
    code: "503",
    icon: Wrench,
    title: "Brief maintenance",
    body: "Kausa is being updated. The live demo will be back shortly; scheduled missions resume automatically.",
    retry: true,
  },
};

export function ErrorScreen({ variant = "notFound" }: { variant?: Variant }) {
  const [current, setCurrent] = useState<Variant>(variant);
  const v = variants[current];
  const requestId = `req_${Math.abs(hash(current)).toString(16).padStart(8, "0")}`;

  return (
    <div className="flex min-h-screen flex-col bg-base-950">
      <SiteNav />
      <AuroraBackground className="flex-1 justify-center">
        <motion.div
          key={current}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-white/[0.03]">
            <v.icon className="size-6 text-accent-soft" />
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-ink-faint">{v.code}</p>
          <h1 className="mt-3 text-3xl font-light text-ink">{v.title}</h1>
          <p className="mt-4 text-sm text-ink-muted">{v.body}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {v.retry && (
              <MovingBorder duration={2600}>
                <span className="inline-flex items-center gap-2">
                  <RotateCw className="size-4" /> Try again
                </span>
              </MovingBorder>
            )}
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <Home className="size-4" /> Back home
            </Link>
          </div>

          <p className="mt-8 text-xs text-ink-faint">
            Request ID <span className="font-mono text-ink-muted">{requestId}</span> — quote this for support.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {(Object.keys(variants) as Variant[]).map((key) => (
              <button
                key={key}
                onClick={() => setCurrent(key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                  current === key
                    ? "border-accent/40 bg-accent/10 text-accent-soft"
                    : "border-line text-ink-faint hover:text-ink"
                )}
              >
                {variants[key].code}
              </button>
            ))}
          </div>
        </motion.div>
      </AuroraBackground>
      <Footer />
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
