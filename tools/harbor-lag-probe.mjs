/* Direct proof the main thread is freed: cumulative main-thread ScriptDuration
   and TaskDuration (CDP metrics) over a fixed 3s window while Harbor animates.
   Worker path: the engine JS runs off-thread, so main-thread script time is
   near-zero. Fallback: the engine runs on the main thread every frame. */
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.SHOT_BASE ?? "http://localhost:4610";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--force-device-scale-factor=1"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WINDOW = 3000;

async function run(label, disableOffscreen) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem("harbor-ground", "dark"); } catch {} });
  if (disableOffscreen) await page.evaluateOnNewDocument(() => {
    try { Object.defineProperty(window, "OffscreenCanvas", { value: undefined, configurable: true }); } catch {}
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 20000 });
  await page.waitForSelector(".stage", { timeout: 15000 });
  await page.evaluate(() => { history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await sleep(1500); // let it settle
  const m0 = await page.metrics();
  await sleep(WINDOW);
  const m1 = await page.metrics();
  const script = ((m1.ScriptDuration - m0.ScriptDuration) * 1000);
  const task = ((m1.TaskDuration - m0.TaskDuration) * 1000);
  const layout = ((m1.LayoutDuration - m0.LayoutDuration) * 1000);
  const pct = (script / WINDOW) * 100;
  console.log(`[${label}] over ${WINDOW}ms  main-thread script=${script.toFixed(0)}ms (${pct.toFixed(1)}% of wall)  task=${task.toFixed(0)}ms  layout=${layout.toFixed(0)}ms`);
  await page.close();
  return script;
}

const worker = await run("WORKER  ", false);
const fallback = await run("FALLBACK", true);
console.log(`\nMain-thread script time removed by the worker: ${(fallback - worker).toFixed(0)}ms over ${WINDOW}ms  (fallback ${fallback.toFixed(0)}ms -> worker ${worker.toFixed(0)}ms)`);
await browser.close();
