/* Measure transition smoothness. Records frame gaps during station morphs and
   counts long frames (>20ms). Also samples the Harbor canvas one tick after
   entering it, to prove the engine is painted (no blank pop-in). */
import puppeteer from "puppeteer-core";
const BASE = process.env.SHOT_BASE ?? "http://localhost:4610";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--force-device-scale-factor=1"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await page.waitForSelector(".stage", { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1400));

const hop = async (id) => {
  const res = await page.evaluate(async (station) => {
    const frames = [];
    let last = performance.now();
    let running = true;
    const tick = (t) => { frames.push(t - last); last = t; if (running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    history.pushState({ st: station }, "", station === "harbor" ? "/" : `?st=${station}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    await new Promise((r) => setTimeout(r, 650));
    running = false;
    const long = frames.filter((f) => f > 20);
    return { station, frames: frames.length, longFrames: long.length, maxGap: Math.round(Math.max(...frames)) };
  }, id);
  return res;
};

const order = ["encounter", "harbor", "ledger", "harbor", "adversaries", "encounter", "harbor"];
const out = [];
for (const id of order) { out.push(await hop(id)); await new Promise((r) => setTimeout(r, 500)); }

// prove Harbor canvas is non-blank immediately after entering it
const canvasInk = await page.evaluate(async () => {
  history.pushState({ st: "ledger" }, "", "?st=ledger");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await new Promise((r) => setTimeout(r, 500));
  history.pushState({ st: "harbor" }, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // 2 frames
  const cv = document.querySelector(".harbor canvas:nth-of-type(2)");
  if (!cv) return { found: false };
  const g = cv.getContext("2d");
  const { data } = g.getImageData(0, 0, cv.width, cv.height);
  let nonzero = 0;
  for (let i = 3; i < data.length; i += 4000) if (data[i] > 0) nonzero++;
  return { found: true, w: cv.width, h: cv.height, inkedSamples: nonzero };
});

console.log("TRANSITION FRAME PROFILE (long = frame > 20ms):");
for (const r of out) console.log(`  → ${r.station.padEnd(12)} frames=${r.frames}  longFrames=${r.longFrames}  maxGap=${r.maxGap}ms`);
console.log("HARBOR CANVAS AFTER ENTER:", JSON.stringify(canvasInk));
await browser.close();
