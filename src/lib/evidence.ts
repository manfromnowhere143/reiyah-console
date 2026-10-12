/* Evidence client with two honest sources and no third option:
   - LIVE: the evidence server (/api), digests recomputed at read time, SSE.
   - SEALED: a static snapshot bundle (/snapshot) written by seal-snapshot.mjs,
     with the seal time and commit identity on its face.
   The client tries live first, falls back to sealed, and otherwise blocks.
   In both modes WebCrypto re-verification works on the exact bytes; the mode
   is always displayed, never blended. */

/* every sealed byte is fetched under the build that shipped with it: the
   bundle is immutable and hashed, the snapshot is cached for minutes in the
   browser and an hour at the edge, so without this a new station could meet
   an old manifest and block on bytes that exist. The query pins the pair. */
export const snap = (path: string) => {
  const seal = sealedManifest?.sealedAt ? "-" + Date.parse(sealedManifest.sealedAt).toString(36) : "";
  return `${path}${path.includes("?") ? "&" : "?"}b=${__BUILD_ID__}${seal}`;
};

export type SurfaceState<T = unknown> =
  | { state: "loading" }
  | { state: "observed"; meta: SurfaceMeta; data: T }
  | { state: "blocked"; reason: string };

export interface SurfaceMeta {
  id: string;
  path: string;
  sha256: string;
  bytes: number;
  readAt: string;
}

export interface SurfaceRow {
  id: string;
  path: string;
  bytes?: number;
  sha256?: string;
  state: "observed" | "blocked";
  reason?: string;
}

export interface Summary {
  instrument: string;
  generatedAt: string;
  identity:
    | { state: "observed"; head: string; branch: string; worktree_clean: boolean; root: string }
    | { state: "blocked"; reason: string };
  surfaces: SurfaceRow[];
}

export type SourceMode = "live" | "sealed";
export interface SealedInfo { sealedAt: string; head: string; branch: string }

let mode: SourceMode = "live";
let sourceGeneration = 0;
/* a retry after a transport failure bypasses every cache in the path (HTTP
   cache and the service worker's stored copies), so a partial or stale body
   can never be re-served as if it were the network's answer */
let bypass = false;
export function setBypassCache(on: boolean) { bypass = on; }
export function isBypassCache() { return bypass; }
export function getEvidenceGeneration() { return `${sourceGeneration}|${mode}|${sealedManifest?.sealedAt ?? ""}|${lastSurfaces.map(s=>s.sha256).join("|")}|${bypass}`; }
const opts = (): RequestInit | undefined => (bypass ? { cache: "reload" } : undefined);
let sealedManifest: {
  sealedAt: string;
  identity: Summary["identity"];
  surfaces: SurfaceRow[];
  bindings?: Record<string, string>;
} | null = null;

export function getMode(): SourceMode { return mode; }
export function getSealedInfo(): SealedInfo | null {
  if (!sealedManifest || sealedManifest.identity.state !== "observed") return null;
  return {
    sealedAt: sealedManifest.sealedAt,
    head: sealedManifest.identity.head,
    branch: sealedManifest.identity.branch,
  };
}

async function loadSealed(): Promise<boolean> {
  try {
    const r = await fetch(snap("/snapshot/manifest.json"), opts());
    if (!r.ok) return false;
    const bytes = await r.arrayBuffer();
    if (await sha256Hex(bytes) !== __SNAPSHOT_SHA__) throw new Error("snapshot_manifest_mismatch");
    const m = JSON.parse(new TextDecoder().decode(bytes));
    if (m?.kind !== "sealed_snapshot") return false;
    sealedManifest = m;
    catalogCache=null;schemaMemo=null;rawMemo.clear();pathMemo.clear();
    sourceGeneration++;
    mode = "sealed";
    return true;
  } catch {
    return false;
  }
}

/* ---- dynamic catalog: every committed evidence file, path-addressed ---- */
export interface CatalogEntry { path: string; bytes: number; sha256?: string }
let catalogCache: CatalogEntry[] | null = null;

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  if (mode === "sealed" && catalogCache && !bypass) return catalogCache;
  try {
    if (mode === "sealed") {
      catalogCache = (await fetchSnapshotJson<{ entries: CatalogEntry[] }>("catalog.json")).entries; return catalogCache!;
    }
    const r = await fetch("/api/catalog");
    if (!r.ok) return [];
    catalogCache = (await r.json()).entries ?? [];
    return catalogCache!;
  } catch { return []; }
}

/** Fetch any cataloged evidence file by repo-relative path. */
export async function fetchSurfaceByPath<T = unknown>(rel: string): Promise<SurfaceState<T>> {
  if (mode === "sealed") {
    if (!bypass && pathMemo.has(rel)) return pathMemo.get(rel)! as Promise<SurfaceState<T>>;
    const job = fetchSurfaceByPathUncached<T>(rel);
    pathMemo.set(rel, job as Promise<SurfaceState<unknown>>);
    job.then((r) => { if (r.state !== "observed") pathMemo.delete(rel); }, () => pathMemo.delete(rel));
    return job;
  }
  return fetchSurfaceByPathUncached<T>(rel);
}

/** After boot, in idle time, warm only the catalog: the one list the Harbor
    and the palette read. Every other byte is fetched by the station that
    parses it, or by the neighbour prefetch (src/lib/prefetch.ts). */
export function warmSealedSurfaces() {
  if (mode !== "sealed" || !sealedManifest) return;
  const idle = (cb: () => void) => ((window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 800));
  idle(() => { fetchCatalog().catch(() => { /* the stations report it */ }); });
}

async function fetchSurfaceByPathUncached<T = unknown>(rel: string): Promise<SurfaceState<T>> {
  return fetchSurface<T>(`p/${rel}`);

}

let lastSurfaces: SurfaceRow[] = [];
export function getSurfaces(): SurfaceRow[] { return lastSurfaces; }

export async function fetchSummary(): Promise<Summary> {
  try {
    const r = await fetch("/api/summary", opts());
    if (r.ok) {
      mode = "live";sourceGeneration++;
      const s: Summary = await r.json();
      if (JSON.stringify(s.surfaces) !== JSON.stringify(lastSurfaces)) { rawMemo.clear(); pathMemo.clear(); catalogCache = null; schemaMemo = null; }
      lastSurfaces = s.surfaces ?? [];
      return s;
    }
  } catch { /* fall through to sealed */ }
  if (await loadSealed()) {
    lastSurfaces = sealedManifest!.surfaces;
    return {
      instrument: "reiyah-console (sealed snapshot)",
      generatedAt: sealedManifest!.sealedAt,
      identity: sealedManifest!.identity,
      surfaces: sealedManifest!.surfaces,
    };
  }
  throw new Error("no_evidence_source: live api unreachable and no sealed snapshot present");
}

/* ---- the contract layer: every schema, digest-bound, bodies not shipped ---- */
export interface SchemaRow {
  path: string; bytes: number; sha256: string; id: string | null; dialect: string | null; title: string | null;
  family: string; version: string | null; additional_properties_closed: boolean; required_count: number | null; property_count: number | null;
}
let schemaMemo: Promise<SchemaRow[]> | null = null;
export function fetchSchemaIndex(): Promise<SchemaRow[]> {
  if (mode === "sealed" && schemaMemo && !bypass) return schemaMemo;
  schemaMemo = (async () => {
    if (mode === "sealed") return (await fetchSnapshotJson<{ rows: SchemaRow[] }>("schemas-index.json")).rows;
    const r = await fetch("/api/schemas", opts());
    if (!r.ok) throw new Error(`schema_index_http_${r.status}`);
    const j = await r.json();
    return (j.rows ?? []) as SchemaRow[];
  })();
  schemaMemo.catch(() => { schemaMemo = null; });
  return schemaMemo;
}

/* Merkle inclusion over the sealed surface set — built once, cached. */
let merkleCache: { key: string; tree: import("./merkle").MerkleTree } | null = null;
export async function getMerkle(): Promise<import("./merkle").MerkleTree | null> {
  const leaves = lastSurfaces
    .filter((s) => s.state === "observed" && s.sha256)
    .map((s) => ({ id: s.id, sha256: s.sha256! }));
  if (leaves.length === 0) return null;
  const key = leaves.map((l) => l.id + l.sha256).join("|");
  if (merkleCache && merkleCache.key === key) return merkleCache.tree;
  const { buildMerkle } = await import("./merkle");
  const tree = await buildMerkle(leaves);
  merkleCache = { key, tree };
  return tree;
}

export interface InclusionProof {
  rootHex: string;
  steps: number;
  leafCount: number;
  verified: boolean;
}

/** Prove a surface is included in the sealed whole — recomputed in-browser. */
export async function proveInclusion(id: string, leafSha256: string): Promise<InclusionProof | null> {
  const tree = await getMerkle();
  if (!tree) return null;
  const { inclusionPath, verifyInclusion } = await import("./merkle");
  const path = inclusionPath(tree, id);
  if (!path) return null;
  const verified = await verifyInclusion(leafSha256, path, tree.rootHex);
  return { rootHex: tree.rootHex, steps: path.length, leafCount: tree.leafCount, verified };
}

export interface RawResult {
  bytes: ArrayBuffer;
  path: string;
  serverSha256: string;
  byteLength: number;
}

/* sealed bytes are immutable within a snapshot: fetched once, kept. A retry
   with cache bypass ignores the memo and refills it. */
const rawMemo = new Map<string, Promise<RawResult>>();
const pathMemo = new Map<string, Promise<SurfaceState<unknown>>>();
export async function fetchRaw(id: string): Promise<RawResult> {
  if (id.startsWith("example/")) return (await import("./example")).exampleRaw(id.slice(8));
  if (id.startsWith("edition/")) return (await import("./edition")).editionRaw(id.slice(8));
  if (id.startsWith("gateb/")) {
    const { fetchLaneText } = await import("./gateb");
    const { text, file } = await fetchLaneText(id.slice(6).replaceAll("__", "/"));
    return { bytes: new TextEncoder().encode(text).buffer as ArrayBuffer, path: file.path, serverSha256: file.sha256!, byteLength: new TextEncoder().encode(text).length };
  }
  if (mode === "sealed") {
    const rel = id.startsWith("p/") ? decodeURIComponent(id.slice(2)) : null;
    const row = rel ? (await fetchCatalog()).find(s => s.path === rel) : sealedManifest?.surfaces.find((s) => s.id === id);
    if (!row) throw new Error("unknown_sealed_surface");
    if (!bypass && rawMemo.has(id)) return rawMemo.get(id)!;
    const job = (async () => {
      const r = await fetch(snap(rel ? `/snapshot/p/${rel.replaceAll("/", "__")}` : `/snapshot/raw/${id}`), opts());
      if (!r.ok) throw new Error(`sealed_raw_http_${r.status}`);
      const bytes = await r.arrayBuffer();
      if (bytes.byteLength !== row.bytes || await sha256Hex(bytes) !== row.sha256) throw new Error("surface_digest_mismatch");
      return { bytes, path: row.path, serverSha256: row.sha256!, byteLength: bytes.byteLength };
    })();
    rawMemo.set(id, job);
    job.catch(() => rawMemo.delete(id));
    return job;
  }
  const r = await fetch(`/api/raw/${id}`, opts());
  if (!r.ok) throw new Error(`raw_http_${r.status}`);
  const bytes = await r.arrayBuffer();
  return {
    bytes,
    path: r.headers.get("X-Source-Path") ?? "unknown",
    serverSha256: r.headers.get("X-Source-Sha256") ?? "unknown",
    byteLength: bytes.byteLength,
  };
}

export async function fetchSurface<T = unknown>(id: string): Promise<SurfaceState<T>> {
  try {
    const raw = await fetchRaw(id);
    const digest = await sha256Hex(raw.bytes);
    if (digest !== raw.serverSha256) throw new Error("surface_digest_mismatch");
    retainVerifiedRaw(id, raw);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(raw.bytes);
    const data = (raw.path.endsWith(".json") ? JSON.parse(text) : text) as T;
    return { state: "observed", meta: { id, path: raw.path, sha256: digest, bytes: raw.byteLength, readAt: mode === "sealed" ? sealedManifest!.sealedAt : new Date().toISOString() }, data };
  } catch (e) {
    return { state: "blocked", reason: String((e as Error)?.message ?? e) };
  }
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return (
    "sha256:" +
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface Proof {
  path: string;
  byteLength: number;
  serverSha256: string;
  clientSha256: string;
  equal: boolean;
  provedAt: string;
}

/** Press to prove: refetch the exact bytes and recompute their digest here. */
const displayedBytes = new Map<string, RawResult>();
export function retainVerifiedRaw(id: string, raw: RawResult) { displayedBytes.set(`${id}|${raw.serverSha256}`, raw); }
export async function fetchSnapshotJson<T>(rel: string): Promise<T> {
  const r = await fetch(snap(`/snapshot/${rel}`), opts());
  if (!r.ok) throw new Error(`snapshot_http_${r.status}`);
  const bytes = await r.arrayBuffer();
  if (await sha256Hex(bytes) !== sealedManifest?.bindings?.[rel]) throw new Error(`snapshot_binding_mismatch:${rel}`);
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function prove(id: string, expectedSha256: string): Promise<Proof> {
  if (!/^sha256:[a-f0-9]{64}$/.test(expectedSha256)) throw new Error("displayed_digest_required");
  const raw = displayedBytes.get(`${id}|${expectedSha256}`) ?? await fetchRaw(id);
  const clientSha256 = await sha256Hex(raw.bytes);
  return {
    path: raw.path,
    byteLength: raw.byteLength,
    serverSha256: expectedSha256,
    clientSha256,
    equal: clientSha256 === expectedSha256,
    provedAt: new Date().toISOString(),
  };
}

export type LiveState = "live" | "stale" | "offline" | "sealed";

export function subscribeEvents(onEvent: (kind: string, at: number) => void): () => void {
  if (mode === "sealed") {
    onEvent("sealed", Date.now());
    return () => {};
  }
  const es = new EventSource("/api/events");
  const mark = (kind: string) => onEvent(kind, Date.now());
  es.addEventListener("evidence", () => mark("evidence"));
  es.addEventListener("heartbeat", () => mark("heartbeat"));
  es.onopen = () => mark("open");
  es.onerror = () => onEvent("error", Date.now());
  return () => es.close();
}
