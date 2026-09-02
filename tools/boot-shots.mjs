/* Capture the boot experience: the instant inline splash, then the React
   verification boot mid-flight, then the final stage — both grounds.
   Delays /api to make the honest phases visible for the camera. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "boot-shots";
const BASE = process.env.SHOT_BASE ?? "http://localhost:4610";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--hide-scrollbars", "--force-device-scale-factor=2"],
});

for (const ground of ["light", "dark"]) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage();
    await page.setViewport(mobile ? { width: 430, height: 932, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument((g) => { try { localStorage.setItem("harbor-ground", g); } catch {} }, ground);
    // slow every /api response so the boot phases are legible
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
      if (req.url().includes("/api/")) { await sleep(650); req.continue(); } else req.continue();
    });
    const tag = `${ground}${mobile ? "-m" : ""}`;

    const nav = page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    // 1 — the instant inline splash (before React removes it)
    await page.waitForSelector("#boot", { timeout: 5000 }).catch(() => {});
    await sleep(500);
    await page.screenshot({ path: `${OUT}/1-inline-${tag}.png` });
    // 2 — the React verification boot mid-flight
    await page.waitForSelector(".apx", { timeout: 8000 }).catch(() => {});
    await sleep(700);
    await page.screenshot({ path: `${OUT}/2-verify-${tag}.png` });
    // 3 — final stage
    await nav.catch(() => {});
    await page.waitForSelector(".stage", { timeout: 15000 }).catch(() => {});
    await sleep(900);
    await page.screenshot({ path: `${OUT}/3-stage-${tag}.png` });
    console.log("captured", tag);
    await page.close();
  }
}
await browser.close();
console.log("done →", OUT);
