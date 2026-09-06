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
import { useEffect } from "react";
import { fetchLane, fetchLaneText, parseH3, parseH5, parseH5Bounds, parseH6, parsePairRow, parseRegister, type LaneFile } from "../lib/gateb";
import { MONO, tones, useGround } from "../lib/roadScene";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const F = {
  H5: "human-channel/evidence/h5_cross_agent_joint.txt", MD: "human-channel/H5_CROSS_AGENT_JOINT.md",
  H3: "human-channel/evidence/h3_observation_response_joint.txt", P: "evidence/measurement/result_p.txt",
  H6: "human-channel/evidence/h6_total_both_miss.txt",
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

interface Sq { key: string; name: string; short: string; sub: string; a: string; b: string; pA: number; pB: number; pBoth: number; c: number; file: LaneFile; counts?: [number, number, number, number]; lo?: number; hi?: number }

/* ---- the squares, as a field: where the transcript gives counts, every
   object is one point, red where both channels missed it; placement inside
   a cell is arbitrary, the cell's population is not. Where only shares are
   known the cell is an area. The outline is what independence predicts. ---- */
function SquaresScene({ w, h, squares }: { w: number; h: number; squares: Sq[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useGround();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const cv = ref.current; if (!cv || w === 0 || h === 0 || !squares.length) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const { INK, OK, RED } = tones(dark);
      const mobile = w < 560, n = squares.length;
      const cols = n, rows = 1;
      const gapX = mobile ? 8 : 26, gapY = 0, padX = mobile ? 4 : 14, headH = mobile ? 26 : 40, capH = mobile ? 30 : 50;
      const s = Math.max(40, Math.floor(Math.min((w - padX * 2 - gapX * (cols - 1)) / cols, (h - rows * (headH + capH) - gapY * (rows - 1)) / rows)));
      const totalW = cols * s + gapX * (cols - 1), totalH = rows * (s + headH + capH) + gapY * (rows - 1);
      const x00 = (w - totalW) / 2, y00 = Math.max(0, (h - totalH) / 2);
      let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      squares.forEach((q, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x0 = x00 + col * (s + gapX), y0 = y00 + row * (s + headH + capH + gapY) + headH;
        const wa = q.pA * s, hb = q.pB * s, hboth = (q.pBoth / q.pA) * s;
        const hold = Math.abs(q.c - 1) < 0.05;
        /* the frame and the two bands */
        ctx.fillStyle = `rgba(${INK},0.035)`; ctx.fillRect(x0, y0, s, s);
        ctx.fillStyle = `rgba(${INK},0.05)`; ctx.fillRect(x0, y0, wa, s); ctx.fillRect(x0, y0 + s - hb, s, hb);
        ctx.strokeStyle = `rgba(${INK},0.22)`; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, s - 1, s - 1);
        if (q.counts) {
          /* every object, one point: both (red), auto only, human only, neither */
          const [nb, na, nh, nn] = q.counts;
          const cell = (count: number, cx0: number, cy0: number, cw: number, ch: number, color: string, size: number) => {
            if (cw <= 0 || ch <= 0) return;
            ctx.fillStyle = color;
            for (let k = 0; k < count; k++) ctx.fillRect(cx0 + rnd() * (cw - size), cy0 + rnd() * (ch - size), size, size);
          };
          const dot = Math.max(0.9, s / 210);
          cell(nb, x0, y0 + s - hboth, wa, hboth, `rgba(${RED},0.85)`, dot);
          const haOnly = s - hboth;
          cell(na, x0, y0, wa, haOnly, `rgba(${INK},0.55)`, dot);
          cell(nh, x0 + wa, y0 + s - (nh / (nh + nn)) * s, s - wa, (nh / (nh + nn)) * s, `rgba(${INK},0.55)`, dot);
          cell(nn, x0 + wa, y0, s - wa, s - (nh / (nh + nn)) * s, `rgba(${INK},0.28)`, dot);
        } else {
          ctx.fillStyle = `rgba(${RED},0.72)`; ctx.fillRect(x0, y0 + s - hboth, wa, hboth);
        }
        /* the outline independence predicts */
        ctx.save(); if (!hold) ctx.setLineDash([3, 3]);
        ctx.strokeStyle = hold ? `rgba(${OK},1)` : `rgba(${INK},0.85)`; ctx.lineWidth = hold ? 2 : 1.2;
        ctx.strokeRect(x0 + 0.5, y0 + s - hb + 0.5, wa - 1, hb - 1); ctx.restore();
        /* the coefficient above, the captions below */
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        const hasCI = q.lo !== undefined && q.hi !== undefined && !mobile;
        ctx.fillStyle = hold ? `rgba(${OK},1)` : `rgba(${INK},1)`; ctx.font = `600 ${mobile ? 16 : 20}px ${MONO}`;
        ctx.fillText(q.c.toFixed(q.key === "human" ? 2 : 3), x0 + s / 2, y0 - (mobile ? 8 : hasCI ? 22 : 12));
        if (hasCI) { ctx.font = `9px ${MONO}`; ctx.fillStyle = `rgba(${OK},0.9)`; ctx.fillText(`[${q.lo!.toFixed(3)}, ${q.hi!.toFixed(3)}]`, x0 + s / 2, y0 - 8); }
        ctx.font = `${mobile ? 8 : 9}px ${MONO}`;
        if (!mobile) {
          /* in-square labels carry a small plate so the point field never fights them */
          const plate = (txt: string, tx: number, ty: number, align: CanvasTextAlign) => {
            const tw = ctx.measureText(txt).width; const px = align === "left" ? tx - 3 : tx - tw - 3;
            ctx.fillStyle = `rgba(${dark ? "5,5,7" : "244,243,238"},0.78)`; ctx.fillRect(px, ty - 9, tw + 6, 12);
            ctx.fillStyle = `rgba(${INK},0.85)`; ctx.textAlign = align; ctx.fillText(txt, tx, ty);
          };
          plate(`${q.a} ${Math.round(q.pA * 100)}%`, x0 + 5, y0 + 12, "left");
          plate(`${q.b} ${Math.round(q.pB * 100)}%`, x0 + s - 5, y0 + s - hb - 5, "right");
        }
        ctx.textAlign = "center"; ctx.fillStyle = `rgba(${INK},0.92)`;
        ctx.fillText(mobile ? q.short : q.name, x0 + s / 2, y0 + s + (mobile ? 12 : 16));
        ctx.fillStyle = `rgba(${INK},0.6)`;
        ctx.fillText(mobile ? `${(q.pBoth * 100).toFixed(1)}% vs ${(q.pA * q.pB * 100).toFixed(1)}%` : `both ${(q.pBoth * 100).toFixed(1)}% · indep. ${(q.pA * q.pB * 100).toFixed(1)}%`, x0 + s / 2, y0 + s + (mobile ? 24 : 30));
        if (!mobile) ctx.fillText(q.sub, x0 + s / 2, y0 + s + 43);
      });
      setReady(true);
    });
    return () => { alive = false; };
  }, [w, h, squares, dark]);
  return <canvas ref={ref} className="wscene" data-ready={String(ready)} style={{ width: w, height: h }} aria-label="Squares of objects: the both-miss cell against the outline independence predicts, one point per object where counts exist" />;
}

export function SameHazard() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, d: null };
    const [H5, MD, H3, P, R, H6] = await Promise.all([F.H5, F.MD, F.H3, F.P, F.R, F.H6].map((p) => fetchLaneText(p).catch(() => null)));
    const h5 = H5 ? parseH5(H5.text) : null;
    return {
      lane,
      d: {
        h5: h5 && H5 ? { ...h5, file: H5.file } : null,
        bounds: MD ? { items: parseH5Bounds(MD.text), file: MD.file } : null,
        h3: H3 ? { ...parseH3(H3.text), file: H3.file } : null,
        pair: P ? { row: parsePairRow(P.text, "megvii", "0.30"), file: P.file } : null,
        reg: R ? { ...parseRegister(R.text), file: R.file } : null,
        h6: H6 ? (() => { const v = parseH6(H6.text); return v ? { ...v, file: H6.file } : null; })() : null,
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
  if (pr && d.pair) squares.push({ key: "auto", name: "AUTOMATION · camera × lidar", short: "AUTOMATION", sub: "Result P · nuScenes · marginal", a: "camera miss", b: "lidar miss", pA: pr.pA, pB: pr.pB, pBoth: pr.pBoth, c: pr.c, file: d.pair.file });
  if (h3all && d.h3) squares.push({ key: "human", name: "HUMAN · looking × acting", short: "HUMAN", sub: `H3 · 100-Car · ${h3all.n} conflicts`, a: "not looking", b: "not reacting", pA: h3all.pObs / 100, pB: h3all.pResp / 100, pBoth: h3all.pBoth / 100, c: h3all.c, file: d.h3.file });
  squares.push({ key: "joint", name: "HUMAN × AUTO · detectable", short: "DETECTABLE", sub: `H5 · BDD-A · ${thou(h5.objects)} objects`, a: "auto miss", b: "human miss", pA: h5.pAuto / 100, pB: h5.pHum / 100, pBoth: h5.pBoth / 100, c: h5.c, file: h5.file, counts: h5.counts });
  const h6 = d.h6;
  if (h6) squares.push({ key: "total", name: "HUMAN × AUTO · total miss", short: "TOTAL MISS", sub: `H6 · BDD-A · ${thou(h6.objects)} objects`, a: "auto blind", b: "human miss", pA: h6.pAuto / 100, pB: h6.pHum / 100, pBoth: h6.pBoth / 100, c: h6.c, file: h6.file, counts: h6.counts, lo: h6.lo, hi: h6.hi });

  const art = box.w > 0 ? <SquaresScene w={box.w} h={box.h} squares={squares} /> : null;

  return (
    <Station id="ST–14" name="The Same Hazard" sub="human × automation on one object · BDD-A · proposed · descriptive · a lower bound">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="total miss · c" value={d.h6 ? fmt(d.h6.c) : "∅"} sub={d.h6 ? `[${fmt(d.h6.lo)}, ${fmt(d.h6.hi)}] · ${thou(d.h6.objects)} reference objects · ${d.h6.verdict}` : "H6 not present"}
            rule="H6: P(both miss) over P(deployed automation totally misses a present object) × P(human misses); reference objects from a strong detector at score ≥ 0.6, deployed SSDLite at ≥ 0.25, a miss is no box at IoU ≥ 0.5; clip-clustered bootstrap interval over 96 clips" from={d.h6 ? [src(d.h6.file)] : []} />
          <Stat label="detectable · c" value={fmt(h5.c)} sub={`${thou(h5.objects)} objects · ${h5.clips} clips · ${h5.frames} frames · no interval`}
            rule={`H5: P(both miss) over P(automation miss) × P(human miss); automation miss = detector score below ${h5.tau}; human miss = mean gaze attention inside the box below the per-run median (${h5.median}); object set = detections at score ≥ 0.3 in eight driving classes; descriptive, not clustered`} from={[src(h5.file)]} />
          <Stat label="register · joint-silent-miss" value={joint ? joint.status : "∅"} sub={joint && d.reg ? `use ${joint.current_scientific_use} · register 2026-08-29 · H5 measures ${fmt(h5.c)} · neither upgraded` : "register absent"}
            rule="the claim-status register's state for the joint-silent-miss claim; the instrument shows the register's state beside the transcript's number and upgrades neither; a newer transcript does not change a register entry" from={d.reg ? [src(d.reg.file), src(h5.file)] : [src(h5.file)]} />
        </div>

        <div className="shzgrid">
          <div className="ipanel wspanel shzhero">
            <div className="ilabel">the squares · one point per object where the transcript counts them · red is the joint miss · the outline is what independence predicts · same-kind overflows, different-kind fits</div>
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
        <div className="mnon">{[h5.nonclaims, d.h6?.nonclaims].filter(Boolean).join(" · ")} · <Digest id={src(h5.file).id} sha={src(h5.file).sha256} path={src(h5.file).path} />{d.h6 && <> <Digest id={src(d.h6.file).id} sha={src(d.h6.file).sha256} path={src(d.h6.file).path} /></>}</div>
      </div>
    </Station>
  );
}
