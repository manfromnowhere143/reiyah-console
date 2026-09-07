/* Opening and first-page handoff, tested against the built, existing snapshot.
   Delayed and corrupted responses are browser-local fixtures, never server edits. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
const base = process.env.NAV_BASE ?? "http://127.0.0.1:4620";
const out = process.env.BOOT_OUT ?? "/tmp/reiyah-opening-tests";
const report = { cases: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const latch = () => { let release; const promise = new Promise((r) => { release = r; }); return { promise, release }; };
await fs.mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
async function until(page, fn, arg, timeout = 20000) { await page.waitForFunction(fn, { timeout, polling: "raf" }, arg); }
async function open({ width = 390, height = 660, ground = "dark", reduced = false, station = "", intercept } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [], external = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin) external.push(r.url()); });
  await page.setViewport({ width, height });
  await page.setBypassServiceWorker(true);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
  await page.evaluateOnNewDocument((ground) => {
    localStorage.setItem("harbor-ground", ground);
    window.openingFrames = [];
    const sample = (t) => {
      const opening = document.querySelector("#boot, .boot"), stage = document.querySelector(".stage");
      if (opening || stage) {
        const phase = document.querySelector('.opening [role="progressbar"]')?.getAttribute("aria-valuenow");
        const opacity = opening ? Number(getComputedStyle(opening).opacity) : 0;
        const field = stage?.querySelector(".fieldwrap");
        window.openingFrames.push({ t, opening: !!opening, stage: !!stage, phase: phase === undefined ? null : Number(phase), opacity,
          stageInert: stage?.inert, stageOpacity: stage ? Number(getComputedStyle(stage).opacity) : 0,
          workerPending: field?.dataset.live === "false", text: !!stage?.innerText.trim() });
      }
      if (window.openingFrames.length < 2400) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, ground);
  if (intercept) {
    await page.setRequestInterception(true);
    page.on("request", async (r) => {
      try { const action = await intercept(r.url());
        if (action === "abort") await r.abort();
        else if (action) await r.respond(action);
        else await r.continue();
      } catch (e) { if (!page.isClosed()) errors.push(String(e)); }
    });
  }
  const navigation = page.goto(`${base}${station ? `/?st=${station}` : "/"}`, { waitUntil: "load" });
  navigation.catch(() => {});
  return { page, context, errors, external, navigation };
}
async function opened(c, label) {
  await c.navigation;
  await until(c.page, () => !!document.querySelector(".stage") && !document.querySelector(".boot, #boot"));
  await sleep(80);
  const frames = await c.page.evaluate(() => window.openingFrames);
  assert.ok(frames.some((f) => f.opening), `${label}: opening never painted`);
  const bad = frames.filter((f) => f.stage && (
    (f.opening && !f.stageInert) || (!f.opening && f.stageInert) ||
    (f.opacity < 0.999 && (f.workerPending || !f.text || f.stageOpacity !== 1))));
  assert.deepEqual(bad, [], `${label}: first page exposed before readiness`);
  assert.deepEqual(c.errors, [], `${label}: browser errors`);
  assert.deepEqual(c.external, [], `${label}: external startup dependencies`);
  const leaving = frames.filter((f) => f.opening && f.phase === 4);
  if (leaving.length) assert.ok(leaving.at(-1).t - leaving[0].t < 550, `${label}: artificial completed hold`);
  report.cases.push({ label, frames: frames.length, departureMs: leaving.length ? Math.round(leaving.at(-1).t - leaving[0].t) : 0, passed: true });
}
async function geometry(page, selector) {
  return page.evaluate((selector) => {
    const shell = document.querySelector(selector);
    const rect = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100); };
    return Object.fromEntries([".opening-field", ".opening-optic", ".opening-word"].map((s) => [s, rect(shell.querySelector(s))]));
  }, selector);
}
try {
  for (const [width, height] of [[1280, 820], [430, 745], [390, 660]]) for (const ground of ["dark", "light"]) {
    const code = latch(), evidence = latch();
    const c = await open({ width, height, ground, intercept: async (url) => {
      if (/\/assets\/index-[^/]+\.js/.test(url)) await code.promise;
      if (/\/snapshot\/manifest\.json/.test(url)) await evidence.promise;
    } });
    const label = `${width}x${height}-${ground}`;
    await until(c.page, () => !!document.querySelector("#boot"));
    await c.page.evaluate(() => document.fonts.load('500 1rem "Instrument Sans"'));
    const before = await geometry(c.page, "#boot");
    await c.page.screenshot({ path: path.join(out, `${label}-inline.png`) });
    code.release();
    await until(c.page, () => !!document.querySelector(".boot") && !document.querySelector("#boot"));
    const after = await geometry(c.page, ".boot");
    assert.deepEqual(after, before, `${label}: inline-to-React geometry shifted`);
    const visibleText = await c.page.$eval(".boot", (shell) => {
      const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT), text = [];
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        let el = node.parentElement, visible = true;
        while (el && el !== shell) {
          const css = getComputedStyle(el);
          if (css.display === "none" || css.visibility === "hidden" || css.clipPath !== "none") visible = false;
          el = el.parentElement;
        }
        if (visible) text.push(node.textContent.trim());
      }
      return text.join(" ");
    });
    assert.equal(visibleText, "REIYAH", `${label}: opening has extra visible text`);
    assert.equal(await c.page.$(".stage"), null, `${label}: unverified stage mounted`);
    await c.page.screenshot({ path: path.join(out, `${label}-opening.png`) });
    evidence.release();
    await opened(c, label);
    await c.page.click(".dockall");
    await sleep(230);
    const index = await c.page.evaluate(() => {
      const el = document.querySelector(".fieldindex"), r = el.getBoundingClientRect();
      return { overflow: el.scrollHeight - el.clientHeight, rows: [...el.querySelectorAll(".fixrow")].map((e) => {
        const c = e.getBoundingClientRect(); return { h: c.height, inBounds: c.top >= r.top && c.bottom <= r.bottom && c.left >= r.left && c.right <= r.right };
      }), centered: Math.abs(r.left + r.width / 2 - innerWidth / 2) < 1, inBounds: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
    });
    assert.equal(index.rows.length, 18); assert.ok(index.rows.every((r) => r.h >= 44 && r.inBounds));
    assert.ok(index.centered && index.inBounds && index.overflow <= 1, `${label}: index does not fit`);
    await c.page.screenshot({ path: path.join(out, `${label}-index.png`) });
    for (let i = 0; i < 23; i++) { await c.page.keyboard.press("Tab"); assert.ok(await c.page.evaluate(() => !!document.activeElement.closest(".fieldindex"))); }
    await c.page.keyboard.press("Escape");
    assert.ok(await c.page.evaluate(() => document.activeElement.classList.contains("dockall")));
    await c.context.close();
    console.log(`${label}: continuous opening, all 18 index targets fit`);
  }
  // A proved identity is insufficient to reveal an unpainted worker canvas.
  {
    const worker = latch();
    const c = await open({ intercept: async (url) => { if (/harbor\.worker-[^/]+\.js/.test(url)) await worker.promise; } });
    await until(c.page, () => !!document.querySelector('.fieldwrap[data-live="false"]'));
    await sleep(250);
    assert.ok(await c.page.$('.boot[data-leaving="false"]'));
    assert.equal(await c.page.$eval('[role="progressbar"]', (e) => e.getAttribute("aria-valuenow")), "3");
    await c.page.click(".boot .groundtoggle");
    await until(c.page, () => document.documentElement.dataset.ground === "light");
    worker.release(); await opened(c, "wait-for-first-worker-drawing");
    assert.equal(await c.page.$eval(".stage .groundtoggle", (e) => e.getAttribute("aria-pressed")), "false");
    await c.page.click(".stage .groundtoggle");
    await until(c.page, () => document.documentElement.dataset.ground === "dark");
    await c.context.close();
  }
  // Tampering must block. Retry must re-run verification, never bypass it.
  {
    let corrupt = true;
    const c = await open({ intercept: async (url) => {
      if (corrupt && /\/snapshot\/raw\/index-sidecar(?:\?|$)/.test(url)) return { status: 200, contentType: "text/plain", body: `${"0".repeat(64)}  GATE_A_EVIDENCE_INDEX.json` };
    } });
    await until(c.page, () => !!document.querySelector(".opening-blocked"));
    assert.equal(await c.page.$(".stage"), null);
    assert.match(await c.page.$eval(".opening-blocked", (e) => e.textContent), /index_digest_mismatch/);
    await c.page.screenshot({ path: path.join(out, "blocked.png") });
    corrupt = false; await c.page.click(".opening-blocked button"); await opened(c, "digest-block-and-verified-retry"); await c.context.close();
  }
  // Browser history may select another page while Harbor is still preparing.
  {
    const catalog = latch();
    const c = await open({ intercept: async (url) => { if (/\/snapshot\/catalog\.json/.test(url)) await catalog.promise; } });
    await until(c.page, () => !!document.querySelector(".stage") && !!document.querySelector(".boot"));
    await c.page.evaluate(() => { history.pushState({}, "", "/?st=samehazard"); dispatchEvent(new PopStateEvent("popstate")); });
    await until(c.page, () => document.querySelector('.panelcontent[data-preparing="false"]')?.dataset.station === "samehazard");
    catalog.release();
    await opened(c, "history-during-opening"); await c.context.close();
  }
  {
    let fail = true;
    const c = await open({ intercept: async (url) => { if (fail && /\/snapshot\/raw\/index(?:\?|$)/.test(url)) { fail = false; return "abort"; } } });
    await opened(c, "interrupted-transfer-recovers"); await c.context.close();
  }
  for (const reduced of [true, false]) {
    const c = await open({ reduced, station: "samehazard", intercept: async (url) => { if (!reduced && url.includes("/fonts/")) return "abort"; } });
    await opened(c, reduced ? "reduced-motion-deep-link" : "font-failure-deep-link");
    assert.equal(await c.page.$eval('.panelcontent[data-preparing="false"]', (e) => e.dataset.station), "samehazard");
    await c.context.close();
  }
  report.status = "pass";
  console.log(`${report.cases.length} opening and index checks passed`);
} catch (e) { report.status = "fail"; report.error = String(e.stack ?? e); throw e; }
finally { await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
