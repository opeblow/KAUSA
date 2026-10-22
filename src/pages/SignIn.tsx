import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Search,
  GitBranch,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { AmbientBackdrop } from "@/components/layout/AmbientBackdrop";
import { Meteors } from "@/components/ui/meteors";
import { BorderBeam } from "@/components/ui/border-beam";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

type Flow = "signUp" | "signIn";

const FEATURES = [
  {
    icon: Search,
    title: "Tests competing explanations",
    body: "Weekday baselines, driver regressions and coverage checks run on your own data — not guesses.",
  },
  {
    icon: GitBranch,
    title: "Every figure is a claim",
    body: "Each number is stored, replayable and open to inspection. You can always ask where it came from.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Per-account storage. The model only ever sees computed aggregates, never your raw rows.",
  },
];

const STACK = ["Convex", "Zetaris", "NVIDIA Nemotron", "Meterless H-MEM"];

const STATS: { value: number; suffix?: string; label: string }[] = [
  { value: 100, suffix: "%", label: "figures traceable" },
  { value: 0, label: "raw rows shared" },
  { value: 6, label: "evidence checks per run" },
];

export function SignIn() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [flow, setFlow] = useState<Flow>("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchFlow = (next: Flow) => {
    setFlow(next);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn("password", { email: email.trim(), password, flow });
      navigate("/app/workspace", { replace: true });
    } catch (err) {
      setError(
        flow === "signUp"
          ? err instanceof Error
            ? err.message
            : "Could not create your account."
          : "Incorrect email or password.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-base-950">
      <AmbientBackdrop />
      <Meteors number={14} className="opacity-40" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <Link to="/" aria-label="Kausa home">
            <Brand />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            Back to site <ArrowRight className="size-3" />
          </Link>
        </header>

        <main className="grid flex-1 grid-cols-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_minmax(380px,440px)] lg:gap-16">
          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-xl lg:mx-0"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-xs">
              <span className="size-1.5 rounded-full bg-accent" />
              <AnimatedShinyText>Open Agent Hackathon 2026 · Track 02</AnimatedShinyText>
            </span>

            <h1 className="mt-7 text-4xl font-light leading-[1.1] tracking-tight text-gradient sm:text-5xl">
              Know why your numbers moved.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-muted">
              Kausa is an investigative agent for business metrics. Ask why sales dropped — it tests
              competing explanations against your data and shows the evidence, including what it ruled
              out.
            </p>

            <div className="mt-9 hidden flex-col gap-5 lg:flex">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.15 + i * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03]">
                    <f.icon className="size-4 text-accent-soft" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{f.title}</p>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">{f.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-9 hidden items-center gap-8 border-t border-line/60 pt-6 lg:flex">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-light text-ink">
                    <NumberTicker value={s.value} />
                    {s.suffix ?? ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 hidden flex-wrap items-center gap-2 lg:flex">
              <span className="text-[11px] uppercase tracking-[0.2em] text-ink-faint">Built on</span>
              {STACK.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-line/70 bg-white/[0.02] px-2 py-1 text-[11px] text-ink-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          </motion.aside>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mx-auto w-full max-w-md lg:mx-0"
          >
            <form onSubmit={submit} className="panel-hero relative overflow-hidden p-6 sm:p-7">
              <BorderBeam size={220} duration={16} />

              <SectionLabel>
                <Sparkles className="size-4" />
                {flow === "signUp" ? "Get started" : "Welcome back"}
              </SectionLabel>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
                {flow === "signUp" ? "Create your workspace" : "Sign in to Kausa"}
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                {flow === "signUp"
                  ? "Upload your data and get an evidence-backed answer in minutes."
                  : "Return to your private, isolated workspace."}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-line bg-base-950/50 p-1">
                {(["signUp", "signIn"] as Flow[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => switchFlow(f)}
                    className="relative rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                  >
                    {flow === f && (
                      <motion.span
                        layoutId="authTab"
                        className="absolute inset-0 rounded-lg bg-white/[0.06] ring-1 ring-line"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className={cn("relative z-10", flow === f ? "text-ink" : "text-ink-muted")}>
                      {f === "signUp" ? "Create account" : "Sign in"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3.5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-ink-faint">Email</span>
                  <span className="relative flex items-center">
                    <Mail className="pointer-events-none absolute left-3.5 size-4 text-ink-faint" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-xl border border-line bg-base-950/60 py-2.5 pl-10 pr-3.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                    />
                  </span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-ink-faint">Password</span>
                  <span className="relative flex items-center">
                    <Lock className="pointer-events-none absolute left-3.5 size-4 text-ink-faint" />
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete={flow === "signUp" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-line bg-base-950/60 py-2.5 pl-10 pr-11 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="absolute right-3 text-ink-faint transition-colors hover:text-ink"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </span>
                </label>

                <AnimatePresence initial={false}>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden rounded-xl border border-negative/30 bg-negative/[0.06] px-3.5 py-2.5 text-xs text-negative"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={busy}
                  className={cn(
                    "mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-[0_12px_34px_-12px_rgba(124,108,255,0.75)] transition-colors hover:bg-accent-deep",
                    busy && "opacity-70",
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {flow === "signUp" ? "Create account" : "Sign in"}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="mt-5 text-center text-[11px] text-ink-faint">
                By continuing you agree to use Kausa for the hackathon demo. Sample data is
                illustrative.
              </p>
            </form>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-ink-faint">
              <ShieldCheck className="size-3.5" /> Private per-account storage. Your files are never
              shared.
            </p>
          </motion.section>
        </main>

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-line/60 pt-6 text-[11px] text-ink-faint sm:flex-row">
          <span>Kausa · an investigative agent for business metrics.</span>
          <span>Evidence-weighted explanations, not proof of causation.</span>
        </footer>
      </div>
    </div>
  );
}
