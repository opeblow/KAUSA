import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4173";
const OUT = "C:/Users/USER/AppData/Local/Temp/opencode/kausa-shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

async function shot(name, path, { full = false, wait = 900, before } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  if (before) await before(page);
  await new Promise((r) => setTimeout(r, wait));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await page.close();
  console.log(`shot ${name}`);
}

await shot("01-landing-hero", "/");
await shot("02-landing-proof", "/", {
  full: false,
  before: async (p) => {
    await p.evaluate(() => document.getElementById("proof")?.scrollIntoView());
  },
});
await shot("03-workspace", "/app/workspace");
await shot("04-overview", "/app/overview");
await shot("05-ask", "/app/ask", {
  before: async (p) => {
    await p.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) =>
        x.textContent?.includes("Why did sales drop in September?")
      );
      b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 1100));
  },
});
await shot("06-investigation", "/app/investigation", {
  before: async (p) => {
    await p.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) =>
        x.textContent?.includes("Why did sales drop in September?")
      );
      b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 3200));
  },
});
await shot("07-verdict", "/app/verdict", {
  full: true,
  wait: 1400,
});
await shot("08-evidence", "/app/verdict", {
  before: async (p) => {
    await p.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) =>
        /C-0010/.test(x.getAttribute("aria-label") || "")
      );
      b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 900));
  },
});
await shot("09-missions", "/app/missions");
await shot("10-methodology", "/app/methodology");
await shot("11-error", "/nope");
await shot("12-mobile-landing", "/", {
  wait: 900,
  before: async (p) => {
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  },
});

await browser.close();
console.log("DONE ->", OUT);
