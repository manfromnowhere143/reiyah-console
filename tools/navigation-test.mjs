/* Browser regression for the actual field-index gesture. Serve the built
   snapshot locally first. No sealer, publisher, engine or external API runs.
   Default: installed Chrome + puppeteer-core. For WebKit, set NAV_WEBKIT to
   an installed playwright module's index.mjs (no runtime dependency). */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const base = process.env.NAV_BASE ?? "http://127.0.0.1:4620";
const out = process.env.NAV_OUT ?? "/tmp/reiyah-navigation-tests";
const webkitModule = process.env.NAV_WEBKIT;
const quick = process.argv.includes("--quick");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await fs.mkdir(out, { recursive: true });
const browser = webkitModule
  ? await (await import(pathToFileURL(webkitModule).href)).webkit.launch({ headless: true })
  : await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const report = { browser: webkitModule ? "webkit" : "chromium", matrix: [], controls: [] };

async function until(page, predicate, arg, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(predicate, arg)) return;
    await sleep(25);
  }
  const state = await page.evaluate(() => ({ url: location.href, active: document.querySelector('.panelcontent[data-preparing="false"]')?.dataset.station,
    pending: document.querySelector('.panelcontent[data-preparing="true"]')?.dataset.station, menu: !!document.querySelector(".fieldindex"),
    body: document.body.innerText.slice(0, 300), focus: document.activeElement?.outerHTML.slice(0, 250) }));
  await page.screenshot({ path: path.join(out, "timeout.png") });
  throw new Error(`Condition timed out for ${JSON.stringify(arg)}: ${JSON.stringify(state)}\n${predicate}`);
}

async function open({ width = 390, height = 660, ground = "dark", reduced = false, intercept } = {}) {
  const context = webkitModule
    ? await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference", serviceWorkers: "block" })
    : await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  if (!webkitModule) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setBypassServiceWorker(true);
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
  }
  if (intercept) {
    if (webkitModule) await page.route("**/*", async (route) => {
      const action = await intercept(route.request().url());
      if (action === "abort") await route.abort(); else await route.continue();
    });
    else {
      await page.setRequestInterception(true);
      page.on("request", async (request) => {
        const action = await intercept(request.url());
        if (action === "abort") await request.abort(); else await request.continue();
      });
    }
  }
  await page.goto(base, { waitUntil: "load" });
  await until(page, () => !!document.querySelector(".stage .harbor canvas"));
  await until(page, () => Number(getComputedStyle(document.querySelector(".stage")).opacity) === 1);
  if (await page.evaluate(() => document.documentElement.dataset.ground) !== ground) await page.click(".groundtoggle");
  return { page, context, errors };
}

async function startSampling(page) {
  await page.evaluate(() => {
    const data = window.__navigationSamples = { running: true, frames: [], started: performance.now() };
    function sample(time) {
      if (!data.running) return;
      const all = [...document.querySelectorAll(".panelcontent")];
      const visible = all.filter((el) => getComputedStyle(el).visibility !== "hidden");
      const el = visible[0];
      data.frames.push({
        at: time - data.started,
        visible: visible.length,
        framesMounted: all.length,
        station: el?.dataset.station,
        opacity: el ? Number(getComputedStyle(el).opacity) : 0,
        empty: !el?.innerText.trim(),
        loading: !!el && [...el.querySelectorAll(".note")].some((n) => /reading.*…/i.test(n.textContent)),
        hiddenIsInert: all.filter((n) => n.dataset.preparing === "true").every((n) => n.inert && n.getAttribute("aria-hidden") === "true"),
      });
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
}

async function stopSampling(page, label) {
  const frames = await page.evaluate(() => { window.__navigationSamples.running = false; return window.__navigationSamples.frames; });
  assert.ok(frames.length > 0, `${label}: no sampled frames`);
  const bad = frames.filter((f) => f.visible !== 1 || f.framesMounted > 2 || f.opacity < 0.99 || f.empty || f.loading || !f.hiddenIsInert);
  assert.deepEqual(bad, [], `${label}: content continuity failed`);
  return { frames: frames.length, maxGapMs: Math.round(Math.max(0, ...frames.slice(1).map((f, i) => f.at - frames[i].at))), blankFrames: 0 };
}

async function select(page, id) {
  await page.click(".dockall");
  await until(page, () => !!document.querySelector(".fieldindex"));
  await page.click(`.fixrow[data-station="${id}"]`);
}
async function arrived(page, id) {
  await until(page, (id) => document.querySelector('.panelcontent[data-preparing="false"]')?.dataset.station === id
    && document.querySelector(".stagepanel")?.getAttribute("aria-busy") === "false" && !document.querySelector(".fieldindex"), id);
}
async function geometry(page) {
  return page.evaluate(() => {
    const rect = document.querySelector(".dockwrap").getBoundingClientRect();
    const bodies = [...document.querySelectorAll('.panelcontent[data-preparing="false"] .stbody')];
    return { dockTop: rect.top, dockBottom: rect.bottom, viewport: innerHeight,
      overflow: bodies.map((el) => Math.max(0, el.scrollHeight - el.clientHeight)),
      documentOverflow: document.documentElement.scrollHeight - innerHeight };
  });
}

try {
  const viewports = process.argv.includes("--controls-only") ? [] : quick ? [[390, 660]] : [[1280, 820], [430, 745], [390, 660]];
  for (const [width, height] of viewports) for (const ground of quick ? ["dark"] : ["dark", "light"]) {
    const { page, context, errors } = await open({ width, height, ground });
    const ids = await page.$$eval(".dock .navcard", (cards) => cards.map((c) => c.dataset.station));
    const first = await geometry(page);
    for (const id of ids) {
      const label = `${width}x${height}-${ground}-${id}`;
      await startSampling(page);
      await select(page, id);
      await arrived(page, id);
      await sleep(70);
      const continuity = await stopSampling(page, label);
      const shape = await geometry(page);
      assert.ok(shape.overflow.every((n) => n <= 2), `${label}: station overflow ${JSON.stringify(shape)}`);
      assert.ok(Math.abs(shape.dockTop - first.dockTop) < 1 && shape.dockBottom <= height + 1, `${label}: dock moved`);
      assert.ok(shape.documentOverflow <= 1, `${label}: document scrolls`);
      await page.screenshot({ path: path.join(out, `${label}.png`) });
      report.matrix.push({ label, ...continuity, ...shape });
    }
    assert.deepEqual(errors, [], "uncaught page errors");
    await context.close();
    console.log(`${width}x${height} ${ground}: ${ids.length} stations, no blank frames, no overflow`);
  }

  // Native panel transitions, browser history, and keyboard focus continuity.
  {
    const { page, context, errors } = await open();
    await startSampling(page);
    await page.click('.navcard[data-station="system"]');
    await arrived(page, "system");
    await sleep(240);
    await page.click('.navcard[data-station="ledger"]');
    await arrived(page, "ledger");
    await sleep(240);
    await page.evaluate(() => history.back());
    await arrived(page, "system");
    await sleep(240);
    await page.evaluate(() => history.forward());
    await arrived(page, "ledger");
    await sleep(240);
    report.controls.push({ label: "dock-back-forward", ...await stopSampling(page, "dock-back-forward") });
    await page.click(".dockall");
    await until(page, () => document.activeElement?.classList.contains("fixrow"));
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.querySelector('.panelcontent[data-preparing="false"]').dataset.station), "ledger");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => !!document.querySelector(".fieldindex")), false);
    assert.equal(await page.evaluate(() => document.querySelector('.panelcontent[data-preparing="false"]').dataset.station), "ledger");
    assert.equal(await page.evaluate(() => document.activeElement?.className), "dockall glass");
    report.controls.push({ label: "index-keyboard-focus-and-escape", passed: true });
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Slow first code load: the menu and current page stay in place. A newer
  // selection wins even after the old import eventually resolves.
  {
    let release;
    const held = new Promise((r) => { release = r; });
    const { page, context, errors } = await open({ intercept: async (url) => { if (/\/Adversaries-[^/]+\.js/.test(url)) await held; } });
    await startSampling(page);
    await select(page, "adversaries");
    await sleep(200);
    assert.equal(await page.evaluate(() => !!document.querySelector(".fieldindex")), true);
    assert.equal(await page.evaluate(() => document.querySelector('.panelcontent[data-preparing="false"]').dataset.station), "harbor");
    await page.screenshot({ path: path.join(out, "slow-load-preserves-menu.png") });
    await page.click('.fixrow[data-station="controls"]');
    await arrived(page, "controls");
    release();
    await sleep(450);
    assert.equal(await page.evaluate(() => document.querySelector('.panelcontent[data-preparing="false"]').dataset.station), "controls");
    assert.equal(new URL(page.url()).searchParams.get("st"), "controls");
    report.controls.push({ label: "slow-code-and-latest-request-wins", ...await stopSampling(page, "slow-code") });
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Slow data (not just code). Cancel by closing the menu, then retry; the
  // actual reader must settle before the destination can be exposed.
  {
    let release;
    const held = new Promise((r) => { release = r; });
    const { page, context, errors } = await open({ intercept: async (url) => { if (url.includes("worst-group-records.jsonl")) await held; } });
    await startSampling(page);
    await select(page, "worstgroup");
    await sleep(250);
    assert.equal(await page.evaluate(() => !!document.querySelector(".fieldindex")), true);
    await page.keyboard.press("Escape");
    release();
    await sleep(200);
    assert.equal(await page.evaluate(() => document.querySelector('.panelcontent[data-preparing="false"]').dataset.station), "harbor");
    await select(page, "worstgroup");
    await arrived(page, "worstgroup");
    report.controls.push({ label: "slow-data-cancel-and-retry", ...await stopSampling(page, "slow-data") });
    assert.deepEqual(errors, []);
    await context.close();
  }

  for (const failure of ["code", "data"]) {
    const { page, context } = await open({ intercept: async (url) => {
      if (failure === "code" ? /\/Measurement-[^/]+\.js/.test(url) : url.includes("worst-group-records.jsonl")) return "abort";
    } });
    const id = failure === "code" ? "measurement" : "worstgroup";
    await startSampling(page);
    await select(page, id);
    await arrived(page, id);
    assert.ok(await page.$('.panelcontent[data-preparing="false"] .blocked'), `${failure}: explicit failure missing`);
    await select(page, "harbor");
    await arrived(page, "harbor");
    report.controls.push({ label: `failed-${failure}-keeps-navigation-usable`, ...await stopSampling(page, failure) });
    await context.close();
  }

  for (const reduced of [true, false]) {
    const { page, context, errors } = await open({ reduced });
    if (!reduced) await page.evaluate(() => { document.startViewTransition = undefined; });
    await startSampling(page);
    await page.click('.navcard[data-station="system"]');
    await arrived(page, "system");
    report.controls.push({ label: reduced ? "reduced-motion" : "without-view-transitions", ...await stopSampling(page, "fallback") });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`${report.controls.length} navigation, failure and accessibility controls passed`);
  report.status = "pass";
} catch (error) {
  report.status = "fail";
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
