/* Visual verification rig: drives the installed Chrome over the running
   evidence server and captures every station. Usage:
     node tools/shots.mjs [outDir] [--mobile]                */
import puppeteer from "puppeteer-core";

const OUT = process.argv[2] ?? "shots";
const MOBILE = process.argv.includes("--mobile");
const DARK = process.argv.includes("--dark");
const BASE = "http://localhost:4600";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const STATIONS = ["harbor", "ledger", "lineage", "encounter", "controls", "estimands", "adversaries", "chair", "frontier"];

import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--hide-scrollbars", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport(MOBILE ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
if (DARK) await page.evaluateOnNewDocument(() => { try { localStorage.setItem("harbor-ground", "dark"); } catch {} });

/* boot once */
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.querySelector(".bootrow, .world") !== null, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${OUT}/boot${MOBILE ? "-m" : ""}.png` });
await page.waitForSelector(".world", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1200));

for (const st of STATIONS) {
  await page.evaluate((id) => {
    history.pushState({ st: id }, "", id === "harbor" ? "/" : `?st=${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, st);
  await new Promise((r) => setTimeout(r, 1500)); // let the camera land
  await page.screenshot({ path: `${OUT}/${st}${MOBILE ? "-m" : ""}${DARK ? "-dark" : ""}.png` });
  console.log("captured", st);
}
await browser.close();
