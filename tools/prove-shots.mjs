import puppeteer from "puppeteer-core";
const OUT=process.argv[2];
const b=await puppeteer.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:"new",args:["--hide-scrollbars"]});
const p=await b.newPage(); await p.setViewport({width:1440,height:900,deviceScaleFactor:2});
await p.goto("http://localhost:4600/",{waitUntil:"networkidle2"});
await p.waitForSelector(".stage",{timeout:20000}); await new Promise(r=>setTimeout(r,1400));
// click the field digest chip
await p.click(".fieldhud .digest");
// capture frames rapidly to catch any resize
for(let i=0;i<4;i++){ await new Promise(r=>setTimeout(r,i===0?40:120)); await p.screenshot({path:`${OUT}/prove-${i}.png`}); }
await b.close(); console.log("done");
