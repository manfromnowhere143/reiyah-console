/* ST-14 · THE SAME HAZARD — the human and the automation on one object.
   The lane's H5 put a validated detector on BDD-A braking-event frames (the
   automation channel) and the drivers' gaze heatmap on the same objects (the
   human channel), and asked the Definition 32 question across the two kinds
   of agent: do they go blind to the same objects more than independence
   predicts. Three 2x2 squares, one per redundancy pairing: the red cell is
   the both-miss share, the outline is what independence predicts. Same-kind
   pairings overflow the outline; the cross-agent one fits it. Every figure is
   parsed from a retained transcript by a strict pattern and carries its
   digest; the bounds are rendered in the lane's words; the register's state
   for the joint-silent-miss claim is shown beside the number and neither is
   upgraded. The exhibit frames the design calls for are not committed by the
   lane, so the hero stays an explicit wait, never a stand-in. */
import { useLayoutEffect, useRef, useState } from "react";
import { fetchLane, fetchLaneText, parseH3, parseH5, parseH5Bounds, parsePairRow, parseRegister, type LaneFile } from "../lib/gateb";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const F = {
  H5: "human-channel/evidence/h5_cross_agent_joint.txt", MD: "human-channel/H5_CROSS_AGENT_JOINT.md",
  H3: "human-channel/evidence/h3_observation_response_joint.txt", P: "evidence/measurement/result_p.txt",
  R: "evidence/claim-status-register-2026-08-29.json",
};
const src = (f: LaneFile) => ({ id: `gateb/${f.id}`, path: `gate-b · ${f.path}`, sha256: f.sha256 ?? "" });
const fmt = (x: number | undefined, d = 3) => (x === undefined ? "∅" : x.toFixed(d));
const thou = (n: number) => n.toLocaleString("en-US");

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

interface Sq { key: string; name: string; short: string; sub: string; a: string; b: string; pA: number; pB: number; pBoth: number; c: number; file: LaneFile }

export function SameHazard() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, d: null };
    const [H5, MD, H3, P, R] = await Promise.all([F.H5, F.MD, F.H3, F.P, F.R].map((p) => fetchLaneText(p).catch(() => null)));
    const h5 = H5 ? parseH5(H5.text) : null;
    return {
      lane,
      d: {
        h5: h5 && H5 ? { ...h5, file: H5.file } : null,
        bounds: MD ? { items: parseH5Bounds(MD.text), file: MD.file } : null,
        h3: H3 ? { ...parseH3(H3.text), file: H3.file } : null,
        pair: P ? { row: parsePairRow(P.text, "megvii", "0.30"), file: P.file } : null,
        reg: R ? { ...parseRegister(R.text), file: R.file } : null,
      },
    };
  });
  const box = useBox(state.phase);
  if (state.phase === "loading") return <Station id="ST–14" name="The Same Hazard"><div className="note">reading the cross-agent joint…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–14" name="The Same Hazard"><Blocked reason={state.reason} /></Station>;
  const { lane, d } = state.data;
  if (!lane.present || !d) return <Station id="ST–14" name="The Same Hazard"><Blocked reason={`the Gate B lane is not present in this source: ${lane.reason ?? "unknown"}`} /></Station>;
  const h5 = d.h5;
  if (!h5) return <Station id="ST–14" name="The Same Hazard"><Blocked reason="the H5 transcript is not present in this source or not in its known shape; nothing is drawn in its place" /></Station>;

  const h3all = d.h3?.groups.find((g) => g.name === "all events") ?? null;
  const pr = d.pair?.row ?? null;
  const joint = d.reg?.claims.find((c) => /joint-silent-miss/.test(c.claim_id)) ?? null;

  const squares: Sq[] = [];
  if (pr && d.pair) squares.push({ key: "auto", name: "AUTOMATION · camera × lidar", short: "AUTOMATION", sub: "nuScenes · Result P · marginal", a: "camera miss", b: "lidar miss", pA: pr.pA, pB: pr.pB, pBoth: pr.pBoth, c: pr.c, file: d.pair.file });
  if (h3all && d.h3) squares.push({ key: "human", name: "HUMAN · looking × acting", short: "HUMAN", sub: `100-Car NDS · H3 · ${h3all.n} conflicts`, a: "not looking", b: "not reacting", pA: h3all.pObs / 100, pB: h3all.pResp / 100, pBoth: h3all.pBoth / 100, c: h3all.c, file: d.h3.file });
  squares.push({ key: "joint", name: "HUMAN × AUTOMATION", short: "HUMAN × AUTO", sub: `BDD-A · H5 · ${thou(h5.objects)} objects`, a: "auto miss", b: "human miss", pA: h5.pAuto / 100, pB: h5.pHum / 100, pBoth: h5.pBoth / 100, c: h5.c, file: h5.file });

  /* ---- three squares in measured pixels ---- */
  const art = box.w > 0 ? (() => {
    const W = box.w, H = box.h, mobile = W < 560, n = squares.length;
    const gap = mobile ? 14 : 36, padX = mobile ? 4 : 16, headH = mobile ? 30 : 38, capH = mobile ? 34 : 48;
    const s = Math.max(40, Math.floor(Math.min((W - padX * 2 - gap * (n - 1)) / n, H - headH - capH)));
    const total = n * s + gap * (n - 1), x00 = (W - total) / 2, y0 = headH + Math.max(0, (H - headH - capH - s) / 2);
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart sqs" aria-label="Three 2x2 squares: the both-miss cell against the outline independence predicts">
        {squares.map((q, i) => {
          const x0 = x00 + i * (s + gap);
          const wa = q.pA * s, hb = q.pB * s, hboth = (q.pBoth / q.pA) * s;
          const hold = Math.abs(q.c - 1) < 0.05;
          return (
            <g key={q.key} className={`sq${hold ? " hold" : ""}`}>
              <rect x={x0} y={y0} width={s} height={s} className="sqframe" />
              <rect x={x0} y={y0} width={wa} height={s} className="sqband" />
              <rect x={x0} y={y0 + s - hb} width={s} height={hb} className="sqband" />
              <rect x={x0} y={y0 + s - hboth} width={wa} height={hboth} className="sqboth" />
              <rect x={x0} y={y0 + s - hb} width={wa} height={hb} className="sqexp" />
              <text x={x0 + s / 2} y={y0 - 10} className="sqc" textAnchor="middle">{fmt(q.c, q.key === "human" ? 2 : 3)}</text>
              {!mobile && <text x={x0 + wa / 2} y={y0 - 26} className="mlab" textAnchor="middle">c</text>}
              {!mobile && <text x={x0 + Math.min(wa / 2, s - 30)} y={y0 + 12} className="mlab" textAnchor="middle">{q.a} {Math.round(q.pA * 100)}%</text>}
              {!mobile && <text x={x0 + s - 4} y={y0 + s - hb - 5} className="mlab" textAnchor="end">{q.b} {Math.round(q.pB * 100)}%</text>}
              <text x={x0 + s / 2} y={y0 + s + (mobile ? 12 : 16)} className="mlab" textAnchor="middle">{mobile ? q.short : q.name}</text>
              <text x={x0 + s / 2} y={y0 + s + (mobile ? 24 : 30)} className="mlab dim" textAnchor="middle">{mobile ? `${fmt(q.pBoth * 100, 1)}% vs ${fmt(q.pA * q.pB * 100, 1)}%` : `both ${fmt(q.pBoth * 100, 1)}% · independent ${fmt(q.pA * q.pB * 100, 1)}%`}</text>
              {!mobile && <text x={x0 + s / 2} y={y0 + s + 42} className="mlab dim" textAnchor="middle">{q.sub}</text>}
            </g>
          );
        })}
      </svg>
    );
  })() : null;

  return (
    <Station id="ST–14" name="The Same Hazard" sub="human × automation on one object · BDD-A · proposed · descriptive · a lower bound">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="human × automation · c" value={fmt(h5.c)} sub={`${thou(h5.objects)} objects · ${h5.clips} clips · ${h5.frames} frames · no interval`}
            rule={`H5: P(both miss) over P(automation miss) × P(human miss); automation miss = detector score below ${h5.tau}; human miss = mean gaze attention inside the box below the per-run median (${h5.median}); object set = detections at score ≥ 0.3 in eight driving classes; descriptive, not clustered`} from={[src(h5.file)]} />
          <Stat label="both miss · vs independence" value={<>{fmt(h5.pBoth, 1)}%<em> · {fmt(h5.expected, 1)}%</em></>} sub={`counts both ${thou(h5.counts[0])} · auto only ${thou(h5.counts[1])} · human only ${thou(h5.counts[2])} · corr ${fmt(h5.corr, 3)}`}
            rule="H5: the both-miss share of all objects beside the product of the two marginal miss shares; the 2x2 counts are the transcript's; the Pearson correlation is between detector score and gaze attention" from={[src(h5.file)]} />
          <Stat label="register · joint-silent-miss" value={joint ? joint.status : "∅"} sub={joint && d.reg ? `use ${joint.current_scientific_use} · register 2026-08-29 · H5 measures ${fmt(h5.c)} · neither upgraded` : "register absent"}
            rule="the claim-status register's state for the joint-silent-miss claim; the instrument shows the register's state beside the transcript's number and upgrades neither; a newer transcript does not change a register entry" from={d.reg ? [src(d.reg.file), src(h5.file)] : [src(h5.file)]} />
        </div>

        <div className="shzgrid">
          <div className="ipanel wspanel">
            <div className="ilabel">three squares · the both-miss cell against the outline independence predicts · red is the joint miss · same-kind overflows, different-kind fits</div>
            <div className="mbox" ref={box.ref}>{art}</div>
          </div>
          <div className="ipanel wspanel shzbounds">
            <div className="ilabel">the bounds · load-bearing · in the lane's words</div>
            <div className="wsrows">
              {d.bounds && d.bounds.items.length ? d.bounds.items.map((b, i) => (
                <div key={i} className="shzb">
                  <span className="shzt">{b.title}</span>
                  {b.rest && <span className="shzr">{b.rest}</span>}
                </div>
              )) : <div className="note">the H5 narrative is not present or its bounds section is not in its known shape</div>}
            </div>
            {d.bounds && <div className="shzdig"><Digest id={src(d.bounds.file).id} sha={src(d.bounds.file).sha256} path={src(d.bounds.file).path} /></div>}
          </div>
        </div>

        <div className="wsreg shzwait">
          <span className="cvl">the frame · waiting</span>
          <span className="wsregv">the design opens this station on an exhibit frame with the gaze field, the detector's brackets and the joint miss ringed; the lane has committed no exhibit bytes or rights records, and its ignore list excludes the dataset, so the hero waits on committed bytes and nothing stands in for it</span>
          <span className="wsregs">{squares.map((q) => <Digest key={q.key} id={src(q.file).id} sha={src(q.file).sha256} path={src(q.file).path} />)}</span>
        </div>
        <div className="mnon">{h5.nonclaims} · <Digest id={src(h5.file).id} sha={src(h5.file).sha256} path={src(h5.file).path} /></div>
      </div>
    </Station>
  );
}
