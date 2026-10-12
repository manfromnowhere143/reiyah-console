/* Local browser regression for the illustrated scenes. Every browser launch
   uses Puppeteer's fresh temporary profile, never the operator's Chrome data.
   This checks pixels and controls; it is not a performance benchmark. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const base = process.env.SCENE_BASE || 'http://127.0.0.1:4630';
const out = process.env.SCENE_OUT || '/tmp/reiyah-scene-review';
const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function motionPreference(page, value) {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value }]);
  await page.waitForFunction(reduced => matchMedia('(prefers-reduced-motion: reduce)').matches === reduced, {}, value === 'reduce');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
await fs.mkdir(out, { recursive: true });
const report = {
  base, at: new Date().toISOString(), deviceScaleFactor: 1.25,
  harnessSha256: createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),
  scope: 'Fresh-profile local Chromium pixel/control checks; not Safari, physical-device, scientific or performance validation.',
  browsers: [], scenarios: [], errors: [],
};
try {
  const bytes = Buffer.from(await (await fetch(`${base}/build.json`)).arrayBuffer());
  report.build = JSON.parse(bytes.toString());
  report.buildSha256 = createHash('sha256').update(bytes).digest('hex');
}
catch (error) { report.buildReadError = String(error); }
const saveReport = () => fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');

async function installAudit(page, force2d) {
  await page.evaluateOnNewDocument(disableWorker => {
    window.__sceneAudit = { writes: [], workerDisabled: disableWorker };
    for (const dimension of ['width', 'height']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dimension);
      Object.defineProperty(HTMLCanvasElement.prototype, dimension, {
        ...descriptor,
        set(value) {
          if (this.closest('.encStage,.harbor-scene')) {
            window.__sceneAudit.writes.push({
              kind: this.closest('.encStage') ? 'encounter' : 'harbor', dimension,
              previous: descriptor.get.call(this), requested: value,
            });
          }
          return descriptor.set.call(this, value);
        },
      });
    }
    if (disableWorker) Object.defineProperty(window, 'Worker', { value: undefined, configurable: true });
  }, force2d);
}

async function pixels(page, first, second) {
  return page.evaluate(async ({ a, b }) => {
    const decode = async encoded => {
      const blob = await (await fetch(`data:image/png;base64,${encoded}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      bitmap.close();
      return image;
    };
    const [one, two] = await Promise.all([decode(a), decode(b)]);
    if (one.width !== two.width || one.height !== two.height) {
      return { sameDimensions: false, first: [one.width, one.height], second: [two.width, two.height] };
    }
    let changedPixels = 0, significantChangedPixels = 0, centralChangedPixels = 0, maxChannelDifference = 0;
    const colors = new Set();
    for (let y = 0; y < one.height; y++) for (let x = 0; x < one.width; x++) {
      const at = (y * one.width + x) * 4;
      let changed = false, significant = false;
      for (let c = 0; c < 4; c++) {
        const difference = Math.abs(one.data[at + c] - two.data[at + c]);
        changed ||= difference !== 0;
        significant ||= difference > 1;
        maxChannelDifference = Math.max(maxChannelDifference, difference);
      }
      if (changed) {
        changedPixels++;
        if (significant) significantChangedPixels++;
        if (significant && x > one.width * .28 && x < one.width * .68 && y > one.height * .4 && y < one.height * .82) centralChangedPixels++;
      }
      if ((x + y * one.width) % 53 === 0) colors.add(`${one.data[at]},${one.data[at + 1]},${one.data[at + 2]}`);
    }
    const digest = async data => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
    return { sameDimensions: true, width: one.width, height: one.height,
      changedPixels, significantChangedPixels, centralChangedPixels, maxChannelDifference, sampledColors: colors.size,
      firstPixelSha256: await digest(one.data), secondPixelSha256: await digest(two.data) };
  }, { a: Buffer.from(first).toString('base64'), b: Buffer.from(second).toString('base64') });
}

async function dimensions(page, selector, kind) {
  return page.$eval(selector, async (canvas, kind) => {
    let directPixelSha256 = null, directPixelRead = 'transferred canvas; compositor screenshot only';
    try {
      const context = canvas.getContext('2d');
      if (context) {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        directPixelSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)), b => b.toString(16).padStart(2, '0')).join('');
        directPixelRead = 'visible 2D canvas getImageData';
      }
    } catch { /* A transferred OffscreenCanvas cannot be read on this thread. */ }
    return {
      width: canvas.width, height: canvas.height,
      clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight,
      dpr: devicePixelRatio, directPixelSha256, directPixelRead,
      playing: kind === 'encounter' ? document.querySelector('.encPlay')?.getAttribute('aria-pressed') === 'true' : document.querySelector('.scene-pause')?.getAttribute('aria-pressed') === 'false',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      clock: kind === 'encounter' ? Number(document.querySelector('.encTrack')?.getAttribute('aria-valuenow')) : null,
      writes: window.__sceneAudit.writes.filter(write => write.kind === kind),
    };
  }, kind);
}

async function sample(page, scenario, selector, label, shouldMove, check) {
  await page.mouse.move(0, 0);
  await delay(600); // allow the explicit state change and overlay transitions to settle
  const element = await page.$(selector);
  const box = await element.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) throw new Error(`${selector}: no visible scene`);
  const kind = selector.includes('encStage') ? 'encounter' : 'harbor';
  const before = await dimensions(page, selector, kind);
  const firstName = `${scenario.id}-${label}-a.png`, secondName = `${scenario.id}-${label}-b.png`;
  const first = await page.screenshot({ path: path.join(out, firstName), clip: box });
  const at = performance.now();
  await delay(500);
  const second = await page.screenshot({ path: path.join(out, secondName), clip: box });
  const elapsedMs = performance.now() - at;
  const after = await dimensions(page, selector, kind);
  const comparison = await pixels(page, first, second);
  scenario.samples.push({ label, expectedMotion: shouldMove, elapsedMs,
    files: [firstName, secondName], pngSha256: [first, second].map(bytes => createHash('sha256').update(bytes).digest('hex')),
    before, after, pixels: comparison });
  check(`${label}: nonempty illustrated scene`, comparison.sameDimensions && comparison.sampledColors > 16, comparison);
  check(`${label}: control matches the requested motion state`, before.playing === shouldMove && after.playing === shouldMove, { before: before.playing, after: after.playing });
  // Fractional-DPR Chromium compositing can change a few channels by one
  // 8-bit level. Preserve exact differences and separately require zero
  // changes greater than one level; direct 2D canvas bytes must be identical.
  check(`${label}: ${shouldMove ? 'visible central scene motion' : 'visually fixed rendered pixels'} over at least 500ms`,
    elapsedMs >= 500 && comparison.sameDimensions && (shouldMove ? comparison.centralChangedPixels > 100 : comparison.significantChangedPixels === 0), comparison);
  if (!shouldMove && before.directPixelSha256) check(`${label}: exact underlying 2D canvas bytes remain fixed`, before.directPixelSha256 === after.directPixelSha256, { before: before.directPixelSha256, after: after.directPixelSha256 });
  if (kind === 'encounter' || scenario.force2d) {
    check(`${label}: direct 2D canvas bytes are readable`, !!before.directPixelSha256 && !!after.directPixelSha256);
    check(`${label}: device-pixel dimensions are quantized`,
      after.width === Math.max(1, Math.round(after.clientWidth * Math.min(2, after.dpr))) &&
      after.height === Math.max(1, Math.round(after.clientHeight * Math.min(2, after.dpr))), after);
    check(`${label}: no repeated canvas resize`, before.writes.length === after.writes.length, {
      before: before.writes.length, after: after.writes.length,
    });
  }
}

async function harbor(page, scenario, check) {
  const button = '.scene-pause', canvas = '.harbor-scene .fieldwrap canvas';
  await page.waitForFunction(() => document.querySelector('.panelcontent[data-station="harbor"]')?.getAttribute('data-preparing') === 'false' && document.querySelector('.harbor-scene .fieldwrap')?.dataset.render, { timeout: 25000 });
  await page.evaluate(() => document.fonts.ready);
  if (await page.evaluate(() => document.documentElement.dataset.ground) !== scenario.ground) await page.click('.groundtoggle');
  scenario.renderMode = await page.$eval('.harbor-scene .fieldwrap', element => element.dataset.render);
  if (scenario.force2d) check('Worker-disabled startup selects 2D fallback', scenario.renderMode === '2d');
  check('fractional DPR is active', (await page.evaluate(() => devicePixelRatio)) === 1.25);
  check('reduced motion starts paused', await page.$eval(button, element => element.getAttribute('aria-pressed') === 'true' && element.getAttribute('aria-label') === 'Play motion'));
  await sample(page, scenario, canvas, 'harbor-reduced-start', false, check);
  await page.click(button);
  await page.waitForFunction(() => document.querySelector('.scene-pause')?.getAttribute('aria-pressed') === 'false');
  check('explicit Play works while reduced motion remains preferred', await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
  await sample(page, scenario, canvas, 'harbor-explicit-play', true, check);
  await page.click(button);
  await page.waitForFunction(() => document.querySelector('.scene-pause')?.getAttribute('aria-pressed') === 'true');
  await sample(page, scenario, canvas, 'harbor-user-stop', false, check);
  await motionPreference(page, 'no-preference');
  if (await page.$eval(button, element => element.getAttribute('aria-pressed')) === 'true') await page.click(button);
  await page.waitForFunction(() => document.querySelector('.scene-pause')?.getAttribute('aria-pressed') === 'false');
  await sample(page, scenario, canvas, 'harbor-normal-play', true, check);
  await motionPreference(page, 'reduce');
  await page.waitForFunction(() => document.querySelector('.scene-pause')?.getAttribute('aria-pressed') === 'true');
  await sample(page, scenario, canvas, 'harbor-preference-stop', false, check);
  check('no scene error is displayed', (await page.$('.scene-error')) === null);
}

async function encounter(page, scenario, check) {
  await page.click('.dockall');
  await page.waitForSelector('.fieldindex');
  await page.click('.fixrow[data-station="encounter"]');
  await page.waitForFunction(() => document.querySelector('.panelcontent[data-station="encounter"]')?.getAttribute('data-preparing') === 'false' && document.querySelectorAll('.encJourney button').length === 7, { timeout: 20000 });
  const expected = [
    ['OBSERVATION', 0], ['BELIEF', 1], ['DECISION', 2], ['INTERVENTION', 3],
    ['OUTCOME WINDOW', 4], ['THE JOINT SILENT MISS', 6.5], ['EVIDENCE', 10],
  ];
  check('all seven encounter beats are available', await page.$$eval('.encJourney button', buttons => buttons.length) === expected.length);
  scenario.beats = [];
  for (let i = 0; i < expected.length; i++) {
    const [heading, time] = expected[i];
    await page.click(`.encJourney button:nth-child(${i + 1})`);
    await page.waitForFunction(expected => document.querySelector('.encBeatK')?.textContent === expected, {}, heading);
    await delay(250);
    const state = await page.evaluate(() => ({
      heading: document.querySelector('.encBeatK').textContent,
      body: document.querySelector('.encBeatBody').textContent,
      time: Number(document.querySelector('.encTrack').getAttribute('aria-valuenow')),
      paused: document.querySelector('.encPlay').getAttribute('aria-pressed') === 'false',
      current: [...document.querySelectorAll('.encJourney button')].findIndex(button => button.getAttribute('aria-current') === 'step'),
      geometry: (() => {
        const frame = document.querySelector('.panelcontent[data-station="encounter"]').getBoundingClientRect();
        const selectors = ['.encounter2', '.encStage canvas', '.encCaption', '.encScrub', '.encJourney', '.encReal', '.encPlay', '.encTrack', '.encJourney button'];
        return selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(element => {
          const rect = element.getBoundingClientRect();
          return { selector, text: element === document.querySelector('.encCaption') ? element.textContent : element.getAttribute('aria-label'),
            x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            insideFrame: rect.x >= frame.x - 1 && rect.y >= frame.y - 1 && rect.right <= frame.right + 1 && rect.bottom <= frame.bottom + 1,
            visible: rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden',
          };
        }));
      })(),
    }));
    const file = `${scenario.id}-encounter-beat-${i + 1}.png`;
    await page.screenshot({ path: path.join(out, file) });
    scenario.beats.push({ ...state, screenshot: file });
    check(`beat ${i + 1}: ${heading} selects its exact fixture time and pauses`, state.heading === heading && state.time === time && state.paused && state.current === i, state);
    check(`beat ${i + 1}: scene, caption, records and controls remain inside the station`, state.geometry.every(element => element.insideFrame && element.visible), state.geometry);
    if (i === 5) check('joint silent miss stays explicitly conceptual', state.body.includes('not measured in this fixture'), state.body);
  }
  await page.focus('.encTrack');
  const keyStates = [];
  for (const [key, expectedTime] of [['Home', -1], ['ArrowRight', -.7], ['ArrowLeft', -1], ['End', 11]]) {
    await page.keyboard.press(key);
    await page.waitForFunction(time => Number(document.querySelector('.encTrack')?.getAttribute('aria-valuenow')) === time, {}, expectedTime);
    const state = await page.evaluate(() => ({ time: Number(document.querySelector('.encTrack').getAttribute('aria-valuenow')), focused: document.activeElement === document.querySelector('.encTrack'), paused: document.querySelector('.encPlay').getAttribute('aria-pressed') === 'false' }));
    keyStates.push({ key, ...state });
    check(`slider ${key} changes time and retains keyboard focus`, state.time === expectedTime && state.focused && state.paused, state);
  }
  scenario.slider = keyStates;
  await page.focus('.encJourney button:nth-child(2)');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.encBeatK')?.textContent === 'BELIEF');
  check('beat buttons support keyboard activation', await page.$eval('.encTrack', element => Number(element.getAttribute('aria-valuenow'))) === 1);
  await page.click('.encJourney button[data-jsm="true"]');
  await sample(page, scenario, '.encStage canvas', 'encounter-selected-paused', false, check);
  const beforePlay = await page.$eval('.encTrack', element => Number(element.getAttribute('aria-valuenow')));
  await page.click('.encPlay');
  await page.waitForFunction(() => document.querySelector('.encPlay')?.getAttribute('aria-pressed') === 'true');
  await page.waitForFunction(before => Number(document.querySelector('.encTrack')?.getAttribute('aria-valuenow')) > before, {}, beforePlay);
  check('explicit encounter Play advances the fixture clock under reduced motion', await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches && document.querySelector('.encPlay')?.getAttribute('aria-pressed') === 'true'));
  await motionPreference(page, 'no-preference');
  await sample(page, scenario, '.encStage canvas', 'encounter-normal-play', true, check);
  await page.click('.encPlay');
  await page.waitForFunction(() => document.querySelector('.encPlay')?.getAttribute('aria-pressed') === 'false');
  await sample(page, scenario, '.encStage canvas', 'encounter-user-pause', false, check);
  await motionPreference(page, 'no-preference');
  await page.click('.encPlay');
  await page.waitForFunction(() => document.querySelector('.encPlay')?.getAttribute('aria-pressed') === 'true');
  await delay(150);
  await motionPreference(page, 'reduce');
  await page.waitForFunction(() => document.querySelector('.encPlay')?.getAttribute('aria-pressed') === 'false');
  await sample(page, scenario, '.encStage canvas', 'encounter-preference-stop', false, check);
}

for (const force2d of [false, true]) {
  const browser = await puppeteer.launch({ executablePath, headless: true });
  report.browsers.push({ force2d, version: await browser.version() });
  try {
    const views = force2d ? [[1440, 900], [375, 667]] : [[1440, 900], [375, 667], [844, 390]];
    for (const [width, height] of views) for (const ground of ['dark', 'light']) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const scenario = { id: `${force2d ? 'fallback' : 'worker'}-${width}x${height}-${ground}`, force2d, width, height, ground, checks: [], samples: [] };
      report.scenarios.push(scenario);
      const check = (name, passed, detail) => { scenario.checks.push({ name, passed: !!passed, ...(detail === undefined ? {} : { detail }) }); if (!passed) console.error(`${scenario.id}: FAIL ${name}`); };
      page.on('pageerror', error => report.errors.push({ scenario: scenario.id, error: String(error) }));
      try {
        await page.setViewport({ width, height, deviceScaleFactor: 1.25, isMobile: width < 700, hasTouch: width < 700 });
        await page.setBypassServiceWorker(true);
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await installAudit(page, force2d);
        await page.goto(base, { waitUntil: 'networkidle0', timeout: 30000 });
        await harbor(page, scenario, check);
        if (!force2d) await encounter(page, scenario, check);
      } catch (error) {
        check('scenario completes', false, String(error));
        await page.screenshot({ path: path.join(out, `${scenario.id}-failure.png`) }).catch(() => {});
      } finally { await context.close(); await saveReport(); }
      console.log(`${scenario.id}: ${scenario.checks.filter(check => check.passed).length}/${scenario.checks.length} checks`);
    }
  } finally { await browser.close(); }
}
report.completedAt = new Date().toISOString();
try {
  const bytes = Buffer.from(await (await fetch(`${base}/build.json`)).arrayBuffer());
  report.finalBuildSha256 = createHash('sha256').update(bytes).digest('hex');
  if (!report.buildSha256 || report.finalBuildSha256 !== report.buildSha256) report.errors.push({ error: 'Local build marker changed or was unavailable during this run.' });
} catch (error) { report.errors.push({ error: `Final build marker unavailable: ${String(error)}` }); }
report.summary = {
  scenarios: report.scenarios.length,
  checks: report.scenarios.reduce((sum, scenario) => sum + scenario.checks.length, 0),
  failed: report.scenarios.reduce((sum, scenario) => sum + scenario.checks.filter(check => !check.passed).length, 0),
  runtimeErrors: report.errors.length,
  normalRenderModes: [...new Set(report.scenarios.filter(scenario => !scenario.force2d).map(scenario => scenario.renderMode))],
};
await saveReport();
console.log(JSON.stringify(report.summary));
if (report.summary.failed || report.summary.runtimeErrors) process.exitCode = 1;
