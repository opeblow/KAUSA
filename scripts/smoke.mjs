import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4173";

const routes = [
  "/",
  "/app/workspace",
  "/app/overview",
  "/app/ask",
  "/app/investigation",
  "/app/verdict",
  "/app/missions",
  "/app/methodology",
  "/this-page-does-not-exist",
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

let failures = 0;

for (const route of routes) {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  try {
    await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 600));
    const rootHtml = await page.$eval("#root", (el) => el.innerHTML.length);
    const text = await page.evaluate(() => document.body.innerText.slice(0, 60).replace(/\n/g, " "));
    const ok = rootHtml > 500 && errors.length === 0;
    console.log(`${ok ? "PASS" : "FAIL"} ${route} · rootLen=${rootHtml} · "${text}"`);
    if (errors.length) errors.forEach((e) => console.log(`     ${e}`));
    if (!ok) failures++;
  } catch (e) {
    console.log(`FAIL ${route} · ${e.message}`);
    failures++;
  }
  await page.close();
}

// Interaction smoke test: run an investigation and open the verdict + evidence.
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  await page.goto(BASE + "/app/ask", { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const target = btns.find((b) => b.textContent?.includes("Why did sales drop in September?"));
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 1400));
  const btn = await page.$("button");
  void btn;
  console.log(`INTERACT ask parsed · errors=${errors.length}`);
  console.log(errors.join("\n"));
} catch (e) {
  console.log(`INTERACT FAIL · ${e.message}`);
}

await browser.close();
console.log(failures === 0 ? "ALL ROUTES OK" : `${failures} ROUTE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
