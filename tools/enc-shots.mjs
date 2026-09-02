import puppeteer from "puppeteer-core";
const OUT = process.argv[2];
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args:["--hide-scrollbars"] });
const p = await b.newPage();
await p.setViewport({ width: 430, height: 932, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await p.goto("http://localhost:4600/?st=encounter", { waitUntil: "networkidle2" });
await p.waitForSelector(".encounter2", { timeout: 20000 });
await new Promise(r=>setTimeout(r,1400));
const depths = [0, 0.28, 0.55, 0.8, 0.97];
for (let i=0;i<depths.length;i++){
  await p.evaluate((d)=>{ const el=document.querySelector(".encounter2"); el.scrollTop = (el.scrollHeight-el.clientHeight)*d; }, depths[i]);
  await new Promise(r=>setTimeout(r,1100));
  await p.screenshot({ path: `${OUT}/enc-${i}.png` });
  console.log("shot", i, depths[i]);
}
await b.close();
