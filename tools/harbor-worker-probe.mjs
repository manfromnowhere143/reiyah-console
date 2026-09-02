/* Prove the OffscreenCanvas worker: (1) Harbor renders in the worker path,
   (2) the main thread is measurably freed vs the main-thread fallback.
   Measures main-thread rAF cadence for ~2.5s while Harbor animates, in both
   the worker path and a forced-fallback (OffscreenCanvas disabled) path. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.SHOT_BASE ?? "http://localhost:4610";
const OUT = "harbor-probe";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--force-device-scale-factor=1"] });

async function run(label, disableOffscreen, dark) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  if (dark) await page.evaluateOnNewDocument(() => { try { localStorage.setItem("harbor-ground", "dark"); } catch {} });
  if (disableOffscreen) await page.evaluateOnNewDocument(() => {
    try { Object.defineProperty(window, "OffscreenCanvas", { value: undefined, configurable: true }); } catch {}
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 20000 });
  await page.waitForSelector(".stage", { timeout: 15000 });
  // ensure we are on Harbor
  await page.evaluate(() => { history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await sleep(1600);

  const info = await page.evaluate(() => {
    const wrap = document.querySelector(".fieldwrap");
    const cvs = wrap ? wrap.querySelectorAll("canvas") : [];
    let inked = -1;
    // sample the main (2nd) canvas only if it still has a 2D context (fallback path);
    // in the worker path the canvas is transferred and getContext throws — that itself is the proof.
    let transferred = false;
    try {
      const cv = cvs[1];
      if (cv) { const g = cv.getContext("2d"); if (g) { const d = g.getImageData(0, 0, cv.width, cv.height).data; inked = 0; for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) inked++; } }
    } catch { transferred = true; }
    return { canvases: cvs.length, dataLive: wrap?.getAttribute("data-live"), inked, transferred };
  });

  const prof = await page.evaluate(async () => {
    const frames = []; let last = performance.now(); let run = true;
    const tick = (t) => { frames.push(t - last); last = t; if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, 2500));
    run = false;
    const long = frames.filter((f) => f > 20).length;
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    return { frames: frames.length, longFrames: long, maxGap: Math.round(Math.max(...frames)), avgGap: +avg.toFixed(1) };
  });

  await page.screenshot({ path: `${OUT}/${label}.png` });
  console.log(`[${label}] canvases=${info.canvases} dataLive=${info.dataLive} transferred=${info.transferred} inked=${info.inked} | mainThread: frames=${prof.frames} longFrames=${prof.longFrames} maxGap=${prof.maxGap}ms avgGap=${prof.avgGap}ms`);
  await page.close();
}

await run("worker-dark", false, true);
await run("fallback-dark", true, true);
await run("worker-light", false, false);
await browser.close();
console.log("done →", OUT);
