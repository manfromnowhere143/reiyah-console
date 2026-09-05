/* The Gate B measurement lane, read as a second source that is never
   blended with the Gate A packet. Sealed: /snapshot/gateb. Live: /api/gateb.
   Transcripts are parsed with strict patterns; a transcript that does not
   match its known shape yields a blocked panel, never a guessed number.
   Every parsed figure carries the transcript's path and digest. */
import { getMode, setBypassCache } from "./evidence";
void setBypassCache;

export interface LaneFile { id: string; path: string; bytes?: number; sha256?: string; state?: string }
export interface LaneManifest {
  present: boolean; reason?: string;
  identity?: { state: string; head: string; branch: string; worktree_clean: boolean; commit_count: number; root: string };
  sealedAt?: string; files?: LaneFile[];
  lane_nonclaims?: Record<string, unknown>;
}
let manifestMemo: Promise<LaneManifest> | null = null;
const rawMemo = new Map<string, Promise<{ text: string; file: LaneFile }>>();

export function fetchLane(): Promise<LaneManifest> {
  if (manifestMemo) return manifestMemo;
  manifestMemo = (async () => {
    const r = await fetch(getMode() === "sealed" ? "/snapshot/gateb/manifest.json" : "/api/gateb/manifest");
    if (!r.ok) return { present: false, reason: `lane_manifest_http_${r.status}` };
    return (await r.json()) as LaneManifest;
  })();
  manifestMemo.catch(() => { manifestMemo = null; });
  return manifestMemo;
}

export async function fetchLaneText(pathRel: string): Promise<{ text: string; file: LaneFile }> {
  const id = pathRel.replaceAll("/", "__");
  if (rawMemo.has(id)) return rawMemo.get(id)!;
  const job = (async () => {
    const m = await fetchLane();
    const file = m.files?.find((f) => f.id === id);
    if (!m.present || !file || file.state === "absent") throw new Error(`lane_file_absent:${pathRel}`);
    const r = await fetch(getMode() === "sealed" ? `/snapshot/gateb/raw/${id}` : `/api/gateb/raw/${id}`);
    if (!r.ok) throw new Error(`lane_raw_http_${r.status}`);
    return { text: await r.text(), file };
  })();
  rawMemo.set(id, job);
  job.catch(() => rawMemo.delete(id));
  return job;
}

/* ---------- strict transcript parsers ---------- */
export interface Row { level: string; label: string; strata: number; n: number; c: number; lo: number; hi: number }
export function parseConvergence(text: string): { rows: Row[]; mediator: { c: number; lo: number; hi: number } | null } {
  const i = text.indexOf("COMMON SUPPORT");
  const body = i >= 0 ? text.slice(i) : "";
  const rows: Row[] = [];
  const re = /^\s*(L\d) (.+?)\s{2,}(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d.]+)\s+\[([\d.]+), ([\d.]+)\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (rows.some((r) => r.level === m![1])) continue;
    rows.push({ level: m[1], label: m[2].trim(), strata: Number(m[3]), n: Number(m[4].replace(/,/g, "")), c: Number(m[6]), lo: Number(m[7]), hi: Number(m[8]) });
  }
  const md = /L6 \+ lidar point count \(INADMISSIBLE\)[\s\S]*?c = ([\d.]+)\s+95% CI \[([\d.]+), ([\d.]+)\]/.exec(text);
  return { rows, mediator: md ? { c: Number(md[1]), lo: Number(md[2]), hi: Number(md[3]) } : null };
}

export interface SweepRow { thr: number; mc: number; mlo: number; mhi: number; c: number; lo: number; hi: number; excl: boolean }
export interface SweepPair { a: string; b: string; rows: SweepRow[] }
export function parseSweep(text: string): SweepPair[] {
  const pairs: SweepPair[] = [];
  const parts = text.split(/^PAIR \d+\s+/m).slice(1);
  for (const part of parts) {
    const head = /^([a-z0-9]+) x ([a-z0-9]+)/i.exec(part);
    if (!head) continue;
    const rows: SweepRow[] = [];
    const re = /^\s+([\d.]+)\s+([\d.]+) \[([\d.]+), ([\d.]+)\]\s+([\d.]+) \[([\d.]+), ([\d.]+)\]\s+(YES|NO)\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(part))) rows.push({ thr: Number(m[1]), mc: Number(m[2]), mlo: Number(m[3]), mhi: Number(m[4]), c: Number(m[5]), lo: Number(m[6]), hi: Number(m[7]), excl: m[8] === "YES" });
    if (rows.length) pairs.push({ a: head[1], b: head[2], rows });
  }
  return pairs;
}

export interface EValue { a: string; b: string; e: number; eci: number }
export function parseEValues(text: string): EValue[] {
  const out: EValue[] = [];
  const re = /^\s*(\S+) x (\S+)\s+E-value ([\d.]+)\s+\(([\d.]+) for the near-null/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ a: m[1], b: m[2], e: Number(m[3]), eci: Number(m[4]) });
  return out;
}

export interface GridCell { a: string; am: string; b: string; bm: string; kind: string; c: number; lo: number; hi: number; excl: boolean }
export function parseGrid(text: string): GridCell[] {
  const out: GridCell[] = [];
  const re = /^\s*(\S+)\((C|L)\)\s+x (\S+)\((C|L)\)\s+(cross|same \((?:lidar|camera)\))\s+([\d.]+)\s+\[([\d.]+), ([\d.]+)\]\s+(yes|no)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ a: m[1], am: m[2], b: m[3], bm: m[4], kind: m[5], c: Number(m[6]), lo: Number(m[7]), hi: Number(m[8]), excl: m[9] === "yes" });
  return out;
}

export interface Opposite { pair: string; c0: number; c1: number; p0: number; p1: number }
export function parseOpposite(text: string): Opposite[] {
  const out: Opposite[] = [];
  const re = /^\s*(megvii|pointpillars) pair\s+c ([\d.]+) -> ([\d.]+) .*?P\(both\) ([\d.]+) -> ([\d.]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ pair: m[1], c0: Number(m[2]), c1: Number(m[3]), p0: Number(m[4]), p1: Number(m[5]) });
  return out;
}

export interface Claim { claim_id: string; status: string; current_scientific_use: string; estimand: string; lineage?: { first_stated_in?: string; superseded_by?: string | null } }
export function parseRegister(text: string): { claims: Claim[]; policy: Record<string, unknown> } {
  const j = JSON.parse(text);
  return { claims: (j.claims ?? []) as Claim[], policy: j.reconciliation_policy ?? {} };
}
