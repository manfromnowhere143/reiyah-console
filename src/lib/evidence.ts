/* Evidence client with two honest sources and no third option:
   - LIVE: the evidence server (/api), digests recomputed at read time, SSE.
   - SEALED: a static snapshot bundle (/snapshot) written by seal-snapshot.mjs,
     with the seal time and commit identity on its face.
   The client tries live first, falls back to sealed, and otherwise blocks.
   In both modes WebCrypto re-verification works on the exact bytes; the mode
   is always displayed, never blended. */

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
/* a retry after a transport failure bypasses every cache in the path (HTTP
   cache and the service worker's stored copies), so a partial or stale body
   can never be re-served as if it were the network's answer */
let bypass = false;
export function setBypassCache(on: boolean) { bypass = on; }
const opts = (): RequestInit | undefined => (bypass ? { cache: "reload" } : undefined);
let sealedManifest: {
  sealedAt: string;
  identity: Summary["identity"];
  surfaces: SurfaceRow[];
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
    const r = await fetch("/snapshot/manifest.json", opts());
    if (!r.ok) return false;
    const m = await r.json();
    if (m?.kind !== "sealed_snapshot") return false;
    sealedManifest = m;
    mode = "sealed";
    return true;
  } catch {
    return false;
  }
}

/* ---- dynamic catalog: every committed evidence file, path-addressed ---- */
export interface CatalogEntry { path: string; bytes: number }
let catalogCache: CatalogEntry[] | null = null;

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache) return catalogCache;
  try {
    if (mode === "sealed") {
      const r = await fetch("/snapshot/catalog.json");
      if (r.ok) { catalogCache = (await r.json()).entries ?? []; return catalogCache!; }
      return [];
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

/** Warm every sealed surface and the catalog's decision records in idle time. */
export function warmSealedSurfaces() {
  if (mode !== "sealed" || !sealedManifest) return;
  const idle = (cb: () => void) => ((window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 800));
  idle(async () => {
    for (const row of sealedManifest!.surfaces) { try { await fetchRaw(row.id); } catch { /* the station will report it */ } }
    try {
      const cat = await fetchCatalog();
      for (const c of cat) if (/operator-decision|OPERATOR_DECISION/.test(c.path) && c.path.endsWith(".json")) { try { await fetchSurfaceByPath(c.path); } catch { /* reported by the station */ } }
    } catch { /* reported by the station */ }
  });
}

async function fetchSurfaceByPathUncached<T = unknown>(rel: string): Promise<SurfaceState<T>> {
  if (mode === "sealed") {
    try {
      const r = await fetch(`/snapshot/p/${rel.replaceAll("/", "__")}`);
      if (!r.ok) return { state: "blocked", reason: `sealed_missing_${r.status}` };
      const bytes = await r.arrayBuffer();
      const text = new TextDecoder().decode(bytes);
      const data = (rel.endsWith(".json") ? JSON.parse(text) : text) as T;
      const sha256 = await sha256Hex(bytes);
      return { state: "observed", meta: { id: `p/${rel}`, path: rel, sha256, bytes: bytes.byteLength, readAt: sealedManifest?.sealedAt ?? "" }, data };
    } catch (e) {
      return { state: "blocked", reason: String((e as Error)?.message ?? e) };
    }
  }
  return fetchSurface<T>(`p/${encodeURIComponent(rel)}` as string);
}

let lastSurfaces: SurfaceRow[] = [];
export function getSurfaces(): SurfaceRow[] { return lastSurfaces; }

export async function fetchSummary(): Promise<Summary> {
  try {
    const r = await fetch("/api/summary", opts());
    if (r.ok) {
      mode = "live";
      const s: Summary = await r.json();
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
  if (schemaMemo && !bypass) return schemaMemo;
  schemaMemo = (async () => {
    const r = await fetch(mode === "sealed" ? "/snapshot/schemas-index.json" : "/api/schemas", opts());
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
  if (mode === "sealed") {
    const row = sealedManifest?.surfaces.find((s) => s.id === id);
    if (!row) throw new Error("unknown_sealed_surface");
    if (!bypass && rawMemo.has(id)) return rawMemo.get(id)!;
    const job = (async () => {
      const r = await fetch(`/snapshot/raw/${id}`, opts());
      if (!r.ok) throw new Error(`sealed_raw_http_${r.status}`);
      const bytes = await r.arrayBuffer();
      return { bytes, path: row.path, serverSha256: row.sha256 ?? "unknown", byteLength: bytes.byteLength };
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
    if (mode === "sealed") {
      const raw = await fetchRaw(id);
      const text = new TextDecoder().decode(raw.bytes);
      const data = (raw.path.endsWith(".json") ? JSON.parse(text) : text) as T;
      return {
        state: "observed",
        meta: { id, path: raw.path, sha256: raw.serverSha256, bytes: raw.byteLength, readAt: sealedManifest!.sealedAt },
        data,
      };
    }
    const r = await fetch(`/api/surface/${id}`);
    const body = await r.json();
    if (!r.ok || body.state !== "observed") {
      return { state: "blocked", reason: body?.reason ?? `http_${r.status}` };
    }
    return { state: "observed", meta: body.meta, data: body.data as T };
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
export async function prove(id: string): Promise<Proof> {
  const raw = await fetchRaw(id);
  const clientSha256 = await sha256Hex(raw.bytes);
  return {
    path: raw.path,
    byteLength: raw.byteLength,
    serverSha256: raw.serverSha256,
    clientSha256,
    equal: clientSha256 === raw.serverSha256,
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
