/* The Gate B measurement lane, read as a second source that is never
   blended with the Gate A packet. Sealed: /snapshot/gateb. Live: /api/gateb.
   Transcripts are parsed with strict patterns; a transcript that does not
   match its known shape yields a blocked panel, never a guessed number.
   Every parsed figure carries the transcript's path and digest. */
import { getMode, setBypassCache, snap } from "./evidence";
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
    const r = await fetch(getMode() === "sealed" ? snap("/snapshot/gateb/manifest.json") : "/api/gateb/manifest");
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
    const r = await fetch(getMode() === "sealed" ? snap(`/snapshot/gateb/raw/${id}`) : `/api/gateb/raw/${id}`);
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

/* ---------- the worst-group records (typed JSON lines) ---------- */
export interface Ev { state: string; value?: number; reason?: string }
export interface Group {
  group_id: string; performance: Ev; sample_count: Ev; effective_sample_size: Ev; interval_width: Ev;
  information_disposition: string; membership_state: string;
  coverage_counts: Record<string, number>;
}
export interface WorstGroupEval {
  evaluation_id: string; direction: string; disposition: string;
  worst_group_ids: string[]; worst_value: Ev; group_universe: string[];
  eligible_group_ids: string[]; insufficient_group_ids: string[]; unknown_group_ids: string[];
  groups: Group[];
}
export function parseWorstGroups(text: string): WorstGroupEval[] {
  const out: WorstGroupEval[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const wg = r.worst_group_evaluation ?? {};
    out.push({
      evaluation_id: String(r.evaluation_id ?? ""), direction: String(wg.direction ?? ""), disposition: String(wg.disposition ?? ""),
      worst_group_ids: wg.worst_group_ids ?? [], worst_value: wg.worst_value ?? { state: "missing" }, group_universe: wg.group_universe ?? [],
      eligible_group_ids: wg.eligible_group_ids ?? [], insufficient_group_ids: wg.insufficient_group_ids ?? [], unknown_group_ids: wg.unknown_group_ids ?? [],
      groups: (wg.group_results ?? []) as Group[],
    });
  }
  return out;
}

/* Result I: the finest strata (class x range x visibility) with simultaneous intervals */
export interface Stratum { cls: string; range: string; vis: string; n: number; lift: number; lo: number; hi: number; section: string }
export function parseStrata(text: string): Stratum[] {
  const out: Stratum[] = [];
  let section = "top";
  for (const line of text.split("\n")) {
    if (/least dependent eligible strata/.test(line)) section = "least";
    else if (/observed-insufficient strata/.test(line)) section = "insufficient";
    const m = /^\s{2}([a-z_]+)\s+(\d+-\d+)\s+(v\d+-\d+)\s+([\d,]+)\s+([\d.]+)\s+\[(-?[\d.]+), (-?[\d.]+)\]\s*$/.exec(line);
    if (m && section !== "insufficient") out.push({ cls: m[1], range: m[2], vis: m[3], n: Number(m[4].replace(/,/g, "")), lift: Number(m[5]), lo: Number(m[6]), hi: Number(m[7]), section });
  }
  return out;
}

/* ---------- the human channel transcripts (H1..H4) ---------- */
const pct = (s: string) => Number(s.replace("%", ""));
const nonclaims = (text: string) => (/NON-CLAIMS:\s*([\s\S]*?)\s*$/.exec(text)?.[1] ?? "").replace(/\s+/g, " ").trim();
export interface H1 { groups: Array<{ name: string; n: number; offMean: number; offMedian: number; anyOff: number; halfOff: number; forwardEntire: number; unknown: number }>; baseline: { n: number; offMean: number; offMedian: number; forwardEntire: number } | null; nonclaims: string }
export function parseH1(text: string): H1 {
  const strictEnd = text.indexOf("### ON-ROAD = Forward + Left");
  const strict = strictEnd > 0 ? text.slice(0, strictEnd) : text;
  const groups: H1["groups"] = [];
  const re = /^\s*(all events|crashes|near-crashes): n=(\d+)\s*\n\s*off-road proportion of observed window: mean ([\d.]+)%, median ([\d.]+)%\s*\n\s*any off-road glance in window\s*: ([\d.]+)%\s*\n\s*off-road for >= half the window\s*: ([\d.]+)%\s*\n\s*forward for the ENTIRE observed window : ([\d.]+)%[^\n]*\n\s*events with some No-Video \(unknown\)\s*: ([\d.]+)%/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(strict))) groups.push({ name: m[1], n: Number(m[2]), offMean: Number(m[3]), offMedian: Number(m[4]), anyOff: Number(m[5]), halfOff: Number(m[6]), forwardEntire: Number(m[7]), unknown: Number(m[8]) });
  const b = /baseline \(normal driving\), n=(\d+) epochs:\s*\n\s*off-road proportion: mean ([\d.]+)%, median ([\d.]+)%; forward entire epoch ([\d.]+)%/.exec(text);
  return { groups, baseline: b ? { n: Number(b[1]), offMean: Number(b[2]), offMedian: Number(b[3]), forwardEntire: Number(b[4]) } : null, nonclaims: nonclaims(text) };
}
export interface H2 { groups: Array<{ name: string; n: number; windowOff: number; forward: number; off: number; unknown: number }>; nonclaims: string }
export function parseH2(text: string): H2 {
  const groups: H2["groups"] = [];
  const re = /^\s*(all events|crashes|near-crashes): n=(\d+)\s*\n\s*reaction-window off-road proportion : mean ([\d.]+)%, median [\d.]+%\s*\n\s*gaze AT the conflict instant\s+forward : ([\d.]+)%[^\n]*\n\s*off-road : ([\d.]+)%\s*\n\s*unknown\s*: ([\d.]+)%/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) groups.push({ name: m[1], n: Number(m[2]), windowOff: Number(m[3]), forward: Number(m[4]), off: Number(m[5]), unknown: Number(m[6]) });
  return { groups, nonclaims: nonclaims(text) };
}
export interface H3 { groups: Array<{ name: string; n: number; pObs: number; pResp: number; pBoth: number; expected: number; c: number; forwardNoReact: number; forwardNoReactN: number }>; nonclaims: string }
export function parseH3(text: string): H3 {
  const groups: H3["groups"] = [];
  const re = /^\s*(all events|crashes|near-crashes): n=(\d+)\s*\n\s*P\(obs fail = gaze not forward\)\s*: ([\d.]+)%\s*\n\s*P\(resp fail = no reaction\)\s*: ([\d.]+)%\s*\n\s*P\(both fail\)\s*: ([\d.]+)%\s*\n\s*expected if independent P_obs\*P_resp: ([\d.]+)%\s*\n\s*coefficient c = observed\/expected\s*: ([\d.]+)\s*\n\s*looked forward yet DID NOT react\s*: ([\d.]+)%\s+\(n=(\d+)\)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) groups.push({ name: m[1], n: Number(m[2]), pObs: Number(m[3]), pResp: Number(m[4]), pBoth: Number(m[5]), expected: Number(m[6]), c: Number(m[7]), forwardNoReact: Number(m[8]), forwardNoReactN: Number(m[9]) });
  return { groups, nonclaims: nonclaims(text) };
}
export interface H4 { trials: number; participants: number; tasks: Array<{ id: string; name: string; n: number; mean: number; median: number; sd: number }>; grouped: Array<{ name: string; n: number; mean: number; median: number; sd: number }>; nonclaims: string }
export function parseH4(text: string): H4 {
  const t = /trials (\d+), participants (\d+)/.exec(text);
  const tasks: H4["tasks"] = [];
  const re = /^\s*(\d) ([a-z ]+?)\s+n=\s*(\d+)\s+mean ([\d.]+)s\s+median ([\d.]+)s\s+sd ([\d.]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) tasks.push({ id: m[1], name: m[2].trim(), n: Number(m[3]), mean: Number(m[4]), median: Number(m[5]), sd: Number(m[6]) });
  const grouped: H4["grouped"] = [];
  const rg = /^\s*(no task \(baseline\)|cognitive-only \([\d,]+\)|visual-manual \([\d,]+\))\s+n=\s*(\d+)\s+mean ([\d.]+)s\s+median ([\d.]+)s\s+sd ([\d.]+)/gm;
  while ((m = rg.exec(text))) grouped.push({ name: m[1].replace(/ \([\d,]+\)| \(baseline\)/, ""), n: Number(m[2]), mean: Number(m[3]), median: Number(m[4]), sd: Number(m[5]) });
  return { trials: t ? Number(t[1]) : 0, participants: t ? Number(t[2]) : 0, tasks, grouped, nonclaims: nonclaims(text) };
}
void pct;

export interface Claim { claim_id: string; status: string; current_scientific_use: string; estimand: string; lineage?: { first_stated_in?: string; superseded_by?: string | null } }
export function parseRegister(text: string): { claims: Claim[]; policy: Record<string, unknown> } {
  const j = JSON.parse(text);
  return { claims: (j.claims ?? []) as Claim[], policy: j.reconciliation_policy ?? {} };
}

/* ---------- H5: the cross-agent joint on BDD-A (human attention x automation detection) ---------- */
export interface H5 { clips: number; frames: number; objects: number; tau: number; median: number; pAuto: number; pHum: number; pBoth: number; expected: number; c: number; counts: [number, number, number, number]; corr: number; nonclaims: string }
export function parseH5(text: string): H5 | null {
  const num = (x: string) => Number(x.replace(/,/g, ""));
  const u = /BDD-A validation, ([\d,]+) clips, ([\d,]+) frames, ([\d,]+) driving objects/.exec(text);
  const r = /automation miss = score < ([\d.]+); human miss = gaze attention < median \(([\d.]+)\)/.exec(text);
  const pa = /P\(automation miss\)\s*: ([\d.]+)%/.exec(text);
  const ph = /P\(human miss\)\s*: ([\d.]+)%/.exec(text);
  const pb = /P\(both miss\)\s*: ([\d.]+)%/.exec(text);
  const ex = /expected if independent\s*: ([\d.]+)%/.exec(text);
  const cc = /cross-agent coefficient c\s*: ([\d.]+)/.exec(text);
  const k = /2x2 counts \[both,autoOnly,humOnly,neither\]: ([\d,]+), ([\d,]+), ([\d,]+), ([\d,]+)/.exec(text);
  const co = /Pearson corr\(automation score, human attention\): (-?[\d.]+)/.exec(text);
  if (!u || !r || !pa || !ph || !pb || !ex || !cc || !k || !co) return null;
  return { clips: num(u[1]), frames: num(u[2]), objects: num(u[3]), tau: Number(r[1]), median: Number(r[2]), pAuto: Number(pa[1]), pHum: Number(ph[1]), pBoth: Number(pb[1]), expected: Number(ex[1]), c: Number(cc[1]), counts: [num(k[1]), num(k[2]), num(k[3]), num(k[4])], corr: Number(co[1]), nonclaims: nonclaims(text) };
}
/* the bounds section of the H5 narrative, item by item, in the lane's words */
export function parseH5Bounds(md: string): Array<{ title: string; rest: string }> {
  const i = md.indexOf("## The bounds"); if (i < 0) return [];
  const j = md.indexOf("\n## ", i + 5);
  const sec = md.slice(i, j < 0 ? undefined : j);
  return sec.split(/\n(?=\d+\. )/).slice(1).map((it) => {
    const t = it.replace(/\s+/g, " ").replace(/`/g, "").trim();
    const m = /^\d+\. \*\*(.+?)\*\*\s*(.*)$/.exec(t);
    return m ? { title: m[1], rest: m[2].replace(/\*\*/g, "").replace(/^,\s*/, "") } : { title: t.replace(/^\d+\. /, ""), rest: "" };
  });
}
/* one row of Result P's per-threshold table for one sensor pair */
export interface PairRow { thr: number; pA: number; pB: number; c: number; lo: number; hi: number; pBoth: number }
export function parsePairRow(text: string, pair: "megvii" | "pointpillars", thr: string): PairRow | null {
  const start = text.indexOf(pair === "megvii" ? "PAIR 1" : "PAIR 2"); if (start < 0) return null;
  const end = pair === "megvii" ? text.indexOf("PAIR 2") : -1;
  const sec = text.slice(start, end < 0 ? undefined : end);
  const re = new RegExp(`^\\s*${thr.replace(".", "\\.")} \\|\\s+([\\d.]+)\\s+([\\d.]+) \\|\\s+([\\d.]+) \\[([\\d.]+),([\\d.]+)\\] \\|\\s+([\\d.]+) \\[`, "m");
  const m = re.exec(sec); if (!m) return null;
  return { thr: Number(thr), pA: Number(m[1]), pB: Number(m[2]), c: Number(m[3]), lo: Number(m[4]), hi: Number(m[5]), pBoth: Number(m[6]) };
}

/* ---------- H6: the total both-miss, with a clip-clustered interval ---------- */
export interface H6 { clips: number; frames: number; objects: number; pAuto: number; pHum: number; pBoth: number; expected: number; c: number; lo: number; hi: number; verdict: string; counts: [number, number, number, number]; nonclaims: string }
export function parseH6(text: string): H6 | null {
  const num = (x: string) => Number(x.replace(/,/g, ""));
  const u = /BDD-A validation, ([\d,]+) clips, ([\d,]+) frames, ([\d,]+) reference objects/.exec(text);
  const pa = /P\(automation totally misses a present object\)\s*: ([\d.]+)%/.exec(text);
  const ph = /P\(human misses\)\s*: ([\d.]+)%/.exec(text);
  const pb = /P\(BOTH miss = the joint silent miss\)\s*: ([\d.]+)%/.exec(text);
  const ex = /expected if independent\s*: ([\d.]+)%/.exec(text);
  const cc = /coefficient c\s*: ([\d.]+)/.exec(text);
  const ci = /clip-clustered bootstrap 95% CI\s*: \[([\d.]+), ([\d.]+)\]/.exec(text);
  const vd = /verdict\s*: ([^\n]+)/.exec(text);
  const k = /2x2 \[both,autoOnly,humOnly,neither\]\s*: ([\d,]+), ([\d,]+), ([\d,]+), ([\d,]+)/.exec(text);
  if (!u || !pa || !ph || !pb || !ex || !cc || !ci || !vd || !k) return null;
  return { clips: num(u[1]), frames: num(u[2]), objects: num(u[3]), pAuto: Number(pa[1]), pHum: Number(ph[1]), pBoth: Number(pb[1]), expected: Number(ex[1]), c: Number(cc[1]), lo: Number(ci[1]), hi: Number(ci[2]), verdict: vd[1].trim(), counts: [num(k[1]), num(k[2]), num(k[3]), num(k[4])], nonclaims: nonclaims(text) };
}
/* ---------- Result T: LLM juries fail together ---------- */
export interface ResultT { models: Array<{ id: string; family: string; wrong: number }>; questions: number; marginalMean: number; marginalLo: number; marginalHi: number; sameFamily: number; crossFamily: number; condMean: number; condLo: number; condHi: number; sameCond: number; crossCond: number; allWrong: number; allWrongIndep: number; inflation: number; effective: number; nonclaims: string }
export function parseT(text: string): ResultT | null {
  const q = /(\d+) models, ([\d,]+) questions answered by all/.exec(text);
  const models: ResultT["models"] = [];
  const re = /^\s{4}(\S+)\s+(\S+)\s+wrong ([\d.]+)%/gm; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) models.push({ id: m[1], family: m[2], wrong: Number(m[3]) });
  const mg = /marginal coefficient c across all 21 model pairs:\s*\n\s*mean ([\d.]+), range \[([\d.]+), ([\d.]+)\]/.exec(text);
  const sf = /same-family pairs \(\d+\): mean marginal c = ([\d.]+)/.exec(text);
  const cf = /cross-family pairs \(\d+\): mean marginal c = ([\d.]+)/.exec(text);
  const cd = /CONDITIONAL c \(beyond shared question difficulty\), all pairs:\s*\n\s*mean ([\d.]+), range \[([\d.]+), ([\d.]+)\]/.exec(text);
  const sc = /same-family conditional c\s*: ([\d.]+)/.exec(text);
  const cc = /cross-family conditional c\s*: ([\d.]+)/.exec(text);
  const aw = /observed P\(all wrong\)\s*: ([\d.]+)%/.exec(text);
  const ai = /if independent \(prod p\)\s*: ([\d.]+)%/.exec(text);
  const inf = /inflation over independence: ([\d.]+)x/.exec(text);
  const ef = /effective independent models: ([\d.]+)/.exec(text);
  if (!q || models.length < 2 || !mg || !sf || !cf || !cd || !sc || !cc || !aw || !ai || !inf || !ef) return null;
  return { models, questions: Number(q[2].replace(/,/g, "")), marginalMean: Number(mg[1]), marginalLo: Number(mg[2]), marginalHi: Number(mg[3]), sameFamily: Number(sf[1]), crossFamily: Number(cf[1]), condMean: Number(cd[1]), condLo: Number(cd[2]), condHi: Number(cd[3]), sameCond: Number(sc[1]), crossCond: Number(cc[1]), allWrong: Number(aw[1]), allWrongIndep: Number(ai[1]), inflation: Number(inf[1]), effective: Number(ef[1]), nonclaims: nonclaims(text) };
}
/* ---------- Result U: agreement is not confidence ---------- */
export interface ResultU { pairs: Array<{ pair: string; pAgree: number; pCorrect: number; pBothWrong: number }>; avgCorrect: number; avgBothWrong: number; unanimous: number; unanimousWrong: number; unanimousWrongN: number; nonclaims: string }
export function parseU(text: string): ResultU | null {
  const pairs: ResultU["pairs"] = [];
  const re = /^\s{2}(\S+ \+ \S+)\s+(\d+)%\s+([\d.]+)%\s+([\d.]+)%/gm; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) pairs.push({ pair: m[1], pAgree: Number(m[2]), pCorrect: Number(m[3]), pBothWrong: Number(m[4]) });
  const av = /average over 21 pairs: P\(correct\|agree\) ([\d.]+)%, P\(both wrong\|agree\) ([\d.]+)%/.exec(text);
  const un = /unanimous \(all chose the same answer\): ([\d.]+)% of questions/.exec(text);
  const uw = /UNANIMOUS AND WRONG\s*: ([\d.]+)%\s+\((\d+) questions\)/.exec(text);
  if (!pairs.length || !av || !un || !uw) return null;
  return { pairs, avgCorrect: Number(av[1]), avgBothWrong: Number(av[2]), unanimous: Number(un[1]), unanimousWrong: Number(uw[1]), unanimousWrongN: Number(uw[2]), nonclaims: nonclaims(text) };
}

/* ---------- Result H restated at the instance unit: one row per detector pair ---------- */
export interface HPair { pair: string; modalities: string; c: number; lo: number; hi: number; condC: number; condLo: number; condHi: number; same: boolean }
export function parseHInstance(text: string): HPair[] {
  const out: HPair[] = [];
  const re = /^(\S+ x \S+)\s+(camera\/lidar|lidar\/lidar|camera\/camera)\s+([\d.]+)\s+\[([\d.]+), ([\d.]+)\]\s+([\d.]+)\s+\[([\d.]+), ([\d.]+)\]\s+(SAME modality|cross-modality)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ pair: m[1], modalities: m[2], c: Number(m[3]), lo: Number(m[4]), hi: Number(m[5]), condC: Number(m[6]), condLo: Number(m[7]), condHi: Number(m[8]), same: m[9] === "SAME modality" });
  return out;
}

/* ---------- Result V: the deployed monitor, coupling-corrected risk from outputs ---------- */
export interface ResultV { train: number; test: number; baseError: number; naive: { auc: number; brier: number; ece: number }; monitor: { auc: number; brier: number; ece: number }; unanimousN: number; unanimousOf: number; unanimousActual: number; unanimousNaive: number; unanimousMonitor: number; bands: Array<{ band: number; predicted: number; actual: number; n: number }>; nonclaims: string }
export function parseV(text: string): ResultV | null {
  const hd = /train (\d+), held-out test (\d+); base ensemble error ([\d.]+)%/.exec(text);
  const nv = /naive: risk = 1 - agreement\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(text);
  const mo = /MONITOR: coupling-aware, calibrated\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(text);
  const un = /on held-out UNANIMOUS items \((\d+) of (\d+)\)/.exec(text);
  const ua = /actual wrong rate\s*: ([\d.]+)%/.exec(text);
  const unv = /naive risk \(1 - agreement\)\s*: ([\d.]+)%/.exec(text);
  const umo = /MONITOR risk\s*: ([\d.]+)%/.exec(text);
  const bands: ResultV["bands"] = [];
  const re = /risk band (\d+): predicted\s+([\d.]+)%\s+actual\s+([\d.]+)%\s+\(n=(\d+)\)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) bands.push({ band: Number(m[1]), predicted: Number(m[2]), actual: Number(m[3]), n: Number(m[4]) });
  if (!hd || !nv || !mo || !un || !ua || !unv || !umo || bands.length < 3) return null;
  return { train: Number(hd[1]), test: Number(hd[2]), baseError: Number(hd[3]), naive: { auc: Number(nv[1]), brier: Number(nv[2]), ece: Number(nv[3]) }, monitor: { auc: Number(mo[1]), brier: Number(mo[2]), ece: Number(mo[3]) }, unanimousN: Number(un[1]), unanimousOf: Number(un[2]), unanimousActual: Number(ua[1]), unanimousNaive: Number(unv[1]), unanimousMonitor: Number(umo[1]), bands, nonclaims: nonclaims(text) };
}

/* after boot, in idle time, every lane byte a station may read is fetched
   once, so the lane stations render in the frame they mount */
export function warmLane() {
  const idle = (cb: () => void) => ((window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 5000 }) : setTimeout(cb, 1200));
  idle(async () => {
    try {
      const lane = await fetchLane();
      for (const f of lane.files ?? []) { try { await fetchLaneText(f.path); } catch { /* the station will report it */ } }
    } catch { /* the station will report it */ }
  });
}
