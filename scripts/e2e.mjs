// End-to-end test against a running Kausa site (live or local).
//
//   node scripts/e2e.mjs                         # tests https://kausa-gqp.pages.dev
//   BASE=http://localhost:4173 node scripts/e2e.mjs
//
// Signs up a fresh test account, uploads a generated CSV, runs an
// investigation, and checks the verdict, evidence panel, missions and memory
// pages. Set CHROME to your Chrome path if it isn't in the default location.

import puppeteer from "puppeteer-core";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.BASE ?? "https://kausa-gqp.pages.dev").replace(/\/$/, "");
const CHROME =
  process.env.CHROME ?? "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";

// --- Test data: 112 days, sales drop in the last 28 days driven by promo ----
function makeCsv() {
  const rows = ["date,store,net_sales,promo_depth,price,footfall"];
  const start = Date.UTC(2024, 5, 10);
  for (let d = 0; d < 112; d++) {
    const date = new Date(start + d * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    const late = d >= 84;
    const weekday = date.getUTCDay();
    for (const store of ["North", "South"]) {
      const promo = late ? 0.05 : 0.2;
      const price = 10 + (d % 5) * 0.1;
      const footfall = 900 + ((d * 37) % 60) + (store === "North" ? 100 : 0);
      const sales =
        footfall * 9 + promo * 20_000 - price * 150 + (weekday === 6 ? 1500 : 0) + ((d * 53) % 400);
      rows.push(`${iso},${store},${sales.toFixed(2)},${promo},${price.toFixed(2)},${footfall}`);
    }
  }
  const dir = mkdtempSync(join(tmpdir(), "kausa-e2e-"));
  const file = join(dir, "e2e_sales.csv");
  writeFileSync(file, rows.join("\n"));
  return file;
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForText(page, re, timeoutMs, failRe) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const text = await page.evaluate(() => document.body.innerText);
    if (re.test(text)) return { ok: true, text };
    if (failRe && failRe.test(text)) return { ok: false, text };
    await sleep(1000);
  }
  return { ok: false, text: await page.evaluate(() => document.body.innerText) };
}

async function clickButton(page, re) {
  return page.evaluate((src) => {
    const r = new RegExp(src, "i");
    const b = [...document.querySelectorAll("button, a")].find((x) => r.test(x.textContent ?? ""));
    if (b) b.click();
    return Boolean(b);
  }, re.source);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

try {
  // 1. Landing
  await page.goto(BASE + "/", { waitUntil: "networkidle2" });
  check("Landing page renders", /Know why your numbers moved/i.test(await page.evaluate(() => document.body.innerText)));

  // 2. Sign up
  const email = `e2e+${Date.now()}@kausa.test`;
  await page.goto(BASE + "/signin", { waitUntil: "networkidle2" });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', "e2e-Passw0rd!");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname.startsWith("/app"), { timeout: 30_000 }).catch(() => {});
  check("Sign up and land in the app", page.url().includes("/app/workspace"), email);

  // 3. Upload CSV and wait for parsing
  const csv = makeCsv();
  const input = await page.waitForSelector('input[type="file"]');
  await input.uploadFile(csv);
  const parsed = await waitForText(page, /rows ready/i, 90_000, /Parsing failed|Could not find|Error\b/);
  check("Upload parses to Ready", parsed.ok);

  // 4. Ask a question
  await page.goto(BASE + "/app/ask", { waitUntil: "networkidle2" });
  await page.waitForSelector('input[aria-label="Ask a question about your metric"]', { timeout: 20_000 });
  await page.type('input[aria-label="Ask a question about your metric"]', "Why did net sales drop recently?");
  await clickButton(page, /Confirm & run investigation/);
  await page.waitForFunction(() => location.pathname === "/app/investigation", { timeout: 20_000 }).catch(() => {});
  check("Investigation starts", page.url().includes("/app/investigation"));

  // 5. Wait for the verdict
  const done = await waitForText(page, /Open full verdict/i, 180_000, /Not enough data|Analysis failed|Failed/);
  const typed = /Why did net sales drop recently\?/.test(done.text);
  check("Investigation completes", done.ok);
  check("Typed question was kept", typed);

  // 6. Verdict page
  await clickButton(page, /Open full verdict/);
  const verdict = await waitForText(page, /What we ruled out/i, 20_000);
  check("Verdict page shows ruled-out, recommendations, limitations",
    verdict.ok && /Recommendations/i.test(verdict.text) && /Limitations/i.test(verdict.text));

  // 7. Evidence panel
  const evBtn = await page.$('button[aria-label^="Open evidence for"]');
  if (evBtn) await evBtn.click();
  const evidence = await waitForText(page, /Calculation/i, 10_000);
  check("Evidence panel opens with calculation steps", Boolean(evBtn) && evidence.ok && page.url().includes("claim="));
  await page.keyboard.press("Escape");

  // 8. Narration provider
  const model = verdict.text.match(/NVIDIA Nemotron|Meterless Runtime|SpaceXAI Grok|templated narration[^\n]*/i);
  console.log(`INFO  Narration: ${model ? model[0] : "not shown on page"}`);

  // 9. Missions + memory + methodology pages
  await page.goto(BASE + "/app/missions", { waitUntil: "networkidle2" });
  check("Missions lists the investigation", (await waitForText(page, /Why did net sales drop recently/i, 15_000)).ok);
  await page.goto(BASE + "/app/memory", { waitUntil: "networkidle2" });
  check("Memory page loads", (await page.evaluate(() => document.querySelector("#root")?.innerHTML.length ?? 0)) > 500);
  await page.goto(BASE + "/app/methodology", { waitUntil: "networkidle2" });
  check("Methodology page loads", /Methodology|Approach/i.test(await page.evaluate(() => document.body.innerText)));

  // 10. Deep-link refresh + 404
  await page.goto(BASE + "/app/overview", { waitUntil: "networkidle2" });
  check("Deep link refresh works", (await page.evaluate(() => document.querySelector("#root")?.innerHTML.length ?? 0)) > 500);
  await page.goto(BASE + "/no-such-page", { waitUntil: "networkidle2" });
  check("Unknown URL shows 404 screen", /404|not found/i.test(await page.evaluate(() => document.body.innerText)));
} catch (err) {
  check("Test run", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(errors.length ? `\nBrowser errors:\n${[...new Set(errors)].slice(0, 15).join("\n")}` : "\nNo browser errors");
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
