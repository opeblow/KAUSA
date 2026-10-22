import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4173";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const routes = ["/", "/app/workspace", "/app/overview", "/app/ask", "/app/investigation", "/app/verdict", "/app/missions", "/app/methodology"];
let problems = 0;

for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: "networkidle0" });
  await new Promise((x) => setTimeout(x, 400));
  const res = await page.evaluate(() => {
    const de = document.documentElement;
    const overflowX = de.scrollWidth - de.clientWidth;
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const h1 = document.querySelector("h1");
    const h1c = h1 ? getComputedStyle(h1) : null;
    const emptyClickables = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.offsetWidth === 0 && b.offsetHeight === 0
    ).length;
    return {
      overflowX,
      bodyBg,
      h1Size: h1c?.fontSize ?? "n/a",
      hasH1: Boolean(h1),
      emptyClickables,
      rootBg: getComputedStyle(document.body).color,
    };
  });
  const bad = res.overflowX > 2;
  if (bad) problems++;
  console.log(
    `${bad ? "OVERFLOW" : "ok"} ${r} · overflowX=${res.overflowX} · bodyBg=${res.bodyBg} · h1=${res.h1Size} textClr=${res.rootBg}`
  );
}

// Hero-specific: confirm accent color present and WebGL-free backgrounds layer exists
await page.goto(BASE + "/", { waitUntil: "networkidle0" });
const hero = await page.evaluate(() => {
  const h1 = document.querySelector("h1");
  const accentDot = document.querySelector(".bg-accent");
  const aurora = document.querySelector(".animate-aurora");
  return {
    h1Text: h1?.textContent?.trim(),
    h1Color: h1 ? getComputedStyle(h1).backgroundImage.slice(0, 40) : null,
    accent: accentDot ? getComputedStyle(accentDot).backgroundColor : null,
    aurora: Boolean(aurora),
  };
});
console.log("HERO", JSON.stringify(hero));

await browser.close();
console.log(problems === 0 ? "NO OVERFLOW ISSUES" : `${problems} overflow issue(s)`);
