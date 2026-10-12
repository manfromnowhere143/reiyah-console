/* Real-browser research states, receipt containment, and input-intent checks.
   Uses an isolated profile against the built application; no user session. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const base = process.env.DESIGN_BASE || 'http://127.0.0.1:4630';
const out = process.env.DESIGN_OUT || '/tmp/reiyah-reading-review';
await fs.mkdir(out, {recursive:true});
const browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
const report = {at:new Date().toISOString(), browser:await browser.version(), readings:[], dialogs:[], errors:[]};
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function select(page,id) {
  await page.click('.dockall'); await page.waitForSelector('.fieldindex');
  await page.click(`.fixrow[data-station="${id}"]`);
  await page.waitForFunction(id => document.querySelector('.panelcontent[data-preparing="false"]')?.dataset.station === id,{},id);
  await settle(page);
}
async function shape(page,label) {
  await settle(page);
  const result = await page.evaluate(() => {
    const el=document.querySelector('.panelcontent[data-preparing="false"] .research-station');
    const frame=document.querySelector('.panelcontent[data-preparing="false"]').getBoundingClientRect();
    const scope=el.querySelector('.research-limit')?.getBoundingClientRect();
    return {client:[el.clientWidth,el.clientHeight],scroll:[el.scrollWidth,el.scrollHeight],scopeVisible:!!scope && scope.bottom<=frame.bottom+1,text:el.innerText, url:location.href};
  });
  report.readings.push({label,...result});
  await page.screenshot({path:path.join(out,`${label}.png`)});
}
async function dialogShape(page,selector,label) {
  await settle(page);
  const result=await page.$eval(selector,el=>{const r=el.getBoundingClientRect();const c=el.querySelector('button').getBoundingClientRect();return {bounds:[r.left,r.top,r.right,r.bottom],viewport:[innerWidth,innerHeight],fits:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,closeVisible:c.top>=r.top&&c.bottom<=r.bottom&&c.right<=r.right,wideOverflow:el.scrollWidth>el.clientWidth+1};});
  report.dialogs.push({label,...result});
  await page.screenshot({path:path.join(out,`${label}.png`)});
  assert.ok(result.fits && result.closeVisible && !result.wideOverflow,`${label}: modal outside viewport`);
}
async function receipt(page,selector,label) {
  await page.click(selector);
  await page.waitForSelector('.receipt-outcome[data-match="true"]',{timeout:15000});
  await page.waitForSelector('.receipt-fold .computed-root',{timeout:15000});
  await dialogShape(page,'.receipt-dialog',label);
  if (await page.$eval('.receipt-details summary',el=>el.getBoundingClientRect().height>0)) {
    await page.click('.receipt-details summary');
    await dialogShape(page,'.receipt-dialog',label+'-details');
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.receipt-dialog'));
}
try {
 for(const [width,height,ground] of [[1440,900,'dark'],[390,844,'light'],[375,667,'dark'],[320,740,'light'],[844,390,'dark']]) {
  const context=await browser.createBrowserContext(), page=await context.newPage();
  const prefix=`${width}x${height}-${ground}`;
  await page.setViewport({width,height,deviceScaleFactor:1,isMobile:width<700,hasTouch:width<700});
  await page.setBypassServiceWorker(true);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  page.on('pageerror',e=>report.errors.push({prefix,error:String(e)}));
  await page.goto(base,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('.viewport.stage')?.getAttribute('aria-hidden')!=='true'&&document.querySelector('.harbor-scene canvas'),{timeout:20000});
  if(await page.evaluate(()=>document.documentElement.dataset.ground)!==ground) await page.click('.groundtoggle');
  await select(page,'findings');
  for(let chapter=0;chapter<8;chapter++) {
   await page.click(`.study-nav button:nth-child(${chapter+1})`);await settle(page);
   const id=await page.$eval('[data-finding]',el=>el.dataset.finding);
   const controls=await page.$$('.finding-figure .research-segments button,.finding-figure .correction-index button');
   if(!controls.length) await shape(page,`${prefix}-${id}`);
   for(let i=0;i<controls.length;i++) {await controls[i].click();await shape(page,`${prefix}-${id}-${i}`);}
   await page.click('.finding-footer button');await page.waitForSelector('dialog.finding-reader[open]');
   await dialogShape(page,'dialog.finding-reader',`${prefix}-${id}-method`);
   if(chapter===0) await receipt(page,'dialog.finding-reader .digest',`${prefix}-edition-receipt`);
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('dialog.finding-reader'));
   assert.ok(await page.$eval('.finding-footer button',el=>el===document.activeElement), 'Method returns focus to trigger');
  }
  await select(page,'comparison');
  for(let i=0;i<2;i++) {await page.click(`.comparison-control-row button:nth-child(${i+1})`);await shape(page,`${prefix}-comparison-${i}`);}
  await page.click('.comparison-source-actions .research-button');await page.waitForSelector('dialog.comparison-reader[open]');
  await dialogShape(page,'dialog.comparison-reader',`${prefix}-comparison-contract`);
  await page.keyboard.press('Escape');
  await receipt(page,'.comparison-source-actions .digest',`${prefix}-replay-receipt`);
  // Pointer activation keeps semantic focus without a lingering outline.
  await page.click('.comparison-control-row button');
  assert.equal(await page.$eval('.comparison-control-row button',el=>getComputedStyle(el).outlineStyle),'none');
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(()=>document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineStyle!=='none'),'Keyboard focus remains visible');
  await select(page,'harbor');
  await receipt(page,'.harbor-restored .digest',`${prefix}-historical-receipt`);
  await context.close();
 }
 assert.equal(report.errors.length,0,'Uncaught runtime errors');
} finally {await browser.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
const portraitOverflow=report.readings.filter(r=>!r.label.startsWith('844x390')&&(r.scroll[0]>r.client[0]+3||r.scroll[1]>r.client[1]+3||!r.scopeVisible));
console.log(JSON.stringify({readings:report.readings.length,dialogs:report.dialogs.length,runtimeErrors:report.errors.length,portraitOverflow:portraitOverflow.map(r=>({label:r.label,client:r.client,scroll:r.scroll,scopeVisible:r.scopeVisible}))},null,2));
assert.equal(portraitOverflow.length,0,'Research states must fit tested desktop and portrait viewports');
