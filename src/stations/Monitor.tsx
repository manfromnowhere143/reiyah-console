/* ST-16 · THE MONITOR — from measuring joint failure to reading it live.
   The lane fitted an estimator that reads only the channels' outputs and
   returns a coupling-corrected risk of joint failure, then asked the hard
   questions: does it hold on held-out data (V), on juries and benchmarks it
   never saw (X), after a label-free normalization (X2), and does the same
   idea work for two sensors, at the scene (Z, AB) and at the object (AA).
   Every figure is parsed from a retained transcript and carries its digest;
   every claim is shown under the newest register's own status, including
   the inconclusive ones; the lane's non-claims are verbatim. */
import { useLayoutEffect, useRef, useState } from "react";
import { claimShort, fetchLane, fetchLaneText, parseAAcv, parseAB, parseRegister, parseV, parseX, parseZcv, registerPath, type LaneFile } from "../lib/gateb";
import { Blocked, Digest, FitList, Stat, Station, useSurfaceState } from "../components/primitives";

const F = {
  V: "llm-generalization/evidence/result_v.txt", X: "llm-generalization/evidence/result_x.txt", X2: "llm-generalization/evidence/result_x2.txt",
  Z: "evidence/measurement/result_z.txt", AA: "evidence/measurement/result_aa.txt", AB: "evidence/measurement/result_ab.txt",
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

export function Monitor() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, d: null };
    const [V, X, X2, Z, AA, AB, R] = await Promise.all([F.V, F.X, F.X2, F.Z, F.AA, F.AB, await registerPath()].map((p) => fetchLaneText(p).catch(() => null)));
    return {
      lane,
      d: {
        v: V ? (() => { const v = parseV(V.text); return v ? { ...v, file: V.file } : null; })() : null,
        x: X ? (() => { const v = parseX(X.text); return v ? { ...v, file: X.file } : null; })() : null,
        x2: X2 ? (() => { const v = parseX(X2.text); return v ? { ...v, file: X2.file } : null; })() : null,
        z: Z ? { rows: parseZcv(Z.text), file: Z.file } : null,
        aa: AA ? { rows: parseAAcv(AA.text), file: AA.file } : null,
        ab: AB ? { sections: parseAB(AB.text), file: AB.file } : null,
        reg: R ? { ...parseRegister(R.text), file: R.file } : null,
      },
    };
  });
  const mbox = useBox(state.phase);
  if (state.phase === "loading") return <Station id="ST–16" name="The Monitor"><div className="note">reading the monitors…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–16" name="The Monitor"><Blocked reason={state.reason} /></Station>;
  const { lane, d } = state.data;
  if (!lane.present || !d) return <Station id="ST–16" name="The Monitor"><Blocked reason={`the Gate B lane is not present in this source: ${lane.reason ?? "unknown"}`} /></Station>;
  const { v, x, x2, z, aa, ab, reg } = d;
  const claim = (re: RegExp) => reg?.claims.find((c) => re.test(c.claim_id)) ?? null;
  const cV = claim(/llm-monitor-in-domain/), cX = claim(/llm-monitor-transfer/), cZ = claim(/sensor-scene-blindness-monitor/), cAA = claim(/sensor-disagreement-realness/);
  const regClaims = reg ? reg.claims.filter((c) => /monitor|disagreement/.test(c.claim_id)) : [];

  /* ---- the reliability of the in-domain monitor: predicted against actual, held out ---- */
  const mon = v && mbox.w > 0 ? (() => {
    const W = mbox.w, H = mbox.h, mobile = W < 560, top = 16, bottom = H - 24, left = 36, right = W - 14;
    const xx = (p: number) => left + ((right - left) * p) / 100, yy = (p: number) => bottom - ((bottom - top) * p) / 100;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart monitor" aria-label="Predicted risk against actual wrong rate on held-out data">
        <line x1={xx(0)} y1={yy(0)} x2={xx(100)} y2={yy(100)} className="mondiag" />
        <line x1={xx(0)} x2={xx(100)} y1={bottom} y2={bottom} className="monax" /><line x1={left} x2={left} y1={top} y2={bottom} className="monax" />
        {[0, 25, 50, 75, 100].map((p) => <g key={p}><text x={xx(p)} y={bottom + 12} className="mlab dim" textAnchor="middle">{p}%</text><text x={left - 5} y={yy(p) + 3} className="mlab dim" textAnchor="end">{p}%</text></g>)}
        <text x={xx(50)} y={H - 2} className="mlab" textAnchor="middle">predicted risk of joint failure, read from the outputs alone</text>
        <text x={12} y={yy(50)} className="mlab" textAnchor="middle" transform={`rotate(-90 12 ${yy(50)})`}>actual wrong rate</text>
        {v.bands.map((b) => <g key={b.band} className="mser s0"><circle cx={xx(b.predicted)} cy={yy(b.actual)} r={mobile ? 4 : 5} className="mdot" />{!mobile && b.band >= 3 && <text x={xx(b.predicted) + 8} y={yy(b.actual) - 6} className="mlab" textAnchor="start">band {b.band} · n {b.n}</text>}</g>)}
        <g className="monnaive"><circle cx={xx(v.unanimousNaive)} cy={yy(v.unanimousActual)} r={6} /><text x={xx(v.unanimousNaive) + 14} y={yy(v.unanimousActual) - 18} className="mlab" textAnchor="start">the naive rule on unanimous items · says {v.unanimousNaive.toFixed(0)}% · actually wrong {v.unanimousActual.toFixed(1)}%</text></g>
        <g className="mser s0"><circle cx={xx(v.unanimousMonitor)} cy={yy(v.unanimousActual)} r={mobile ? 4 : 5} className="mdot" /><text x={xx(v.unanimousMonitor) + 10} y={yy(v.unanimousActual) + 16} className="mlab" textAnchor="start">the monitor on the same items · {v.unanimousMonitor.toFixed(1)}%</text></g>
      </svg>
    );
  })() : null;

  const transfer = [...(x?.blocks ?? []), ...(x2?.blocks ?? [])];
  const zRow = (rows: { name: string; a: number; aSd: number; c: number; cSd: number }[], k: string) => rows.find((r) => r.name === k);
  const sensorRows: Array<{ pair: string; tool: "z" | "aa"; rows: ReturnType<typeof parseZcv> }> = [
    ...(z ? [{ pair: "P1 Mapillary × Megvii", tool: "z" as const, rows: z.rows }] : []),
    ...(aa ? [{ pair: "P1 Mapillary × Megvii", tool: "aa" as const, rows: aa.rows }] : []),
    ...(ab?.sections ?? []),
  ];

  return (
    <Station id="ST–16" name="The Monitor" sub="from measuring joint failure to reading it live · every claim under the register's status · proposed">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="in-domain monitor · AUC" value={v ? <>{fmt(v.monitor.auc)}<em> vs naive {fmt(v.naive.auc)}</em></> : "∅"} sub={v ? `Brier ${fmt(v.monitor.brier)} vs ${fmt(v.naive.brier)} · ECE ${fmt(v.monitor.ece)} vs ${fmt(v.naive.ece)} · held-out ${v.test.toLocaleString("en-US")} · register ${cV?.status ?? "∅"}, ${cV?.current_scientific_use ?? "∅"}` : "Result V absent"}
            rule="Result V: a coupling-aware, calibrated estimator fitted on a train split and read on held-out MMLU items, against the ensemble's own implicit rule that risk is one minus agreement" from={v ? [src(v.file)] : []} />
          <Stat label="transfer · unseen jury" value={x ? fmt(x.blocks.find((b) => b.id === "X1")?.monitor.auc) : "∅"} sub={x ? `unseen benchmark ${fmt(x.blocks.find((b) => b.id === "X3")?.monitor.auc)} vs naive ${fmt(x.blocks.find((b) => b.id === "X3")?.naive.auc)} · transfers across juries, not across tasks · register ${cX?.status ?? "∅"}, ${cX?.current_scientific_use ?? "∅"}` : "Result X absent"}
            rule="Result X: the monitor fitted once on jury A and MMLU, read without refitting on a jury of unseen families (X1) and on an unseen benchmark (X3); the in-domain ceiling is a refit on the target's own split" from={x ? [src(x.file)] : []} />
          <Stat label="two sensors · scene monitor" value={z ? <>{fmt(zRow(z.rows, "monitor")?.a)}<em> vs density {fmt(zRow(z.rows, "proportional")?.a)}</em></> : "∅"} small sub={z ? `Spearman, five-fold over scenes · does not beat the density baseline · register ${cZ?.status ?? "∅"} · per-object realness AUC ${fmt(zRow(aa?.rows ?? [], "own features")?.a)}, context adds ${(() => { const a = zRow(aa?.rows ?? [], "own + context")?.a, b = zRow(aa?.rows ?? [], "own features")?.a; return a !== undefined && b !== undefined ? fmt(a - b, 3) : "∅ · comparison not present"; })()} · ${cAA?.status ?? "∅"}` : "Result Z absent"}
            rule="Results Z and AA on nuScenes val: a Poisson monitor of joint misses per keyframe against a proportional-to-object-count baseline (Spearman, five-fold grouped by scene), and a per-object logistic monitor of whether a single-channel detection is real (AUC) with and without cross-channel context" from={[...(z ? [src(z.file)] : []), ...(aa ? [src(aa.file)] : [])]} />
        </div>
        <div className="mongrid">
          <div className="ipanel wspanel">
            <div className="ilabel">the reliability · predicted risk against actual, held out · Result V · the naive rule calls unanimity certainty</div>
            <div className="mbox" ref={mbox.ref}>{mon ?? <div className="note">Result V not present or not in its known shape</div>}</div>
          </div>
          <div className="monside">
            <div className="ipanel wspanel fillpanel">
              <div className="ilabel">transfer · fitted once, read where it never trained · Results X and X2 · AUC naive → monitor (ceiling)</div>
              <FitList items={transfer} render={(b) => (
                <div key={b.id} className="bar monrow" data-hold={String(b.monitor.auc - b.naive.auc > 0.05)}>
                  <span className="bk">{b.id} · {b.title.replace(/jury /g, "").replace("five-model subset of", "5 of").replace("five of", "5 of")}</span>
                  <span className="bt monbt">
                    <span className="bf monnaive" style={{ width: `${(b.naive.auc - 0.5) / 0.5 * 100}%` }} />
                    <span className="bf monmon" style={{ width: `${(b.monitor.auc - 0.5) / 0.5 * 100}%` }} />
                    <i className="moncap" style={{ left: `${(b.ceiling - 0.5) / 0.5 * 100}%` }} />
                  </span>
                  <span className="bn">{fmt(b.naive.auc, 2)} → <b>{fmt(b.monitor.auc, 2)}</b><em> ({fmt(b.ceiling, 2)})</em></span>
                </div>
              )} more={(k) => <>+ {k} more transfer reads</>} />
            </div>
            <div className="ipanel wspanel fillpanel">
              <div className="ilabel">two sensors · scene monitor vs density, per-object realness · Results Z, AA and their replication AB</div>
              <FitList items={sensorRows} render={(s, i) => {
                const m = s.tool === "z" ? zRow(s.rows, "monitor") : zRow(s.rows, "own + context");
                const b = s.tool === "z" ? zRow(s.rows, "proportional") : zRow(s.rows, "score alone");
                const mv = m?.a, bv = b?.a;
                return (
                  <div key={i} className="bar monrow" data-hold={String((mv ?? 0) - (bv ?? 0) > 0.03)}>
                    <span className="bk">{s.pair} · {s.tool === "z" ? "scene · Spearman" : "object · AUC"}</span>
                    <span className="bt monbt">
                      <span className="bf monnaive" style={{ width: `${((bv ?? 0) - 0.4) / 0.6 * 100}%` }} />
                      <span className="bf monmon" style={{ width: `${((mv ?? 0) - 0.4) / 0.6 * 100}%` }} />
                    </span>
                    <span className="bn">{s.tool === "z" ? "density" : "score"} {fmt(bv, 2)} → <b>{fmt(mv, 2)}</b></span>
                  </div>
                );
              }} more={(k) => <>+ {k} more sensor reads</>} />
            </div>
          </div>
        </div>
        <div className="wsreg regrow">
          <span className="cvl">register</span>
          <span className="wsregv">{reg ? <>register <b>{reg.version}</b> of {reg.createdOn} · the monitor claims, in the register's words; inconclusive stays inconclusive:</> : "register absent"}</span>
          {reg && <Digest id={src(reg.file).id} sha={src(reg.file).sha256} path={src(reg.file).path} />}
          <span className="regchips">{regClaims.map((c) => <span key={c.claim_id} className="regchip" data-status={c.status} data-use={c.current_scientific_use} title={c.estimand}>{claimShort(c.claim_id)}<b>{c.status.replace(/_/g, " ")}</b>{c.current_scientific_use !== "permitted" && <i>{c.current_scientific_use}</i>}</span>)}</span>
        </div>
        <div className="mnon">{[v?.nonclaims, x?.nonclaims].filter(Boolean).join(" · ")} {v && <Digest id={src(v.file).id} sha={src(v.file).sha256} path={src(v.file).path} />} {x && <Digest id={src(x.file).id} sha={src(x.file).sha256} path={src(x.file).path} />} {z && <Digest id={src(z.file).id} sha={src(z.file).sha256} path={src(z.file).path} />} {aa && <Digest id={src(aa.file).id} sha={src(aa.file).sha256} path={src(aa.file).path} />}</div>
      </div>
    </Station>
  );
}
