/**
 * Narration layer. The language model only *writes prose about numbers it is
 * given* — it never computes. Every number in the output is checked against the
 * ledger; a sentence with an invented number is rejected and we fall back to a
 * deterministic template. (PRD §9: the model never calculates.)
 *
 * Provider-agnostic: Kausa treats the LLM as a swappable narrator behind one
 * OpenAI-compatible interface. Sponsors wired in here:
 *   - NVIDIA Nemotron via NIM          (NVIDIA_API_KEY / NVIDIA_BASE_URL / NVIDIA_MODEL)
 *   - SpaceXAI Grok                    (SPACEXAI_API_KEY / SPACEXAI_BASE_URL / SPACEXAI_MODEL)
 *   - Meterless Runtime                (METERLESS_API_KEY / METERLESS_BASE_URL / METERLESS_MODEL)
 *
 * Selection: set LLM_PROVIDER to force one. Otherwise the first *configured*
 * provider is tried (NVIDIA → SpaceXAI → Meterless), then the next on failure,
 * and finally the deterministic template. The provider that actually wrote the
 * prose is recorded on the verdict.
 */

export interface Facts {
  question: string;
  metric: string;
  entity: string;
  windowLabel: string;
  comparisonLabel: string;
  actual: number;
  expected: number;
  gap: number;
  changePct: number;
  drivers: { group: string; contribution: number; status: string }[];
  refuted: string[];
  limitations: string[];
  currency: boolean;
  /** H-MEM reinjected context about this user's data (already number-sanitized). */
  memoryContext?: string;
}

export type VerifierStatus = "passed" | "repaired" | "fallback";
export type ProviderId = "nvidia" | "spacexai" | "meterless" | "template";

export interface NarrationResult {
  text: string;
  verifier: VerifierStatus;
  provider: ProviderId;
  providerLabel: string;
  model: string;
}

interface Provider {
  id: Exclude<ProviderId, "template">;
  label: string;
  baseUrl: string;
  model: string;
  key: string;
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  nvidia: "NVIDIA Nemotron via NIM",
  spacexai: "SpaceXAI Grok",
  meterless: "Meterless Runtime",
  template: "Deterministic template",
};

/** Ordered list of configured providers (key present), honouring LLM_PROVIDER. */
export function providers(): Provider[] {
  const list: Provider[] = [];

  if (process.env.NVIDIA_API_KEY) {
    list.push({
      id: "nvidia",
      label: PROVIDER_LABELS.nvidia,
      baseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
      model: process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3-super-120b-a12b",
      key: process.env.NVIDIA_API_KEY,
    });
  }
  if (process.env.SPACEXAI_API_KEY) {
    list.push({
      id: "spacexai",
      label: PROVIDER_LABELS.spacexai,
      baseUrl: process.env.SPACEXAI_BASE_URL ?? "https://api.x.ai/v1",
      model: process.env.SPACEXAI_MODEL ?? "grok-4",
      key: process.env.SPACEXAI_API_KEY,
    });
  }
  if (process.env.METERLESS_API_KEY) {
    list.push({
      id: "meterless",
      label: PROVIDER_LABELS.meterless,
      baseUrl: process.env.METERLESS_BASE_URL ?? "https://api.meterless.ai/v1",
      model: process.env.METERLESS_MODEL ?? "default",
      key: process.env.METERLESS_API_KEY,
    });
  }

  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced) {
    const idx = list.findIndex((p) => p.id === forced);
    if (idx > 0) return [list[idx], ...list.slice(0, idx), ...list.slice(idx + 1)];
  }
  return list;
}

/** Short human-readable description of the configured narration chain. */
export function narrationChain(): string {
  const ids = providers().map((p) => PROVIDER_LABELS[p.id]);
  return ids.length ? ids.join(" → ") : "Deterministic template (no LLM key set)";
}

const INCIDENTAL = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 40, 50, 60, 70, 80, 90, 95, 99, 100,
]);

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function num(n: number, unit: string): string {
  if (unit === "USD") return money(n);
  if (unit === "pct") return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
  return n.toLocaleString("en-US");
}

export function templateNarration(f: Facts): string {
  const unit = f.currency ? "USD" : "count";
  const direction = f.gap < 0 ? "below" : "above";
  const top = f.drivers
    .filter((d) => d.status !== "refuted")
    .slice(0, 2)
    .map((d) => `${d.group} (${num(d.contribution, unit)})`)
    .join(" and ");
  const refuted = f.refuted.length
    ? ` We tested and rejected ${f.refuted.join(" and ")}.`
    : "";
  return (
    `${f.metric} was ${num(f.actual, unit)} in ${f.windowLabel}, ${direction} the expected ` +
    `${num(f.expected, unit)} by ${num(f.gap, unit)} (${num(f.changePct, "pct")}). ` +
    (top
      ? `The largest computed contributions are ${top}.`
      : `No single numeric driver explains the move in this dataset.`) +
    refuted +
    ` These are evidence-weighted explanations computed from your data, not proof of causation.`
  );
}

function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /-?\d[\d,]*(?:\.\d+)?\s*[kKmM%]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let raw = m[0].trim();
    let mult = 1;
    if (/[kK]$/.test(raw)) mult = 1_000;
    if (/[mM]$/.test(raw)) mult = 1_000_000;
    raw = raw.replace(/[kKmM%]/g, "").replace(/,/g, "");
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(n * mult);
  }
  return out;
}

export function verifyNumbers(text: string, facts: Facts, extraAllowed: number[] = []): boolean {
  const allowed = [
    facts.actual, facts.expected, facts.gap, Math.abs(facts.gap), facts.changePct,
    Math.abs(facts.changePct),
    ...facts.drivers.flatMap((d) => [d.contribution, Math.abs(d.contribution)]),
    ...extraAllowed,
  ].filter((n) => Number.isFinite(n));

  const close = (a: number, b: number) =>
    Math.abs(a) < 1 || Math.abs(b) < 1
      ? Math.abs(a - b) < 0.5
      : Math.abs(a - b) <= Math.max(Math.abs(b) * 0.01, 0.5);

  for (const n of extractNumbers(text)) {
    if (INCIDENTAL.has(n)) continue;
    if (allowed.some((a) => close(n, a))) continue;
    return false;
  }
  return true;
}

function buildPrompt(facts: Facts): { system: string; user: string } {
  const unit = facts.currency ? "USD" : "count";
  const driverLines = facts.drivers
    .map((d) => `- ${d.group}: ${num(d.contribution, unit)} (${d.status})`)
    .join("\n");

  const system =
    "You are Kausa, an investigative analytics agent. You write a short, factual " +
    "executive explanation of why a business metric changed. You MUST NOT perform any " +
    "arithmetic and MUST NOT introduce any number that is not given to you. Use only the " +
    "supplied figures verbatim. 2-4 sentences. Plain prose, no markdown, no bullet points.";

  const memoryBlock = facts.memoryContext
    ? `\n\nDurable memories about this user's data and terminology (context only — ` +
      `this block contains NO numbers; never treat it as a source of figures):\n${facts.memoryContext}`
    : "";

  const user =
    `Question: ${facts.question}\n` +
    `Metric: ${facts.metric}\nEntity: ${facts.entity}\n` +
    `Analysis window: ${facts.windowLabel}\nComparison window: ${facts.comparisonLabel}\n` +
    `Actual: ${num(facts.actual, unit)}\n` +
    `Expected: ${num(facts.expected, unit)}\n` +
    `Gap: ${num(facts.gap, unit)}\n` +
    `Change: ${num(facts.changePct, "pct")}\n` +
    `Computed driver contributions:\n${driverLines || "(none)"}\n` +
    `Hypotheses tested and rejected: ${facts.refuted.join(", ") || "none"}\n` +
    `Known limitations: ${facts.limitations.join("; ") || "none"}\n\n` +
    `Write the executive explanation using only these numbers.`;

  return { system: system + memoryBlock, user };
}

/** Call one OpenAI-compatible chat-completions endpoint and return its prose. */
async function callProvider(
  provider: Provider,
  prompt: { system: string; user: string },
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One OpenAI-compatible chat call against the configured sponsor chain. Used by
 * the H-MEM memory writer (convex/memories.ts). Returns null if no provider is
 * configured or every provider fails.
 */
export async function chatComplete(
  system: string,
  user: string,
  maxTokens = 512,
): Promise<{ text: string; providerLabel: string; model: string } | null> {
  for (const provider of providers()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.1,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return { text, providerLabel: provider.label, model: provider.model };
    } catch {
      // try the next provider
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function narrate(facts: Facts): Promise<NarrationResult> {
  const fallback = templateNarration(facts);
  const chain = providers();

  const prompt = buildPrompt(facts);
  // The model is only ever given these (possibly compact-formatted) numbers, so
  // echoing one verbatim must pass verification — even when we rounded it, e.g.
  // "-$12K" for a gap of -12138.
  const givenNumbers = extractNumbers(`${prompt.system}\n${prompt.user}`);

  // Try each configured sponsor in order; keep the first that verifies, but if a
  // model produced prose that failed the number check, prefer a later one that
  // passes before falling back.
  let repaired: NarrationResult | null = null;
  for (const provider of chain) {
    const text = await callProvider(provider, prompt);
    if (!text) continue;
    if (verifyNumbers(text, facts, givenNumbers)) {
      return {
        text,
        verifier: "passed",
        provider: provider.id,
        providerLabel: provider.label,
        model: provider.model,
      };
    }
    repaired ??= {
      text: fallback,
      verifier: "repaired",
      provider: provider.id,
      providerLabel: provider.label,
      model: provider.model,
    };
  }

  if (repaired) return repaired;
  return {
    text: fallback,
    verifier: "fallback",
    provider: "template",
    providerLabel: PROVIDER_LABELS.template,
    model: "none",
  };
}
