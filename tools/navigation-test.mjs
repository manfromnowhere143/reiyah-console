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

async function open({ width = 390, height = 660, ground = "dark", reduced = false, touch = false, intercept } = {}) {
  const context = webkitModule
    ? await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference", serviceWorkers: "block" })
    : await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  if (!webkitModule) {
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
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
  await until(page, () => !!document.querySelector(".stage .harbor canvas") && !document.querySelector(".boot"));
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
      const dock = document.querySelector(".dockwrap").getBoundingClientRect();
      data.frames.push({
        at: time - data.started,
        visible: visible.length,
        framesMounted: all.length,
        station: el?.dataset.station,
        opacity: el ? Number(getComputedStyle(el).opacity) : 0,
        empty: !el?.innerText.trim(),
        dockTop: dock.top, dockHeight: dock.height,
        unfinishedDrawings: el ? [...el.querySelectorAll(".wscene")].filter((c) => c.clientWidth && c.clientHeight &&
          (c.dataset.ready !== "true" || Number(getComputedStyle(c).opacity) < 0.99)).length : 0,
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
  const bad = frames.filter((f) => f.visible !== 1 || f.framesMounted > 2 || f.opacity < 0.99 || f.empty || f.loading || !f.hiddenIsInert
    || f.unfinishedDrawings || Math.abs(f.dockTop - frames[0].dockTop) > 0.5 || Math.abs(f.dockHeight - frames[0].dockHeight) > 0.5);
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

  // A prefetched first visit must not acquire a fallback's artificial wait.
  // Ledger uses already verified boot data, isolating code/reveal scheduling
  // from network speed. The previous lazy/Suspense path took about 333ms.
  {
    const { page, context, errors } = await open();
    await page.click(".dockall");
    await page.hover('.fixrow[data-station="ledger"]');
    await until(page, () => performance.getEntriesByType("resource").some((e) => /\/Ledger-[^/]+\.js/.test(e.name) && e.responseEnd > 0));
    await sleep(100); // let the prefetched module evaluate, without mounting it
    await page.evaluate(() => {
      const row = document.querySelector('.fixrow[data-station="ledger"]');
      row.addEventListener("click", () => {
        const run = window.firstVisit = { started: performance.now(), spinner: false };
        const watch = new MutationObserver(() => {
          run.spinner ||= !!document.querySelector('[data-pending="true"]');
          if (document.querySelector('.panelcontent[data-preparing="false"]')?.dataset.station === "ledger") {
            run.commitMs = performance.now() - run.started;
            watch.disconnect();
          }
        });
        watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-preparing", "data-pending"] });
      }, { once: true });
    });
    await startSampling(page);
    await page.click('.fixrow[data-station="ledger"]');
    await arrived(page, "ledger");
    const timing = await page.evaluate(() => window.firstVisit);
    assert.ok(timing.commitMs < 200, `prefetched first visit waited ${timing.commitMs}ms`);
    assert.equal(timing.spinner, false, "prefetched content showed a loading indicator");
    report.controls.push({ label: "prefetched-first-visit-without-fallback-delay", commitMs: timing.commitMs, ...await stopSampling(page, "first-visit") });
    assert.deepEqual(errors, []); await context.close();
  }

  // Pointer and touch selection must not leave a focus border behind; moving
  // to the keyboard must still expose focus and support Enter/Escape normally.
  for (const touch of [false, true]) for (const ground of ["dark", "light"]) {
    const { page, context, errors } = await open({ width: touch ? 390 : 1280, height: touch ? 660 : 820, touch, ground });
    const press = (selector) => touch ? page.tap(selector) : page.click(selector);
    const label = `${touch ? "touch" : "pointer"}-${ground}-index-focus`;
    const pointerFocus = async () => {
      assert.ok(await page.evaluate(() => document.activeElement.matches('.fixrow[data-active="true"]')));
      assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none", `${label}: pointer focus stayed outlined`);
    };
    await press(".dockall"); await sleep(180); await pointerFocus();
    await press('.fixrow[data-station="measurement"]'); await arrived(page, "measurement");
    await press(".dockall"); await sleep(180); await pointerFocus();
    await page.screenshot({ path: path.join(out, `${label}.png`) });
    await page.keyboard.press("ArrowDown");
    const keyboard = await page.evaluate(() => {
      const el = document.activeElement, css = getComputedStyle(el);
      return { station: el.dataset.station, visible: el.matches(":focus-visible"), outline: css.outlineStyle, color: css.outlineColor, ink: css.color };
    });
    assert.equal(keyboard.station, "worstgroup"); assert.ok(keyboard.visible && keyboard.outline !== "none");
    assert.equal(keyboard.color, keyboard.ink, `${label}: focus should use neutral ink`);
    await page.keyboard.press("Enter"); await arrived(page, "worstgroup");
    assert.ok(await page.evaluate(() => document.activeElement.classList.contains("dockall")));
    await press(".dockall"); await sleep(180); await pointerFocus();
    await page.keyboard.press("Escape");
    assert.ok(await page.evaluate(() => document.activeElement.classList.contains("dockall")));
    report.controls.push({ label, passed: true });
    assert.deepEqual(errors, []); await context.close();
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

  // The operator's second recording: long dock labels must not change dock
  // height, and a chart must retain its first visible geometry throughout arrival.
  for (const [width, height] of quick ? [[390, 660], [1728, 960]] : [[1280, 820], [430, 745], [390, 660], [1728, 960]]) {
    const { page, context, errors } = await open({ width, height });
    for (const id of ["windshield", "measurement", "samehazard", "measurement", "samehazard", "reference", "samehazard", "reference"]) {
      await page.evaluate((id) => {
        const rail = document.querySelector(".dock"), card = rail.querySelector(`[data-station="${id}"]`);
        rail.scrollLeft += card.getBoundingClientRect().left - rail.getBoundingClientRect().left;
      }, id);
      await startSampling(page);
      await page.evaluate((id) => {
        const run = window.chartArrival = { running: true, frames: [] };
        function sample() {
          if (!run.running) return;
          const panel = document.querySelector('.panelcontent[data-preparing="false"]');
          if (panel?.dataset.station === id) run.frames.push([...panel.querySelectorAll(".mchart, .wscene")].filter((c) => c.getBoundingClientRect().width && c.getBoundingClientRect().height).map((c) => {
            const r = c.getBoundingClientRect();
            return { x: r.x, y: r.y, width: c.getAttribute("width"), height: c.getAttribute("height"), opacity: Number(getComputedStyle(c).opacity) };
          }));
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }, id);
      await page.click(`.navcard[data-station="${id}"]`);
      await arrived(page, id);
      await sleep(500);
      const frames = await page.evaluate(() => { window.chartArrival.running = false; return window.chartArrival.frames; });
      assert.ok(frames.length > 10 && frames[0].length > 0, `${id}: no chart frames`);
      assert.ok(frames.every((f) => JSON.stringify(f) === JSON.stringify(frames[0])), `${width} ${id}: chart shifted or faded after arrival`);
      assert.ok(frames[0].every((c) => c.opacity === 1), `${id}: chart initially transparent`);
      report.controls.push({ label: `${width}x${height}-${id}-dock-chart-stability`, ...await stopSampling(page, id), chartFrames: frames.length });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }

  // A deferred first canvas drawing also holds the menu, even with warm data.
  {
    const { page, context, errors } = await open();
    await page.evaluate(() => {
      const ready = new Promise((resolve) => { window.releaseDrawing = resolve; });
      Object.defineProperty(document.fonts, "ready", { configurable: true, get: () => ready });
    });
    await startSampling(page);
    await select(page, "samehazard");
    await sleep(250);
    assert.ok(await page.$(".fieldindex"));
    assert.ok(await page.$('.fixrow[data-station="samehazard"][data-pending="true"]'), "slow first load should offer feedback");
    assert.equal(await page.$eval('.panelcontent[data-preparing="false"]', (e) => e.dataset.station), "harbor");
    await page.evaluate(() => window.releaseDrawing());
    await arrived(page, "samehazard");
    report.controls.push({ label: "canvas-first-drawing-readiness", ...await stopSampling(page, "canvas-ready") });
    await select(page, "harbor"); await arrived(page, "harbor");
    await page.evaluate(() => {
      const ready = new Promise((resolve) => { window.releaseDrawing = resolve; });
      Object.defineProperty(document.fonts, "ready", { configurable: true, get: () => ready });
    });
    await startSampling(page);
    await select(page, "samehazard");
    await sleep(320);
    assert.equal(await page.$('.navcard[data-pending="true"], .fixrow[data-pending="true"]'), null, "return visit must never show a loading circle");
    assert.match(await page.$eval(".fixfootstatus", (e) => e.textContent), /18 stations/);
    await page.evaluate(() => window.releaseDrawing());
    await arrived(page, "samehazard");
    report.controls.push({ label: "revisits-without-loading-indicators", ...await stopSampling(page, "quiet-revisit") });
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const { page, context, errors } = await open();
    await page.evaluate(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args) { return this.classList.contains("wscene") ? null : get.apply(this, args); };
    });
    await select(page, "samehazard");
    await arrived(page, "samehazard");
    assert.match(await page.$eval('.panelcontent[data-preparing="false"]', (e) => e.innerText), /Chart unavailable/);
    await select(page, "harbor"); await arrived(page, "harbor");
    report.controls.push({ label: "canvas-unavailable-keeps-navigation-usable", passed: true });
    assert.deepEqual(errors, []); await context.close();
  }
  // A missing transfer must stay explicit, retain its reason, and recover
  // through a fresh verification after the operator chooses Try again.
  {
    let fail = true;
    const { page, context, errors } = await open({ intercept: async (url) => {
      if (fail && url.includes("evidence__measurement__result_ao.json")) return "abort";
    } });
    await select(page, "reference"); await arrived(page, "reference");
    assert.ok(await page.$('.panelcontent[data-preparing="false"] .blocked'));
    assert.equal(await page.$('.panelcontent[data-preparing="false"] .refgrid'), null);
    const shape = await geometry(page);
    assert.ok(shape.overflow.every((n) => n <= 2));
    assert.ok(await page.$eval(".blocked-retry", (e) => e.getBoundingClientRect().height >= 44));
    await page.screenshot({ path: path.join(out, "reference-interrupted.png") });
    await page.click(".blocked-details summary");
    assert.match(await page.$eval(".blocked-details code", (e) => e.textContent), /fetch|network|abort/i);
    fail = false;
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click(".blocked-retry")]);
    await until(page, () => !document.querySelector(".boot") && !!document.querySelector('.refgrid .wscene[data-ready="true"]'));
    assert.equal(await page.$('.panelcontent[data-preparing="false"] .blocked'), null);
    report.controls.push({ label: "reference-transfer-failure-and-verified-retry", passed: true });
    assert.deepEqual(errors, []); await context.close();
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
