/* Isolated local-build visual/geometry regression. Fresh Chrome context;
   no user profile, engine process, publication or external account. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.DESIGN_BASE || 'http://127.0.0.1:4630';
const out = process.env.DESIGN_OUT || '/tmp/reiyah-design-review';
const quick = process.argv.includes('--quick');
const stations = ['harbor','findings','comparison','research','system','ledger','lineage','encounter','controls','estimands','adversaries','contract','chair','frontier','measurement','worstgroup','windshield','samehazard','law','monitor','reference'];
const only = process.argv.find(x=>x.startsWith('--station='))?.slice('--station='.length);
if(only && !stations.includes(only)) throw Error('Unknown station');
const views = quick ? [[1440,900,'dark'],[390,844,'light'],[375,667,'dark']] : [[1440,900,'dark'],[1366,768,'light'],[390,844,'light'],[375,667,'dark'],[320,740,'light'],[844,390,'dark']];
await fs.mkdir(out,{recursive:true});
const browser = await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-device-scale-factor=1']});
const report = {base, browser:await browser.version(), at:new Date().toISOString(), matrix:[], errors:[]};
try {
 for (const [width,height,ground] of views) {
  const context=await browser.createBrowserContext(); const page=await context.newPage();
  await page.setViewport({width,height,deviceScaleFactor:1,isMobile:width<700,hasTouch:width<700});
  await page.setBypassServiceWorker(true);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  page.on('pageerror',e=>report.errors.push({width,height,error:String(e)}));
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('.viewport.stage')?.getAttribute('aria-hidden')!=='true' && document.querySelector('.harbor-scene canvas'),{timeout:20000});
  if (await page.evaluate(()=>document.documentElement.dataset.ground)!==ground) await page.click('.groundtoggle');
  const dock=await page.$eval('.dockwrap',el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
  for (const station of only ? [only] : stations) {
   if(station!=='harbor') {await page.click('.dockall');await page.waitForSelector('.fieldindex');await page.click(`.fixrow[data-station="${station}"]`);}
   await page.waitForFunction(id=>document.querySelector('.panelcontent[data-preparing="false"]')?.dataset.station===id,{},station);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const geometry=await page.evaluate(()=>{
    const frame=document.querySelector('.panelcontent[data-preparing="false"]');const root=frame.firstElementChild;const r=frame.getBoundingClientRect();
    const scrolling=[...frame.querySelectorAll('.stbody,.onepage,.research-station,.harbor-restored')].map(el=>({class:el.className,overflow:getComputedStyle(el).overflow,client:[el.clientWidth,el.clientHeight],scroll:[el.scrollWidth,el.scrollHeight]})).filter(x=>x.scroll[1]>x.client[1]+3||x.scroll[0]>x.client[0]+3);
    const dr=document.querySelector('.dockwrap').getBoundingClientRect();
    return {frame:{x:r.x,y:r.y,width:r.width,height:r.height},scrolling,failed:!!frame.querySelector('.station-failure,.station-error,.blocked')||frame.textContent.includes('Station unavailable'),text:root?.textContent?.slice(0,70),dock:{x:dr.x,y:dr.y,width:dr.width,height:dr.height},headings:[...frame.querySelectorAll('h1,h2')].map(el=>({text:el.textContent,font:getComputedStyle(el).fontSize})),bodyOverflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1};
   });
   const dockStable=Object.keys(dock).every(k=>Math.abs(dock[k]-geometry.dock[k])<1);
   const file=`${width}x${height}-${ground}-${station}.png`;
   await page.screenshot({path:path.join(out,file)});
   report.matrix.push({width,height,ground,station,dockStable,...geometry,screenshot:file});
   console.log(`${width}x${height} ${station}: ${geometry.scrolling.length ? JSON.stringify(geometry.scrolling):'fits'}${geometry.failed?' BLOCKED':''}`);
  }
  await context.close();
 }
} finally {await browser.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({samples:report.matrix.length,runtimeErrors:report.errors.length,scrolling:report.matrix.filter(r=>r.scrolling.length).length,dockMoved:report.matrix.filter(r=>!r.dockStable).length}));
// Long reading panes may scroll internally. Normal desktop/portrait shells
// must fit; very short landscape retains accessible vertical overflow.
const failures=report.matrix.filter(r=>r.failed||!r.dockStable||r.bodyOverflow||(r.height>=600&&r.scrolling.length)||r.scrolling.some(s=>s.scroll[0]>s.client[0]+3));
if(report.errors.length||failures.length) {console.error(JSON.stringify({failures},null,2));process.exitCode=1;}
