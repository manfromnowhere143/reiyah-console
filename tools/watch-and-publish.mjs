#!/usr/bin/env node
/* Reiyah live-publish pipeline — automated, content-addressed, honest.
 *
 * Watches the Reiyah engine repository for new COMMITTED states and, after a
 * quiet debounce, re-seals a fresh digest-verified snapshot and redeploys to
 * production. Viewers auto-reload to the new build (service-worker
 * controllerchange). Publishes committed states only — never a dirty tree —
 * so every public snapshot is a stable, reproducible, sealed point in time.
 *
 * Run:  npm run live      (foreground, Ctrl-C to stop)
 * Or install the launchd plist in tools/ for always-on.
 *
 * Env:
 *   REIYAH_ROOT     path to the engine repo (default ~/workspace/reiyah)
 *   POLL_SECONDS    HEAD poll interval (default 20)
 *   QUIET_SECONDS   quiet period after a change before publishing (default 90)
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.REIYAH_ROOT ?? `${process.env.HOME}/workspace/reiyah`;
const CONSOLE_DIR = new URL("..", import.meta.url).pathname;
const POLL = (Number(process.env.POLL_SECONDS) || 20) * 1000;
const QUIET = (Number(process.env.QUIET_SECONDS) || 90) * 1000;
const STATE = path.join(CONSOLE_DIR, ".live-state.json");

const log = (m) => console.log(`[live ${new Date().toISOString()}] ${m}`);
const git = (args) => execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8" }).trim();

function head() { try { return git(["rev-parse", "HEAD"]); } catch { return null; } }
function clean() { try { return git(["status", "--porcelain=v1"]) === ""; } catch { return false; } }
/* the console itself must be committed too: a publish must never carry a
   half-edited instrument to production */
function consoleClean() {
  /* the publisher's own outputs (the resealed snapshot, its state file) are
     not edits; everything else must be committed */
  try { return execFileSync("git", ["-C", CONSOLE_DIR, "status", "--porcelain=v1", "--", ".", ":!public/snapshot", ":!.live-state.json"], { encoding: "utf8" }).trim() === ""; } catch { return false; }
}
function lastPublished() { try { return JSON.parse(fs.readFileSync(STATE, "utf8")).commit; } catch { return null; } }
function record(commit) { fs.writeFileSync(STATE, JSON.stringify({ commit, publishedAt: new Date().toISOString() }, null, 1)); }

let changedAt = 0;
let pendingCommit = null;
let publishing = false;

function publish(commit) {
  if (publishing) return;
  if (!consoleClean()) { log("console worktree dirty; holding the publish"); return; }
  publishing = true;
  log(`publishing ${commit.slice(0, 12)} …`);
  try {
    execSync("node tools/seal-snapshot.mjs", { cwd: CONSOLE_DIR, stdio: "inherit", env: { ...process.env, REIYAH_ROOT: REPO } });
    execSync("npm run build", { cwd: CONSOLE_DIR, stdio: "inherit" });
    execSync("vercel deploy --prod --yes", { cwd: CONSOLE_DIR, stdio: "inherit" });
    record(commit);
    log(`published ${commit.slice(0, 12)} → production. viewers auto-reload.`);
  } catch (e) {
    log(`publish FAILED: ${String(e?.message ?? e)} — will retry on next change`);
  } finally {
    publishing = false;
  }
}

function tick() {
  const h = head();
  if (!h) { log("engine repo unreadable; waiting"); return; }
  // only consider committed, clean states
  if (!clean()) { return; }
  if (h !== lastPublished() && h !== pendingCommit) {
    pendingCommit = h;
    changedAt = Date.now();
    log(`new committed state ${h.slice(0, 12)}; publishing after ${QUIET / 1000}s quiet`);
  }
  if (pendingCommit && Date.now() - changedAt >= QUIET && !publishing) {
    // confirm it is still the current, clean HEAD before publishing
    if (head() === pendingCommit && clean()) {
      const c = pendingCommit;
      pendingCommit = null;
      publish(c);
    } else {
      // moved again; reset the quiet window
      pendingCommit = null;
    }
  }
}

log(`watching ${REPO} · poll ${POLL / 1000}s · quiet ${QUIET / 1000}s · last published ${lastPublished()?.slice(0, 12) ?? "none"}`);
setInterval(tick, POLL);
tick();
