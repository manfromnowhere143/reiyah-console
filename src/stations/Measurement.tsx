/* ST-11 · THE MEASUREMENT — the Gate B lane, read as a second source and
   never blended with the Gate A packet. The engine's first application of
   its contracts to public data: do a camera detector and a lidar detector
   miss the same objects more than independence predicts? Every figure here
   is parsed from a retained transcript with a strict pattern and carries that
   transcript's digest; the lane's own status register is rendered verbatim,
   withdrawn claims shown as withdrawn. Proposed, not externally audited,
   association after declared conditioning, never causation. */
import { useLayoutEffect, useRef, useState } from "react";
import { fetchLane, fetchLaneText, parseConvergence, parseEValues, parseGrid, parseOpposite, parseRegister, parseSweep, type LaneFile } from "../lib/gateb";
import { Blocked, Digest, FitList, Stat, Station, useSurfaceState } from "../components/primitives";

const P = {
  L: "evidence/measurement/result_l.txt", N: "evidence/measurement/result_n.txt", O: "evidence/measurement/result_o.txt",
  P: "evidence/measurement/result_p.txt", Q: "evidence/measurement/result_q.txt", R: "evidence/claim-status-register-2026-08-29.json",
};
const src = (f: LaneFile) => ({ id: `gateb/${f.id}`, path: `gate-b · ${f.path}`, sha256: f.sha256 ?? "" });
const fmt = (x: number) => x.toFixed(3);

/* a chart box that reports its own pixel size, so the SVG draws in pixels and
   nothing is ever stretched: text stays text */
function useBox(key: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  /* re-attach whenever the box can have (re)appeared: the station mounts in
     its loading state first, and the boxes exist only once data arrives */
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const m = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSz({ w: Math.round(r.width), h: Math.round(r.height) }); };
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, [key]);
  return { ref, ...sz };
}

export function Measurement() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, data: null };
    const [L, N, O, Pp, Q, R] = await Promise.all([P.L, P.N, P.O, P.P, P.Q, P.R].map((p) => fetchLaneText(p).catch(() => null)));
    return {
      lane,
      data: {
        conv: L ? { ...parseConvergence(L.text), file: L.file } : null,
        sweep: N ? { pairs: parseSweep(N.text), file: N.file } : null,
        ev: O ? { rows: parseEValues(O.text), file: O.file } : null,
        opp: Pp ? { rows: parseOpposite(Pp.text), file: Pp.file } : null,
        grid: Q ? { cells: parseGrid(Q.text), file: Q.file } : null,
        reg: R ? { ...parseRegister(R.text), file: R.file } : null,
      },
    };
  });
  const cbox = useBox(state.phase);
  const sbox = useBox(state.phase);
  if (state.phase === "loading") return <Station id="ST–11" name="The Measurement"><div className="note">reading the measurement lane…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–11" name="The Measurement"><Blocked reason={state.reason} /></Station>;
  const { lane, data } = state.data;
  if (!lane.present || !data) return <Station id="ST–11" name="The Measurement"><Blocked reason={`the Gate B measurement lane is not present in this source: ${lane.reason ?? "unknown"}`} /></Station>;

  const id = lane.identity!;
  const conv = data.conv && data.conv.rows.length >= 2 ? data.conv : null;
  const terminal = conv ? conv.rows[conv.rows.length - 1] : null;
  const sweep = data.sweep && data.sweep.pairs.length ? data.sweep : null;
  const sweepRows = sweep ? sweep.pairs.flatMap((p) => p.rows) : [];
  const exclN = sweepRows.filter((r) => r.excl).length;
  const ev = data.ev && data.ev.rows.length ? data.ev : null;
  const grid = data.grid && data.grid.cells.length ? data.grid : null;
  const reg = data.reg && data.reg.claims.length ? data.reg : null;
  const opp = data.opp && data.opp.rows.length ? data.opp : null;
  const statusCounts = new Map<string, number>();
  for (const c of reg?.claims ?? []) statusCounts.set(c.status, (statusCounts.get(c.status) ?? 0) + 1);

  /* ---- the convergence chart: c by conditioning level, with intervals ---- */
  const convSvg = conv && cbox.w > 0 ? (() => {
    const rows = [...conv.rows, ...(conv.mediator ? [{ level: "L6", label: "+ lidar point count · inadmissible", strata: 0, n: 0, ...conv.mediator }] : [])];
    const W = cbox.w, H = cbox.h, padL = 12, padR = 14, top = 22, bottom = 26;
    const ymin = 0.95, ymax = Math.max(...rows.map((r) => r.hi)) + 0.05;
    const y = (v: number) => top + (H - top - bottom) * (1 - (v - ymin) / (ymax - ymin));
    const x = (i: number) => padL + ((W - padL - padR) * i) / Math.max(1, rows.length - 1);
    const y1 = y(1);
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart" aria-label="Conditional coefficient by conditioning level with 95% intervals">
        <line x1={padL} x2={W - padR} y1={y1} y2={y1} className="mind" />
        <text x={W - padR} y={y1 - 5} className="mlab" textAnchor="end">independence 1.0</text>
        <polyline points={conv.rows.map((r, i) => `${x(i)},${y(r.c)}`).join(" ")} className="mline" />
        {rows.map((r, i) => (
          <g key={r.level} className={r.level === "L6" ? "mpt inad" : "mpt"}>
            <line x1={x(i)} x2={x(i)} y1={y(r.lo)} y2={y(r.hi)} className="mci" />
            <circle cx={x(i)} cy={y(r.c)} r={4} className="mdot" />
            <text x={x(i)} y={H - 8} className="mlab" textAnchor="middle">{r.level}</text>
            {(i === rows.length - 1 || r.level === "L5" || i === 0) && <text x={x(i)} y={y(r.hi) - 7} className="mval" textAnchor="middle">{fmt(r.c)}</text>}
          </g>
        ))}
      </svg>
    );
  })() : null;

  /* ---- the sweep: conditional c across thresholds, both pairs ---- */
  const sweepSvg = sweep && sbox.w > 0 ? (() => {
    const W = sbox.w, H = sbox.h, padL = 12, padR = 14, top = 20, bottom = 22;
    const all = sweep.pairs.flatMap((p) => p.rows);
    const ymin = 0.95, ymax = Math.max(...all.map((r) => r.hi)) + 0.04;
    const thrs = [...new Set(all.map((r) => r.thr))].sort((a, b) => a - b);
    const y = (v: number) => top + (H - top - bottom) * (1 - (v - ymin) / (ymax - ymin));
    const x = (t: number) => padL + ((W - padL - padR) * (t - thrs[0])) / Math.max(1e-9, thrs[thrs.length - 1] - thrs[0]);
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart" aria-label="Conditional coefficient across score thresholds for both detector pairs">
        <line x1={padL} x2={W - padR} y1={y(1)} y2={y(1)} className="mind" />
        {sweep.pairs.map((p, k) => {
          const f = p.rows[0];
          return (
            <g key={p.b} className={`mser s${k}`}>
              <polygon points={[...p.rows.map((r) => `${x(r.thr)},${y(r.hi)}`), ...[...p.rows].reverse().map((r) => `${x(r.thr)},${y(r.lo)}`)].join(" ")} className="mband" />
              <polyline points={p.rows.map((r) => `${x(r.thr)},${y(r.c)}`).join(" ")} className="mline" />
              {p.rows.map((r) => <circle key={r.thr} cx={x(r.thr)} cy={y(r.c)} r={3} className="mdot" />)}
              <text x={x(f.thr) + 8} y={y(f.c) + (k === 0 ? -8 : 13)} className="mval" textAnchor="start">{p.b} · {fmt(f.c)} → {fmt(p.rows[p.rows.length - 1].c)}</text>
            </g>
          );
        })}
        {thrs.map((t, i) => <text key={t} x={x(t)} y={H - 6} className="mlab" textAnchor={i === 0 ? "start" : i === thrs.length - 1 ? "end" : "middle"}>{i === 0 ? "score ≥ " : ""}{t.toFixed(1)}</text>)}
      </svg>
    );
  })() : null;

  return (
    <Station id="ST–11" name="The Measurement" sub="gate b · a second source, never blended · proposed · not externally audited">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="coefficient · conditional" value={terminal ? <>{fmt(terminal.c)}<em> [{fmt(terminal.lo)}, {fmt(terminal.hi)}]</em></> : "∅"} sub={terminal ? `${terminal.label} · ${terminal.strata} strata · ${terminal.n.toLocaleString()} objects` : "transcript not recognized"}
            rule="the terminal row of Result L's common-support table: joint-miss rate over what independence predicts, within strata of class, range, visibility, weather and motion; 95% interval from an instance-clustered bootstrap" from={conv ? [src(conv.file)] : []} />
          <Stat label="thresholds excluding 1.0" value={sweep ? <>{exclN}<em>/{sweepRows.length}</em></> : "∅"} sub="score 0.1 to 0.5 · both lidar pairs"
            rule="count of rows in Result N's two pair tables whose conditional interval excludes 1.0, over all rows" from={sweep ? [src(sweep.file)] : []} />
          <Stat label="e-value" value={ev ? fmt(ev.rows[0].e).replace(/0+$/, "").replace(/\.$/, "") : "∅"} sub={ev ? ev.rows.map((r) => `${r.b} ${r.e}`).join(" · ") : "transcript not recognized"}
            rule="Result O: the minimum risk-ratio association an unmeasured common cause would need with both camera and lidar failure, beyond the five measured covariates, to explain the coupling away" from={ev ? [src(ev.file)] : []} />
          <Stat label="claims register" value={reg ? reg.claims.length : "∅"} sub={reg ? [...statusCounts.entries()].map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(" · ") : "absent"}
            rule="every claim in the lane's claim-status register with its status field, read verbatim; the policy forbids deletion and requires prose to match the register" from={reg ? [src(reg.file)] : []} />
          <Stat label="lane" value="PROPOSED" small sub={`${id.branch} · ${id.head.slice(0, 10)} · ${id.commit_count} commits · ${id.worktree_clean ? "clean" : "dirty"}`}
            rule="the lane's git identity at seal or read time, and its own non-claims: no operator acceptance, no scientific support claimed, not externally audited, no model executed by this lane" from={[]} />
        </div>

        <div className="mgrid">
          <div className="ipanel mpanel">
            <div className="ilabel">the convergence · conditional coefficient as confounders are added · Result L{conv?.mediator ? " · L6: the mediator error, deliberate, inadmissible" : ""}</div>
            <div className="mbox" ref={cbox.ref}>{convSvg ?? <div className="note">Result L transcript not present or not in its known shape</div>}</div>
            {conv && <div className="msrc"><span>{conv.file.path}</span><Digest id={src(conv.file).id} sha={src(conv.file).sha256} path={src(conv.file).path} /></div>}
          </div>
          <div className="mcol">
            <div className="ipanel mpanel">
              <div className="ilabel">the sweep · conditional coefficient by score threshold · Result N</div>
              <div className="mbox" ref={sbox.ref}>{sweepSvg ?? <div className="note">Result N transcript not present or not in its known shape</div>}</div>
              {sweep && <div className="msrc"><span>{sweep.file.path}</span><Digest id={src(sweep.file).id} sha={src(sweep.file).sha256} path={src(sweep.file).path} /></div>}
            </div>
            <div className="ipanel mpanel">
              <div className="ilabel">the modality grid · six detector pairs on one common support · Result Q</div>
              {grid ? (
                <div className="mcells">
                  {grid.cells.map((c) => (
                    <div key={`${c.a}${c.b}`} className="mcell2" data-kind={c.kind.startsWith("same") ? "same" : "cross"} style={{ ["--m" as any]: Math.min(1, Math.max(0, (c.c - 1) / 0.35)).toFixed(3) }} title={`${c.a} × ${c.b} · ${c.kind} · ${fmt(c.c)} [${fmt(c.lo)}, ${fmt(c.hi)}]`}>
                      <b>{fmt(c.c)}</b>
                      <span>{c.a}({c.am}) × {c.b}({c.bm})</span>
                      <i>{c.kind}</i>
                    </div>
                  ))}
                </div>
              ) : <div className="note">Result Q transcript not present or not in its known shape</div>}
            </div>
          </div>
          <div className="ipanel mpanel fillpanel">
            <div className="ilabel">the claims register · every status verbatim · withdrawn stays withdrawn</div>
            {reg ? (
              <FitList items={reg.claims} render={(c) => (
                <div key={c.claim_id} className="mclaim" data-s={c.status} data-use={c.current_scientific_use}>
                  <span className="mcs">{c.status.replace(/_/g, " ")}</span>
                  <span className="mcn">{c.claim_id.replace("reiyah.gate-b.claim.", "").replace(/-/g, " ")}</span>
                  <span className="mcu">{c.current_scientific_use}</span>
                </div>
              )} more={(k) => <>+ {k} more claims in the register</>} />
            ) : <div className="note">register not present</div>}
            {opp && (
              <div className="mopp">
                <span className="cvl">result p</span>
                {opp.rows.map((r) => <span key={r.pair} className="moppr">{r.pair}: c {fmt(r.c0)} → {fmt(r.c1)} while P(both) {r.p0} → {r.p1}</span>)}
                <span className="moppk">the coefficient is smallest where the sensors jointly miss the most</span>
              </div>
            )}
          </div>
        </div>
        <div className="mnon">association after declared conditioning, not causation · one public split, nuScenes val · predictions published by their authors, no model executed by this lane · proposed · no operator acceptance · no scientific support claimed · not externally audited</div>
      </div>
    </Station>
  );
}
