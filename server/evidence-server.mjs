/* Reiyah Evidence Server — read-only, fail-closed.
 *
 * Watches the Reiyah repository and serves digest-verified projections of
 * committed machine records over HTTP + SSE. It can only serve bytes that
 * exist on disk; every response carries the exact source path and the
 * SHA-256 recomputed at read time. On any error it emits an explicit
 * blocked state. It never writes to the repository, never fabricates a
 * value, and holds no authority over Reiyah.
 */
import http from "node:http";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.REIYAH_ROOT ?? "/Users/danielwahnich/workspace/reiyah";
const PORT = Number(process.env.PORT ?? 4600);
const DIST = new URL("../dist", import.meta.url).pathname;

/* ---- surface whitelist: id -> repo-relative path ------------------------ */
const SURFACES = new Map(
  Object.entries({
    index: "gate/GATE_A_EVIDENCE_INDEX.json",
    "index-sidecar": "gate/GATE_A_EVIDENCE_INDEX.sha256",
    protocol: "manifests/protocol/harbor-gate-a-protocol-1.2.0.json",
    mission: "manifests/mission/reiyah-mission-1.1.0.json",
    fixtures: "fixtures/fixture-catalog.json",
    frontier: "evidence/frontier-discovery-register-1.2.0.json",
    "decision-template": "gate/decisions/OPERATOR_DECISION-1.2.5.template.json",
    odi: "gate/operator-decision-interfaces/reiyah.operator-decision-interface-1.2.4.json",
    "chain-observation": "manifests/examples/object-chain/observation.json",
    "chain-belief": "manifests/examples/object-chain/latent-belief.json",
    "chain-decision": "manifests/examples/object-chain/decision.json",
    "chain-intervention": "manifests/examples/object-chain/intervention.json",
    "chain-outcome": "manifests/examples/object-chain/outcome.json",
    "chain-evidence": "manifests/examples/object-chain/evidence.json",
  })
);
/* validation reports and recovery records are enumerated, not hardcoded */
for (const f of safeList("gate/validation-reports")) {
  if (f.endsWith(".json")) SURFACES.set(`report-${f.replace(/^gate-a-validation-|\.json$/g, "")}`, `gate/validation-reports/${f}`);
}
for (const d of safeList("history")) {
  const p = `history/${d}/RECOVERY.json`;
  if (fs.existsSync(path.join(REPO, p))) SURFACES.set(`recovery-${d.replace(/^gate-a-/, "")}`, p);
}

function safeList(rel) {
  try {
    return fs.readdirSync(path.join(REPO, rel));
  } catch {
    return [];
  }
}

/* ---- dynamic surface discovery: the UI can never go stale ---------------
   Walks the evidence trees and serves every committed .json as a
   path-addressed surface. New artifact families appear automatically. */
const CATALOG_ROOTS = ["gate", "validation", "manifests", "evidence"];
function walkCatalog() {
  const rows = [];
  const walk = (rel) => {
    const abs = path.join(REPO, rel);
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = path.posix.join(rel, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { walk(r); continue; }
      if (!e.name.endsWith(".json") && !e.name.endsWith(".sha256")) continue;
      try {
        const st = fs.statSync(path.join(REPO, r));
        rows.push({ path: r, bytes: st.size, mtimeMs: st.mtimeMs });
      } catch { /* transient */ }
    }
  };
  for (const root of CATALOG_ROOTS) walk(root);
  rows.sort((a, b) => a.path.localeCompare(b.path));
  return rows;
}
function pathSurfaceAllowed(rel) {
  if (rel.includes("..") || rel.startsWith("/")) return false;
  if (!CATALOG_ROOTS.some((r) => rel.startsWith(r + "/"))) return false;
  if (!rel.endsWith(".json") && !rel.endsWith(".sha256")) return false;
  const abs = path.join(REPO, rel);
  try { return fs.lstatSync(abs).isFile(); } catch { return false; }
}

/* ---- read + digest with mtime cache ------------------------------------ */
const cache = new Map(); // path -> { mtimeMs, size, sha256, bytes }
function readSurface(rel) {
  const abs = path.join(REPO, rel);
  if (!abs.startsWith(REPO + path.sep)) throw new Error("path_escape_rejected");
  const st = fs.statSync(abs);
  const hit = cache.get(rel);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit;
  const bytes = fs.readFileSync(abs);
  const sha256 = "sha256:" + createHash("sha256").update(bytes).digest("hex");
  const entry = { mtimeMs: st.mtimeMs, size: st.size, sha256, bytes };
  cache.set(rel, entry);
  return entry;
}

function gitIdentity() {
  const opt = { cwd: REPO, encoding: "utf8" };
  try {
    return {
      state: "observed",
      head: execFileSync("git", ["rev-parse", "HEAD"], opt).trim(),
      branch: execFileSync("git", ["branch", "--show-current"], opt).trim(),
      worktree_clean: execFileSync("git", ["status", "--porcelain=v1"], opt).trim() === "",
      root: REPO,
    };
  } catch (e) {
    return { state: "blocked", reason: String(e?.message ?? e) };
  }
}

/* ---- SSE ---------------------------------------------------------------- */
const clients = new Set();
let eventSeq = 0;
function broadcast(kind, payload) {
  const msg = `id: ${++eventSeq}\nevent: ${kind}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(msg);
}
let debounce = null;
function onRepoChange() {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    cache.clear();
    broadcast("evidence", { changedAt: new Date().toISOString(), identity: gitIdentity() });
  }, 400);
}
for (const dir of ["gate", "manifests", "evidence", "fixtures", "history"]) {
  const abs = path.join(REPO, dir);
  if (fs.existsSync(abs)) {
    try {
      fs.watch(abs, { recursive: true }, onRepoChange);
    } catch {
      /* recursive watch unavailable: heartbeat still carries identity */
    }
  }
}
setInterval(() => broadcast("heartbeat", { at: new Date().toISOString() }), 25_000);

/* ---- static dist serving (production) ----------------------------------- */
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".woff2": "font/woff2",
};
function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (rel === "/") rel = "/index.html";
  const abs = path.join(DIST, rel);
  if (!abs.startsWith(DIST) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    // SPA fallback
    const idx = path.join(DIST, "index.html");
    if (fs.existsSync(idx)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fs.readFileSync(idx));
      return;
    }
    res.writeHead(404); res.end("not found"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(abs)] ?? "application/octet-stream" });
  res.end(fs.readFileSync(abs));
}

/* ---- HTTP --------------------------------------------------------------- */
function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  try {
    if (p === "/api/summary") {
      const surfaces = [];
      for (const [id, rel] of SURFACES) {
        try {
          const e = readSurface(rel);
          surfaces.push({ id, path: rel, bytes: e.size, sha256: e.sha256, state: "observed" });
        } catch (err) {
          surfaces.push({ id, path: rel, state: "blocked", reason: String(err?.message ?? err) });
        }
      }
      return json(res, 200, {
        instrument: "reiyah-console",
        authority_nonclaims: {
          holds_authority_over_reiyah: false,
          creates_operator_acceptance: false,
          creates_scientific_evidence: false,
          is_driver_monitoring_system: false,
        },
        generatedAt: new Date().toISOString(),
        identity: gitIdentity(),
        surfaces,
      });
    }
    if (p === "/api/schemas") {
      const rows = [];
      try {
        for (const f of fs.readdirSync(path.join(REPO, "schemas")).sort()) {
          if (!f.endsWith(".json")) continue;
          const rel = `schemas/${f}`;
          const bytes = fs.readFileSync(path.join(REPO, rel));
          let j = {};
          try { j = JSON.parse(bytes.toString("utf8")); } catch { /* recorded as unparsed */ }
          const m = f.match(/^(.*?)-(\d+\.\d+\.\d+)\.schema\.json$/);
          rows.push({
            path: rel, bytes: bytes.length,
            sha256: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
            id: j.$id ?? null, dialect: j.$schema ?? null, title: j.title ?? null,
            family: m ? m[1] : f.replace(/\.schema\.json$/, ""), version: m ? m[2] : null,
            additional_properties_closed: j.additionalProperties === false,
            required_count: Array.isArray(j.required) ? j.required.length : null,
            property_count: j.properties && typeof j.properties === "object" ? Object.keys(j.properties).length : null,
          });
        }
      } catch { /* no schemas directory */ }
      return json(res, 200, { state: "observed", kind: "schema_index", generatedAt: new Date().toISOString(), identity: gitIdentity(), rows });
    }
    if (p === "/api/catalog") {
      return json(res, 200, {
        state: "observed",
        generatedAt: new Date().toISOString(),
        identity: gitIdentity(),
        roots: CATALOG_ROOTS,
        entries: walkCatalog(),
      });
    }
    if (p.startsWith("/api/raw/")) {
      const id = decodeURIComponent(p.slice("/api/raw/".length));
      let rel = SURFACES.get(id);
      if (!rel && id.startsWith("p/")) {
        const cand = id.slice(2);
        if (pathSurfaceAllowed(cand)) rel = cand;
      }
      if (!rel) return json(res, 404, { state: "blocked", reason: "unknown_surface" });
      const e = readSurface(rel);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Source-Path": rel,
        "X-Source-Sha256": e.sha256,
        "X-Source-Bytes": String(e.size),
      });
      return res.end(e.bytes);
    }
    if (p.startsWith("/api/surface/")) {
      const id = decodeURIComponent(p.slice("/api/surface/".length));
      let rel = SURFACES.get(id);
      if (!rel && id.startsWith("p/")) {
        const cand = id.slice(2);
        if (pathSurfaceAllowed(cand)) rel = cand;
      }
      if (!rel) return json(res, 404, { state: "blocked", reason: "unknown_surface" });
      const e = readSurface(rel);
      let data;
      if (rel.endsWith(".json")) {
        data = JSON.parse(e.bytes.toString("utf8"));
      } else {
        data = e.bytes.toString("utf8");
      }
      return json(res, 200, {
        state: "observed",
        meta: { id, path: rel, sha256: e.sha256, bytes: e.size, readAt: new Date().toISOString() },
        data,
      });
    }
    if (p === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      res.write(`retry: 3000\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (p.startsWith("/api/")) return json(res, 404, { state: "blocked", reason: "unknown_endpoint" });
    return serveStatic(req, res);
  } catch (err) {
    return json(res, 500, { state: "blocked", reason: String(err?.message ?? err) });
  }
});

server.listen(PORT, () => {
  console.log(`[evidence-server] reading ${REPO}`);
  console.log(`[evidence-server] listening on http://localhost:${PORT} · surfaces: ${SURFACES.size}`);
});
