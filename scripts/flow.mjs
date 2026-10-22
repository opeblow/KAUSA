import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4173";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

// 1. Run an investigation
await page.goto(BASE + "/app/investigation", { waitUntil: "networkidle0" });
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.includes("Why did sales drop in September?")
  );
  b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});

// 2. DURING: confirm plan + hypotheses stream in
await new Promise((r) => setTimeout(r, 2500));
const midText = await page.evaluate(() => document.body.innerText);
const midHasPlan = /Promotion depth was reduced/.test(midText);
const midHasStatus = /(Testing|Supported|Weak|Refuted|Untestable)/.test(midText);
console.log(`STREAM plan=${midHasPlan} statuses=${midHasStatus}`);

// 3. AFTER: wait for completion
await new Promise((r) => setTimeout(r, 7000));
const doneText = await page.evaluate(() => document.body.innerText);
const doneHasVerifier = /Verifier passed/i.test(doneText);
const doneHasGraph = /Agent graph/i.test(doneText);
console.log(`DONE verifier=${doneHasVerifier} agentGraph=${doneHasGraph}`);

// 4. Go to verdict, check ruled-out + waterfall + click a claim value
await page.goto(BASE + "/app/verdict", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 500));
const verdictText = await page.evaluate(() => document.body.innerText);
console.log(
  `VERDICT ruledOut=${/What we ruled out/i.test(verdictText)} waterfall=${/Contribution to the change/i.test(verdictText)} recs=${/Recommendations/i.test(verdictText)}`
);

// 5. Open evidence panel by clicking the promotion cause value (claim C-0010, has evidence)
const opened = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    /C-0010/.test(b.getAttribute("aria-label") || "")
  );
  btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return Boolean(btn);
});
await new Promise((r) => setTimeout(r, 700));
const evText = await page.evaluate(() => document.body.innerText);
console.log(
  `EVIDENCE opened=${opened} hasQuery=${/Federated query/i.test(evText)} hasLedger=${/Calculation steps/i.test(evText)} url=${page.url().includes("claim=C-0010")}`
);

// 6. Cancel flow: start from the not-started screen
await page.goto(BASE + "/app/investigation", { waitUntil: "networkidle0" });
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.includes("Why did sales drop in September?")
  );
  b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 1500));
const cancelOk = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll("button")).find((x) =>
    x.textContent?.trim() === "Cancel"
  );
  b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return Boolean(b);
});
await new Promise((r) => setTimeout(r, 300));
const cancelledText = await page.evaluate(() => document.body.innerText);
console.log(`CANCEL clicked=${cancelOk} stopped=${/cancelled by user/i.test(cancelledText)}`);

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "NO RUNTIME ERRORS");
await browser.close();
process.exit(errors.length ? 1 : 0);
