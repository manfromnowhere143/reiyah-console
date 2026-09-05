/* ST-12 · THE WORST GROUP — where redundancy is weakest, drawn as the road.
   The range bands of the lane's worst-group records are distances ahead of
   the vehicle, so the field is the road: near bands at the bottom, far bands
   toward the horizon, one column per object class. Every group is a disc,
   sized by the objects it holds, deepened by its coincident-miss ratio; the
   worst eligible group is ringed red, and it sits directly ahead. A group
   whose membership is not observed is hollow and dashed, and where that makes
   the extremum unidentifiable the record says "missing" and so does this
   page. The finest strata from Result I are drawn with their simultaneous
   intervals. Every number is a field of a typed record with its digest. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchLane, fetchLaneText, parseStrata, parseWorstGroups, type Group, type LaneFile, type Stratum } from "../lib/gateb";
import { getAt, setAt } from "../lib/urlstate";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const WG = "evidence/measurement/worst-group-records.jsonl";
const RI = "evidence/measurement/result_i.txt";
const src = (f: LaneFile) => ({ id: `gateb/${f.id}`, path: `gate-b · ${f.path}`, sha256: f.sha256 ?? "" });
const fmt = (x: number | undefined) => (x === undefined ? "∅" : x.toFixed(3));
const name = (id: string) => id.replace(/^reiyah\.group\./, "").replace(/^cls-/, "").replace(/^class-/, "").replace(/^motion-/, "");
const parseId = (id: string) => { const m = /cls-(.+)-r(\d+-\d+)$/.exec(id); return m ? { cls: m[1], range: m[2] } : null; };
const TAU = Math.PI * 2;

function useBox(key: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const m = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSz({ w: Math.round(r.width), h: Math.round(r.height) }); };
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, [key]);
  return { ref, ...sz };
}

interface Cell { g: Group; cls: string; range: string }

/* ---------- the road: a canvas field of groups placed by class and range ---------- */
function Road({ cells, classes, ranges, worstId, atId, onPick }: {
  cells: Cell[]; classes: string[]; ranges: string[]; worstId: string | undefined; atId: string | undefined; onPick: (id: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hits = useRef<Array<{ id: string; x: number; y: number; r: number }>>([]);
  const atRef = useRef(atId); atRef.current = atId;
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const maxN = Math.max(1, ...cells.map((c) => c.g.sample_count.value ?? 0));
    const maxP = Math.max(1.01, ...cells.map((c) => c.g.performance.value ?? 0));
    let raf = 0;
    const draw = () => {
      const now = performance.now(), t = now / 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(draw); return; }
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const dark = document.documentElement.dataset.ground === "dark";
      const INK = dark ? "255,255,255" : "16,18,21";
      const RED = dark ? "227,25,55" : "214,23,50";
      const OK = dark ? "126,166,255" : "47,102,214";
      const VOID = dark ? "5,5,7" : "244,243,238";
      const mobile = w < 560;
      const mono = `${mobile ? 8 : 9}px "B612 Mono", Menlo, monospace`;
      const horizon = h * 0.12, bottom = h - (mobile ? 22 : 26), cx = w / 2;
      const groundH = bottom - horizon;
      const yAt = (p: number) => horizon + groundH * Math.pow(p, 1.55); // p: 0 far → 1 near
      const fAt = (y: number) => (y - horizon) / groundH;
      const halfAt = (f: number) => 18 + (w * 0.5 - 18) * f;
      /* the road */
      const sky = ctx.createLinearGradient(0, 0, 0, horizon + groundH * 0.35);
      sky.addColorStop(0, `rgba(${INK},0)`); sky.addColorStop(1, `rgba(${INK},${dark ? 0.05 : 0.04})`);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon + groundH * 0.35);
      ctx.strokeStyle = `rgba(${INK},0.3)`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx - 18, horizon); ctx.lineTo(cx - halfAt(1), bottom); ctx.moveTo(cx + 18, horizon); ctx.lineTo(cx + halfAt(1), bottom); ctx.stroke();
      ctx.strokeStyle = `rgba(${INK},0.22)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(w, horizon); ctx.stroke();
      const flow = reduced ? 0 : (t * 0.22) % 1;
      for (let k = 0; k < 9; k++) {
        const p = ((k / 9) + flow) % 1, y = yAt(p), f = fAt(y);
        ctx.strokeStyle = `rgba(${INK},${(0.10 + 0.22 * f).toFixed(3)})`; ctx.lineWidth = 1 + f * 2;
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y - (4 + f * 16)); ctx.stroke();
      }
      /* the range bands: each a depth zone, labelled at the left edge */
      const bandP = (i: number) => 0.93 - (i * 0.58) / Math.max(1, ranges.length - 1);   // nearest band lowest
      ranges.forEach((r, i) => {
        const p = bandP(i), y = yAt(p), f = fAt(y);
        const ya = yAt(Math.min(1, p + 0.1)), yb = yAt(Math.max(0.02, p - 0.1));
        ctx.fillStyle = `rgba(${INK},${(0.025 + 0.02 * (i % 2)).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(cx - halfAt(fAt(ya)), ya); ctx.lineTo(cx + halfAt(fAt(ya)), ya); ctx.lineTo(cx + halfAt(fAt(yb)), yb); ctx.lineTo(cx - halfAt(fAt(yb)), yb); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(${INK},${(0.08 + 0.1 * f).toFixed(3)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - halfAt(f), y); ctx.lineTo(cx + halfAt(f), y); ctx.stroke();
        ctx.font = mono; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = `rgba(${INK},0.55)`;
        ctx.fillText(`${r} m`, 6, y);
      });
      /* the columns: one per class, labelled at the near edge */
      const K = classes.length;
      const xOf = (k: number, f: number) => cx + ((k - (K - 1) / 2) / Math.max(1, (K - 1) / 2)) * halfAt(f) * 0.86;
      ctx.font = mono; ctx.textAlign = "center"; ctx.textBaseline = "top";
      classes.forEach((c, k) => {
        const x = xOf(k, 1), label = c.replace(/-/g, " ");
        ctx.fillStyle = `rgba(${INK},0.62)`;
        ctx.fillText(mobile ? label.slice(0, 5) : label.slice(0, 12), x, bottom + 5);
        ctx.strokeStyle = `rgba(${INK},0.06)`;
        ctx.beginPath(); ctx.moveTo(xOf(k, 0.02), yAt(0.02)); ctx.lineTo(x, bottom); ctx.stroke();
      });
      /* the discs, far to near so near ones paint over */
      const list: Array<{ id: string; x: number; y: number; r: number }> = [];
      const ordered = [...cells].sort((a, b) => ranges.indexOf(b.range) - ranges.indexOf(a.range));
      for (const c of ordered) {
        const i = ranges.indexOf(c.range), k = classes.indexOf(c.cls);
        const p = bandP(i), y = yAt(p), f = fAt(y), x = xOf(k, f);
        const n = c.g.sample_count.value ?? 0, perf = c.g.performance.value;
        const observed = c.g.membership_state === "observed" && c.g.performance.state === "observed";
        const base = (mobile ? 5 : 7) + (mobile ? 16 : 24) * Math.sqrt(n / maxN);
        const r = base * (0.45 + 0.55 * f);
        const depth = perf === undefined ? 0 : Math.min(1, Math.max(0, (perf - 1) / (maxP - 1)));
        const isWorst = c.g.group_id === worstId, isAt = c.g.group_id === atRef.current;
        list.push({ id: c.g.group_id, x, y, r });
        /* ground shadow */
        ctx.fillStyle = `rgba(${dark ? "0,0,0" : INK},${(0.10 * f).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(x, y + r * 0.75, r * 0.9, r * 0.22, 0, 0, TAU); ctx.fill();
        if (isWorst) {
          const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 2.2);
          const g = ctx.createRadialGradient(x, y, r, x, y, r + 26);
          g.addColorStop(0, `rgba(${RED},${(0.35 * pulse).toFixed(3)})`); g.addColorStop(1, `rgba(${RED},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r + 26, 0, TAU); ctx.fill();
        }
        if (observed) {
          ctx.fillStyle = `rgba(${OK},${(0.22 + 0.78 * depth).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(${INK},${(0.25 + 0.3 * f).toFixed(3)})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        } else {
          ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = `rgba(${INK},0.5)`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
        }
        if (isWorst) { ctx.strokeStyle = `rgba(${RED},0.95)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.stroke(); }
        if (isAt) { ctx.strokeStyle = `rgba(${INK},0.95)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + (isWorst ? 8 : 4), 0, TAU); ctx.stroke(); }
        /* the reading, inside when the disc has room, above otherwise */
        const txt = observed ? fmt(perf).replace(/0+$/, "").replace(/\.$/, "") : "∅";
        ctx.font = `${mobile ? 8 : 9}px "B612 Mono", Menlo, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (r >= (mobile ? 11 : 13)) { ctx.fillStyle = depth > 0.45 ? `rgba(${VOID},0.95)` : `rgba(${INK},0.95)`; ctx.fillText(txt, x, y); }
        else if (isAt || isWorst || (f > 0.6 && r >= 7)) {
          const tw = ctx.measureText(txt).width + 6;
          ctx.fillStyle = `rgba(${VOID},0.8)`; ctx.beginPath(); ctx.roundRect(x - tw / 2, y - r - 14, tw, 12, 3); ctx.fill();
          ctx.fillStyle = `rgba(${INK},0.9)`; ctx.fillText(txt, x, y - r - 8);
        }
      }
      hits.current = list;
      /* the vehicle: a reticle at the near edge, the eye that carries both sensors */
      ctx.strokeStyle = `rgba(${RED},0.7)`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, bottom - 2, 5, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(${RED},0.95)`; ctx.beginPath(); ctx.arc(cx, bottom - 2, 1.6, 0, TAU); ctx.fill();
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [cells, classes, ranges, worstId]);
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: { id: string; d: number } | null = null;
    for (const h of hits.current) { const d = Math.hypot(h.x - x, h.y - y); if (d <= h.r + 10 && (!best || d < best.d)) best = { id: h.id, d }; }
    if (best) onPick(best.id);
  };
  return <canvas ref={ref} className="wgroad" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => onPick(null)} aria-label="The road: every group a disc placed by its class and its range ahead of the vehicle" />;
}

/* ---------- the finest strata: dot and simultaneous interval, per row ---------- */
function StrataChart({ rows, box }: { rows: Stratum[]; box: { w: number; h: number } }) {
  const W = box.w, H = box.h;
  if (W === 0 || H === 0) return null;
  const rowH = W < 560 ? 17 : 20, top = 16, foot = 14;
  const cap = Math.max(1, Math.floor((H - top - foot) / rowH));
  const shown = rows.slice(0, cap);
  const lo = Math.min(0, ...shown.map((r) => r.lo)), hi = Math.max(...shown.map((r) => r.hi));
  const labelW = W < 560 ? 124 : 196, nW = W < 560 ? 0 : 62, padR = 8;
  const x = (v: number) => labelW + ((W - labelW - nW - padR) * (v - lo)) / Math.max(1e-9, hi - lo);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart" aria-label="Finest strata with simultaneous 95% intervals">
      <line x1={x(1)} x2={x(1)} y1={top - 6} y2={top + shown.length * rowH} className="mind" />
      <text x={x(1)} y={top - 8} className="mlab" textAnchor="middle">independence 1.0</text>
      {shown.map((r, i) => {
        const y = top + i * rowH + rowH / 2;
        return (
          <g key={`${r.cls}${r.range}${r.vis}`} className={r.section === "least" ? "mser s1" : "mser s0"}>
            <text x={2} y={y + 3} className="mlab" textAnchor="start">{W < 560 ? `${r.cls.slice(0, 9)} · ${r.range} · ${r.vis.replace("v", "")}` : `${r.cls} · ${r.range} m · vis ${r.vis.replace("v", "")}`}</text>
            <line x1={x(r.lo)} x2={x(r.hi)} y1={y} y2={y} className="mci" />
            <circle cx={x(r.lift)} cy={y} r={3.2} className="mdot" />
            <text x={x(r.lift)} y={y - 6} className="mval" textAnchor="middle">{r.lift.toFixed(2)}</text>
            {nW > 0 && <text x={W - padR} y={y + 3} className="mlab" textAnchor="end">n {r.n.toLocaleString()}</text>}
          </g>
        );
      })}
      {shown.length < rows.length && <text x={2} y={H - 3} className="mlab" textAnchor="start">+ {rows.length - shown.length} more strata in the transcript</text>}
    </svg>
  );
}

export function WorstGroup() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, wg: null, strata: null };
    const [W, I] = await Promise.all([fetchLaneText(WG).catch(() => null), fetchLaneText(RI).catch(() => null)]);
    return { lane, wg: W ? { evals: parseWorstGroups(W.text), file: W.file } : null, strata: I ? { rows: parseStrata(I.text), file: I.file } : null };
  });
  const [hover, setHover] = useState<string | null>(() => getAt());
  const [cur, setCur] = useState(0);
  const sbox = useBox(state.phase);
  const evals = state.phase === "ready" ? state.data.wg?.evals ?? [] : [];
  const field = evals.find((e) => e.evaluation_id.endsWith("class-and-range")) ?? null;
  const byClass = evals.find((e) => e.evaluation_id.endsWith("by-class")) ?? null;
  const motion = evals.find((e) => e.evaluation_id.endsWith("motion-state")) ?? null;
  const allGroups = [...(field?.groups ?? []), ...(byClass?.groups ?? []), ...(motion?.groups ?? [])];
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || hover !== null || allGroups.length === 0) return;
    const t = setInterval(() => setCur((c) => (c + 1) % allGroups.length), 1400);
    return () => clearInterval(t);
  }, [hover, allGroups.length]);

  if (state.phase === "loading") return <Station id="ST–12" name="The Worst Group"><div className="note">reading the worst-group records…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–12" name="The Worst Group"><Blocked reason={state.reason} /></Station>;
  const { lane, wg, strata } = state.data;
  if (!lane.present || !wg) return <Station id="ST–12" name="The Worst Group"><Blocked reason={`the Gate B lane's worst-group records are not present in this source: ${lane.reason ?? "unknown"}`} /></Station>;

  const at = allGroups.find((g) => g.group_id === hover) ?? allGroups[cur % Math.max(1, allGroups.length)];
  const pick = (id: string | null) => { setHover(id); if (id) setAt(id); };
  const WGS = [src(wg.file)];
  const cells: Cell[] = (field?.groups ?? []).map((g) => ({ g, ...parseId(g.group_id)! })).filter((c) => c.cls);
  const classes = [...new Set(cells.map((c) => c.cls))].sort();
  const ranges = [...new Set(cells.map((c) => c.range))].sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const worstField = field?.worst_group_ids?.[0];
  const maxN = Math.max(1, ...allGroups.map((g) => g.sample_count.value ?? 0));
  const maxP = Math.max(1.01, ...allGroups.map((g) => g.performance.value ?? 0));
  const disc = (g: Group, worst: boolean, key: string) => {
    const n = g.sample_count.value ?? 0, p = g.performance.value;
    const observed = g.membership_state === "observed" && g.performance.state === "observed";
    return (
      <button key={key} className="wgdisc" data-worst={String(worst)} data-observed={String(observed)} data-on={String(at?.group_id === g.group_id)}
        style={{ ["--r" as any]: (0.3 + 0.7 * Math.sqrt(n / maxN)).toFixed(3), ["--d" as any]: (p === undefined ? 0 : Math.min(1, (p - 1) / (maxP - 1))).toFixed(3) }}
        onPointerEnter={() => pick(g.group_id)} onClick={() => pick(g.group_id)} onFocus={() => pick(g.group_id)}
        aria-label={`${name(g.group_id)} · ratio ${fmt(p)} · ${n.toLocaleString()} objects`} title={`${name(g.group_id)} · ${fmt(p)} · ${n.toLocaleString()} objects`}>
        <i /><b>{observed ? fmt(p).replace(/0+$/, "").replace(/\.$/, "") : "∅"}</b><span>{name(g.group_id)}</span>
      </button>
    );
  };
  const coverage = allGroups.reduce((acc, g) => { for (const [k, v] of Object.entries(g.coverage_counts ?? {})) if (k !== "total") acc[k] = (acc[k] ?? 0) + v; return acc; }, {} as Record<string, number>);
  const finest = strata && strata.rows.length ? strata : null;

  return (
    <Station id="ST–12" name="The Worst Group" sub="gate b · where redundancy is weakest · proposed · not externally audited">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="worst group · class × range" value={field && field.worst_value.state === "observed" ? fmt(field.worst_value.value) : "∅"} sub={field ? `${field.worst_group_ids.map(name).join(", ")} · ${field.disposition} · directly ahead` : "record absent"}
            rule="worst_value and worst_group_ids of the class-and-range worst-group evaluation; the ratio is coincident misses over what independence predicts inside that group; direction lower is better" from={WGS} />
          <Stat label="worst class" value={byClass && byClass.worst_value.state === "observed" ? fmt(byClass.worst_value.value) : "∅"} sub={byClass ? `${byClass.worst_group_ids.map(name).join(", ")} · ${byClass.groups.length} classes` : "record absent"}
            rule="worst_value of the by-class worst-group evaluation over its declared group universe" from={WGS} />
          <Stat label="by motion state" value={motion ? (motion.worst_value.state === "observed" ? fmt(motion.worst_value.value) : motion.worst_value.state.toUpperCase()) : "∅"} small sub={motion ? `${motion.disposition} · ${motion.unknown_group_ids.length} group with non-observed membership` : "record absent"}
            rule="the motion-state evaluation's worst_value: when any group's membership is not observed, the extremum over the universe is not identified and the record says so; this page repeats it rather than picking the best of the rest" from={WGS} />
          <Stat label="groups evaluated" value={allGroups.length} sub={Object.entries(coverage).filter(([, v]) => v > 0).map(([k, v]) => `${v.toLocaleString()} ${k.replace(/_/g, " ")}`).join(" · ") || "no coverage counts"}
            rule="count of group_results across the three evaluations; the coverage counts are summed per epistemic state exactly as each record declares them" from={WGS} />
          <Stat label="finest stratum" value={finest ? fmt(finest.rows[0].lift) : "∅"} sub={finest ? `${finest.rows[0].cls} · ${finest.rows[0].range} m · ${finest.rows[0].vis} · simultaneous 95% [${finest.rows[0].lo}, ${finest.rows[0].hi}]` : "transcript absent"}
            rule="the top row of Result I's most-dependent eligible strata table (class × range × visibility) with its simultaneous 95% interval from a bootstrap max-t band" from={finest ? [src(finest.file)] : []} />
        </div>

        <div className="wggrid">
          <div className="ipanel wgpanel">
            <div className="ilabel">the road · every group a disc placed by its class and its range ahead · size = objects · depth = coincident-miss ratio · the worst eligible group is ringed</div>
            <div className="wgroadwrap"><Road cells={cells} classes={classes} ranges={ranges} worstId={worstField} atId={at?.group_id} onPick={pick} /></div>
          </div>
          <div className="wgside">
            <div className="ipanel wgpanel">
              <div className="ilabel">by class · {byClass?.groups.length ?? 0} groups · by motion state · {motion?.groups.length ?? 0} groups</div>
              <div className="wgrowfree">{(byClass?.groups ?? []).map((g) => disc(g, byClass?.worst_group_ids.includes(g.group_id) ?? false, `c-${g.group_id}`))}</div>
              <div className="wgrowfree">{(motion?.groups ?? []).map((g) => disc(g, false, `m-${g.group_id}`))}</div>
              {motion && motion.worst_value.state !== "observed" && <div className="wgmissing">extremum {motion.worst_value.state}: {String(motion.worst_value.reason ?? "")}</div>}
            </div>
            <div className="ipanel wgpanel fillpanel">
              <div className="ilabel">the finest strata · class × range × visibility · Result I · simultaneous 95% intervals</div>
              <div className="mbox" ref={sbox.ref}>{finest ? <StrataChart rows={finest.rows} box={sbox} /> : <div className="note">Result I transcript not present or not in its known shape</div>}</div>
            </div>
          </div>
        </div>

        <div className="wallcap wgcap" aria-live="polite">
          <span className="wcidx">{at ? name(at.group_id) : ""}</span>
          <span className="wcpath">{at ? `ratio ${fmt(at.performance.value)} · ${(at.sample_count.value ?? 0).toLocaleString()} objects · effective n ${(at.effective_sample_size.value ?? 0).toLocaleString()} · interval width ${fmt(at.interval_width.value)} · ${at.information_disposition} · membership ${at.membership_state}` : ""}</span>
          <span className="wcrule">{at ? Object.entries(at.coverage_counts ?? {}).filter(([k, v]) => k !== "total" && v > 0).map(([k, v]) => `${k.replace(/_/g, " ")} ${v.toLocaleString()}`).join(" · ") : ""}</span>
        </div>
        <div className="mnon">coincident-miss ratio inside each group, lower is better · association after declared conditioning, not causation · one public split · proposed · not externally audited · <Digest id={src(wg.file).id} sha={src(wg.file).sha256} path={src(wg.file).path} /></div>
      </div>
    </Station>
  );
}
