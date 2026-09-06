/* ST-15 · THE LAW — one estimand, three domains.
   The lane carried the same coefficient from two sensors to one human's two
   channels to a human and a machine, and then out of driving altogether: to
   seven language models answering the same questions. Every pairing sits on
   one line above one independence mark. Same-kind pairings fail together;
   the one pairing of different kinds does not. Every figure is parsed from a
   retained transcript by a strict pattern and carries its digest; the lane's
   non-claims are rendered verbatim; the claims register has no entry for the
   new results and the instrument says so rather than inventing a status. */
import { useLayoutEffect, useRef, useState } from "react";
import { fetchLane, fetchLaneText, parseConvergence, parseH3, parseH5, parseH6, parseHInstance, parseRegister, parseT, parseU, parseV, type LaneFile } from "../lib/gateb";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const F = {
  L: "evidence/measurement/result_l.txt", HI: "evidence/measurement/result_h_instance_unit.txt", H3: "human-channel/evidence/h3_observation_response_joint.txt",
  H5: "human-channel/evidence/h5_cross_agent_joint.txt", H6: "human-channel/evidence/h6_total_both_miss.txt",
  T: "llm-generalization/evidence/result_t.txt", U: "llm-generalization/evidence/result_u.txt", V: "llm-generalization/evidence/result_v.txt",
  R: "evidence/claim-status-register-2026-08-29.json",
};
const src = (f: LaneFile) => ({ id: `gateb/${f.id}`, path: `gate-b · ${f.path}`, sha256: f.sha256 ?? "" });
const fmt = (x: number | undefined, d = 3) => (x === undefined ? "∅" : x.toFixed(d));

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

/* one pairing on the line */
interface Mark { domain: string; name: string; c: number; lo?: number; hi?: number; range?: boolean; kind: "same" | "cross"; file: LaneFile; note?: string }

export function Law() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, d: null };
    const [L, HI, H3, H5, H6, T, U, V, R] = await Promise.all([F.L, F.HI, F.H3, F.H5, F.H6, F.T, F.U, F.V, F.R].map((p) => fetchLaneText(p).catch(() => null)));
    return {
      lane,
      d: {
        auto: L ? { ...parseConvergence(L.text), file: L.file } : null,
        hi: HI ? { pairs: parseHInstance(HI.text), file: HI.file } : null,
        h3: H3 ? { ...parseH3(H3.text), file: H3.file } : null,
        h5: H5 ? (() => { const v = parseH5(H5.text); return v ? { ...v, file: H5.file } : null; })() : null,
        h6: H6 ? (() => { const v = parseH6(H6.text); return v ? { ...v, file: H6.file } : null; })() : null,
        t: T ? (() => { const v = parseT(T.text); return v ? { ...v, file: T.file } : null; })() : null,
        u: U ? (() => { const v = parseU(U.text); return v ? { ...v, file: U.file } : null; })() : null,
        v: V ? (() => { const v = parseV(V.text); return v ? { ...v, file: V.file } : null; })() : null,
        reg: R ? { ...parseRegister(R.text), file: R.file } : null,
      },
    };
  });
  const box = useBox(state.phase);
  const jbox = useBox(state.phase);
  const mbox = useBox(state.phase);
  if (state.phase === "loading") return <Station id="ST–15" name="The Law"><div className="note">reading three domains…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–15" name="The Law"><Blocked reason={state.reason} /></Station>;
  const { lane, d } = state.data;
  if (!lane.present || !d) return <Station id="ST–15" name="The Law"><Blocked reason={`the Gate B lane is not present in this source: ${lane.reason ?? "unknown"}`} /></Station>;
  const { t, u, v, h5, h6 } = d;
  const autoT = d.auto && d.auto.rows.length ? d.auto.rows[d.auto.rows.length - 1] : null;
  const h3all = d.h3?.groups.find((g) => g.name === "all events") ?? null;

  const marks: Mark[] = [];
  const twoLidars = d.hi?.pairs.find((p) => p.modalities === "lidar/lidar") ?? null;
  if (twoLidars && d.hi) marks.push({ domain: "SENSORS", name: "two lidars · conditioned", c: twoLidars.condC, lo: twoLidars.condLo, hi: twoLidars.condHi, kind: "same", file: d.hi.file, note: "Result H, instance unit · 95% CI" });
  if (autoT && d.auto) marks.push({ domain: "SENSORS", name: "camera × lidar · conditioned", c: autoT.c, lo: autoT.lo, hi: autoT.hi, kind: "same", file: d.auto.file, note: "Result L · 95% CI" });
  if (h3all && d.h3) marks.push({ domain: "ONE HUMAN", name: "eyes × hands", c: h3all.c, kind: "same", file: d.h3.file, note: "H3 · no interval" });
  if (h5) marks.push({ domain: "HUMAN × MACHINE", name: "detectable objects", c: h5.c, kind: "cross", file: h5.file, note: "H5 · no interval" });
  if (h6) marks.push({ domain: "HUMAN × MACHINE", name: "total miss", c: h6.c, lo: h6.lo, hi: h6.hi, kind: "cross", file: h6.file, note: "H6 · clip-clustered 95% CI" });
  if (t) {
    marks.push({ domain: "LLM JURIES", name: "same family · marginal", c: t.sameFamily, kind: "same", file: t.file, note: "T · 3 pairs" });
    marks.push({ domain: "LLM JURIES", name: "cross family · marginal", c: t.crossFamily, kind: "same", file: t.file, note: "T · 18 pairs" });
    marks.push({ domain: "LLM JURIES", name: "all pairs · conditional", c: t.condMean, lo: t.condLo, hi: t.condHi, range: true, kind: "same", file: t.file, note: "T · range over 21 pairs" });
  }
  const domains = [...new Set(marks.map((m) => m.domain))];

  /* ---- the line: every pairing above one independence mark ---- */
  const line = box.w > 0 && marks.length ? (() => {
    const W = box.w, H = box.h, mobile = W < 560;
    const labW = mobile ? 104 : 186, padR = mobile ? 10 : 24, top = 22, bottom = H - 22;
    const xmin = 0.9, xmax = 1.6;
    const x = (v: number) => labW + ((W - labW - padR) * (Math.min(xmax, Math.max(xmin, v)) - xmin)) / (xmax - xmin);
    const rowH = (bottom - top) / marks.length;
    /* the domain name sits above its first row, the row names below it */
    let i = 0;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart lawline" aria-label="Every measured pairing on one line above the independence mark">
        <line x1={x(1)} x2={x(1)} y1={top - 8} y2={bottom + 6} className="mind" />
        <text x={x(1)} y={bottom + 18} className="mlab" textAnchor="middle">independence 1.0</text>
        {[1.2, 1.4, 1.6].map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={top - 4} y2={bottom + 2} className="lawgrid" /><text x={x(v)} y={bottom + 18} className="mlab dim" textAnchor="middle">{v.toFixed(1)}</text></g>)}
        {domains.map((dm) => {
          const rows = marks.filter((m) => m.domain === dm);
          const y0 = top + i * rowH;
          const g = (
            <g key={dm}>
              {!mobile && <text x={2} y={y0 + rowH / 2 - 8} className="lawdom" textAnchor="start">{dm}</text>}
              {rows.map((m, k) => {
                const yy = top + (i + k) * rowH + rowH / 2;
                return (
                  <g key={m.name} className={`lawmark ${m.kind}`}>
                    <line x1={x(1)} x2={x(m.c)} y1={yy} y2={yy} className="lawstem" />
                    {m.lo !== undefined && m.hi !== undefined && <line x1={x(m.lo)} x2={x(m.hi)} y1={yy} y2={yy} className={m.range ? "lawrange" : "lawci"} />}
                    <circle cx={x(m.c)} cy={yy} r={mobile ? 4 : 5.5} className="lawdot" />
                    <text x={x(m.c) + (mobile ? 8 : 11)} y={yy + 3.5} className="mval" textAnchor="start">{fmt(m.c, m.c.toFixed(3).endsWith("0") ? 2 : 3)}</text>
                    <text x={labW - 8} y={yy + (mobile ? 4 : 5)} className="mlab" textAnchor="end">{mobile ? m.name.split(" · ")[0] : m.name}</text>
                  </g>
                );
              })}
            </g>
          );
          i += rows.length;
          return g;
        })}
      </svg>
    );
  })() : null;

  /* ---- the jury: seven models, and how many of them count ---- */
  const jury = t && jbox.w > 0 ? (() => {
    const W = jbox.w, H = jbox.h, mobile = W < 560;
    const n = t.models.length, gap = mobile ? 6 : 10, pad = 8;
    const bw = (W - pad * 2 - gap * (n - 1)) / n;
    const barTop = 24, barBottom = H - 40;
    const eff = t.effective;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart jury" aria-label="Seven models' error rates, and the effective number of independent models">
        {t.models.map((m, k) => {
          const x0 = pad + k * (bw + gap);
          const hh = ((barBottom - barTop) * m.wrong) / 100;
          const lit = k + 1 <= Math.floor(eff) ? 1 : k < eff ? eff - Math.floor(eff) : 0;
          return (
            <g key={m.id}>
              <rect x={x0} y={barBottom - hh} width={bw} height={hh} className="jurybar" />
              <rect x={x0} y={barBottom - hh} width={bw * lit} height={hh} className="jurylit" />
              <text x={x0 + bw / 2} y={barBottom - hh - 5} className="mlab" textAnchor="middle">{m.wrong.toFixed(0)}%</text>
              <text x={x0 + bw / 2} y={barBottom + 12} className="mlab dim" textAnchor="middle">{mobile ? m.family.slice(0, 5) : m.family}</text>
            </g>
          );
        })}
        <text x={pad} y={14} className="mlab" textAnchor="start">wrong, per model · {t.questions.toLocaleString("en-US")} questions</text>
        <text x={W / 2} y={H - 8} className="mval" textAnchor="middle">{n} models · effective independent {fmt(eff, 1)} · all wrong together {fmt(t.allWrong, 1)}% vs {fmt(t.allWrongIndep, 2)}% independent</text>
      </svg>
    );
  })() : null;


  /* ---- the monitor: predicted risk against actual, held out ---- */
  const mon = v && mbox.w > 0 ? (() => {
    const W = mbox.w, H = mbox.h, pad = 26, top = 14, bottom = H - 22, left = pad + 8, right = W - 10;
    const x = (p: number) => left + ((right - left) * p) / 100, y = (p: number) => bottom - ((bottom - top) * p) / 100;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart monitor" aria-label="Predicted risk against actual wrong rate on held-out data">
        <line x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} className="mondiag" />
        <line x1={x(0)} x2={x(100)} y1={bottom} y2={bottom} className="monax" /><line x1={left} x2={left} y1={top} y2={bottom} className="monax" />
        <text x={x(50)} y={H - 6} className="mlab dim" textAnchor="middle">predicted risk</text>
        <text x={8} y={y(50)} className="mlab dim" textAnchor="start" transform={`rotate(-90 8 ${y(50)})`}>actual</text>
        {v.bands.map((b) => <g key={b.band} className="mser s0"><circle cx={x(b.predicted)} cy={y(b.actual)} r={4} className="mdot" /></g>)}
        <g className="monnaive"><circle cx={x(v.unanimousNaive)} cy={y(v.unanimousActual)} r={5} /><text x={x(v.unanimousNaive) + 9} y={y(v.unanimousActual) + 3} className="mlab" textAnchor="start">naive · says {v.unanimousNaive.toFixed(0)}%, wrong {v.unanimousActual.toFixed(1)}%</text></g>
        <g className="mser s0"><circle cx={x(v.unanimousMonitor)} cy={y(v.unanimousActual)} r={4} className="mdot" /></g>
      </svg>
    );
  })() : null;

  const noEntry = d.reg ? d.reg.claims.filter((c) => /llm|jury|agreement|monitor|total-both|cross-agent/.test(c.claim_id)).length : 0;
  const wrongCells = u ? Math.round(u.unanimousWrong) : 0;

  return (
    <Station id="ST–15" name="The Law" sub="one estimand · sensors, one human, a human and a machine, LLM juries · proposed · descriptive">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="same kind · fails together" value={marks.filter((m) => m.kind === "same").length ? `${fmt(Math.min(...marks.filter((m) => m.kind === "same").map((m) => m.c)), 2)} to ${fmt(Math.max(...marks.filter((m) => m.kind === "same").map((m) => m.c)), 2)}` : "∅"} sub="camera × lidar · eyes × hands · LLM juries · every one above 1" rule="the smallest and largest coefficient among the same-kind pairings on this line: two sensors (Result L, conditioned), one human's observation and response (H3), and LLM juries (T, marginal and conditional)" from={marks.filter((m) => m.kind === "same").map((m) => src(m.file)).filter((v, i, a) => a.findIndex((b) => b.id === v.id) === i)} />
          <Stat label="different kinds · holds" value={h6 ? `${fmt(h6.c)}` : h5 ? fmt(h5.c) : "∅"} sub={h6 ? `human × machine · total miss · [${fmt(h6.lo)}, ${fmt(h6.hi)}] · ${h6.verdict}` : h5 ? "human × machine · detectable · no interval" : "transcript absent"} rule="H6: P(both miss) over P(automation totally misses) × P(human misses) on 7,735 reference objects with a clip-clustered bootstrap interval; the verdict line is the transcript's own" from={h6 ? [src(h6.file)] : h5 ? [src(h5.file)] : []} />
          <Stat label="unanimous and wrong" value={u ? `${fmt(u.unanimousWrong, 1)}%` : "∅"} sub={u ? `of the ${fmt(u.unanimous, 1)}% unanimous verdicts · ${u.unanimousWrongN} questions · agree → correct ${fmt(u.avgCorrect, 1)}%` : "transcript absent"} rule="Result U: among questions where all seven models chose the same answer, the share where that answer was wrong; and the average over 21 pairs of P(correct | the two agree)" from={u ? [src(u.file)] : []} />
        </div>
        <div className="lawgrid">
          <div className="ipanel wspanel">
            <div className="ilabel">one line · every pairing above one independence mark · ink is same kind, steel blue is different kinds · brackets are intervals, the thin one a range</div>
            <div className="mbox" ref={box.ref}>{line ?? <div className="note">transcripts not present or not in their known shape</div>}</div>
          </div>
          <div className="lawside">
            <div className="ipanel wspanel fillpanel">
              <div className="ilabel">the jury · seven models on the same questions · Result T</div>
              <div className="mbox" ref={jbox.ref}>{jury ?? <div className="note">Result T not present or not in its known shape</div>}</div>
            </div>
            <div className="lawrow">
            {u && (
              <div className="ipanel wspanel lawu">
                <div className="ilabel">agreement is not confidence · of 100 unanimous verdicts · Result U</div>
                <div className="ucells" aria-label={`${wrongCells} of 100 unanimous verdicts are wrong`}>
                  {Array.from({ length: 100 }, (_, i) => <span key={i} className={i < wrongCells ? "uwrong" : "uok"} />)}
                </div>
                <div className="ulegend"><b>{wrongCells}</b> unanimous and wrong · <b>{100 - wrongCells}</b> right · an ensemble treats agreement as near certainty</div>
              </div>
            )}
            {v && (
              <div className="ipanel wspanel lawv">
                <div className="ilabel">the monitor · risk read from outputs alone · AUC {fmt(v.monitor.auc, 3)} vs naive {fmt(v.naive.auc, 3)} · Result V</div>
                <div className="mbox" ref={mbox.ref}>{mon}</div>
              </div>
            )}
            </div>
          </div>
        </div>
        <div className="wsreg">
          <span className="cvl">register check</span>
          <span className="wsregv">the claims register of 2026-08-29 holds {d.reg?.claims.length ?? "∅"} claims and <b>{noEntry === 0 ? "no entry" : `${noEntry} entries`}</b> for H6, T, U or V; these results are rendered as the lane's proposed, descriptive transcripts, and the instrument does not assign them a status the register has not</span>
          {d.reg && <Digest id={src(d.reg.file).id} sha={src(d.reg.file).sha256} path={src(d.reg.file).path} />}
        </div>
        <div className="mnon">{[t?.nonclaims, u?.nonclaims, v?.nonclaims, h6?.nonclaims].filter(Boolean).join(" · ")} {v && <Digest id={src(v.file).id} sha={src(v.file).sha256} path={src(v.file).path} />} {t && <Digest id={src(t.file).id} sha={src(t.file).sha256} path={src(t.file).path} />} {u && <Digest id={src(u.file).id} sha={src(u.file).sha256} path={src(u.file).path} />}</div>
      </div>
    </Station>
  );
}
