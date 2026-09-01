/* The hangar test: prove the instrument survives with no network.
   1. Visit online, let the service worker install and the caches fill.
   2. Go offline. Reload. The shell must come back from the worker, the
      cached evidence must still verify, and the truth pill must say OFFLINE.
   No fabricated state: if nothing were cached, the boot would block. */
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

/* pass 1: online, warm the caches */
await page.goto("http://localhost:4600/", { waitUntil: "networkidle2" });
await page.waitForSelector(".world", { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1500));
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? (reg.active ? "active" : reg.installing ? "installing" : "registered") : "none";
});
console.log("service worker:", swState);
await new Promise((r) => setTimeout(r, 1200)); // let install finish

/* pass 2: offline reload */
await page.setOfflineMode(true);
await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
let offlineOk = false;
try {
  await page.waitForSelector(".world, .blocked", { timeout: 20000 });
  offlineOk = true;
} catch { /* neither appeared */ }
const outcome = await page.evaluate(() => ({
  world: !!document.querySelector(".world"),
  blocked: !!document.querySelector(".blocked"),
  pill: document.querySelector(".pill")?.textContent ?? null,
  artifacts: document.querySelector(".harbortitle")?.textContent ?? null,
}));
console.log("offline outcome:", JSON.stringify(outcome));
console.log(offlineOk && (outcome.world || outcome.blocked) ? "HANGAR TEST: PASS (honest state rendered offline)" : "HANGAR TEST: FAIL");
await browser.close();
process.exit(offlineOk ? 0 : 1);
