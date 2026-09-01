import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto("http://localhost:4700/", { waitUntil: "networkidle2" });
await p.waitForSelector(".stage, .blocked", { timeout: 20000 });
await new Promise(r => setTimeout(r, 1500));
const out = await p.evaluate(() => ({
  world: !!document.querySelector(".stage"),
  pill: document.querySelector(".pill")?.textContent ?? null,
  field: document.querySelector(".harbortitle")?.textContent ?? null,
}));
console.log(JSON.stringify(out));
await p.screenshot({ path: process.env.SS + "/sealed-harbor.png" });
await b.close();
