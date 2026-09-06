/* ST-13 · THE WINDSHIELD — both sides. The automation side measured that a
   camera and a lidar miss the same objects more than independence allows.
   The human side, from naturalistic driving, measured that the driver's
   two channels, looking and acting, fail together the same way, and that
   eyes on the road at the moment of the conflict did not mean the hazard was
   seen. One windshield, two coefficients above the same independence line.
   Every figure is parsed from a retained transcript by a strict pattern and
   carries its digest; the lane's non-claims are rendered verbatim: descriptive,
   proposed, not causal, not a safety determination, not driver-clustered. */
import { useLayoutEffect, useRef, useState } from "react";
import { fetchLane, fetchLaneText, parseConvergence, parseH1, parseH2, parseH3, parseH4, parseRegister, type LaneFile } from "../lib/gateb";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const F = {
  L: "evidence/measurement/result_l.txt",
  H1: "human-channel/evidence/h1_driver_observation.txt", H2: "human-channel/evidence/h2_glance_at_conflict.txt",
  H3: "human-channel/evidence/h3_observation_response_joint.txt", H4: "human-channel/evidence/h4_dcpt_takeover.txt",
  S: "evidence/measurement/result_s.txt", R: "evidence/claim-status-register-2026-08-29.json",
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

export function Windshield() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, d: null };
    const [L, H1, H2, H3, H4, S, R] = await Promise.all([F.L, F.H1, F.H2, F.H3, F.H4, F.S, F.R].map((p) => fetchLaneText(p).catch(() => null)));
    return {
      lane,
      d: {
        auto: L ? { ...parseConvergence(L.text), file: L.file } : null,
        h1: H1 ? { ...parseH1(H1.text), file: H1.file } : null,
        h2: H2 ? { ...parseH2(H2.text), file: H2.file } : null,
        h3: H3 ? { ...parseH3(H3.text), file: H3.file } : null,
        h4: H4 ? { ...parseH4(H4.text), file: H4.file } : null,
        s: S ? { present: true, file: S.file, headline: /understated by a factor of\s*\n?\s*sqrt\(([\d.]+)\) = ([\d.]+)/.exec(S.text) } : null,
        reg: R ? { ...parseRegister(R.text), file: R.file } : null,
      },
    };
  });
  const wbox = useBox(state.phase);
  const tbox = useBox(state.phase);
  if (state.phase === "loading") return <Station id="ST–13" name="The Windshield"><div className="note">reading both sides…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–13" name="The Windshield"><Blocked reason={state.reason} /></Station>;
  const { lane, d } = state.data;
  if (!lane.present || !d) return <Station id="ST–13" name="The Windshield"><Blocked reason={`the Gate B lane is not present in this source: ${lane.reason ?? "unknown"}`} /></Station>;

  const autoT = d.auto && d.auto.rows.length ? d.auto.rows[d.auto.rows.length - 1] : null;
  const h3 = d.h3 && d.h3.groups.length ? d.h3 : null;
  const h3all = h3?.groups.find((g) => g.name === "all events") ?? null;
  const h3cr = h3?.groups.find((g) => g.name === "crashes") ?? null;
  const h1 = d.h1 && d.h1.groups.length && d.h1.baseline ? d.h1 : null;
  const h2 = d.h2 && d.h2.groups.length ? d.h2 : null;
  const h4 = d.h4 && d.h4.grouped.length >= 3 ? d.h4 : null;
  const h4base = h4?.grouped.find((g) => g.name.startsWith("no task"));
  const h4vm = h4?.grouped.find((g) => g.name.startsWith("visual-manual"));
  const h4cog = h4?.grouped.find((g) => g.name.startsWith("cognitive"));

  /* ---- the windshield: two gauges above one independence line ---- */
  const wind = wbox.w > 0 && (autoT || h3all) ? (() => {
    const W = wbox.w, H = wbox.h, top = 30, bottom = H - 34;
    const ymin = 0.9, ymax = 1.75;
    const y = (v: number) => bottom - (bottom - top) * ((Math.min(ymax, Math.max(ymin, v)) - ymin) / (ymax - ymin));
    const mobile = W < 560;
    const cx = W / 2, xa = W * 0.2, xh = W * 0.5, xj = W * 0.8;
    const glass = `M ${W * 0.04} ${bottom + 10} L ${W * 0.16} ${top - 18} L ${W * 0.84} ${top - 18} L ${W * 0.96} ${bottom + 10} Z`;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart wind" aria-label="Two coefficients above the same independence line: automation and human">
        <path d={glass} className="wglass" />
        <line x1={(xa + xh) / 2} x2={(xa + xh) / 2} y1={top - 18} y2={bottom + 10} className="wsplit" />
        <line x1={(xh + xj) / 2} x2={(xh + xj) / 2} y1={top - 18} y2={bottom + 10} className="wsplit" />
        <line x1={W * 0.08} x2={W * 0.92} y1={y(1)} y2={y(1)} className="mind" />
        <text x={W * 0.08} y={y(1) - 5} className="mlab" textAnchor="start">independence 1.0</text>
        {autoT && (
          <g className="mser s0">
            <line x1={xa} x2={xa} y1={y(autoT.lo)} y2={y(autoT.hi)} className="mci" />
            <line x1={xa} x2={xa} y1={y(1)} y2={y(autoT.c)} className="wstem" />
            <circle cx={xa} cy={y(autoT.c)} r={mobile ? 6 : 8} className="mdot" />
            <text x={xa} y={y(autoT.hi) - 10} className="wbig" textAnchor="middle">{fmt(autoT.c)}</text>
            <text x={xa} y={bottom + 16} className="mlab" textAnchor="middle">{mobile ? "AUTOMATION" : "AUTOMATION · camera × lidar"}</text>
            {!mobile && <text x={xa} y={bottom + 28} className="mlab dim" textAnchor="middle">nuScenes val · 95% CI</text>}
          </g>
        )}
        {h3all && (
          <g className="mser s0">
            <line x1={xh} x2={xh} y1={y(1)} y2={y(h3all.c)} className="wstem" />
            <circle cx={xh} cy={y(h3all.c)} r={mobile ? 6 : 8} className="mdot" />
            <text x={xh} y={y(h3all.c) - 14} className="wbig" textAnchor="middle">{fmt(h3all.c, 2)}</text>
            <text x={xh} y={bottom + 16} className="mlab" textAnchor="middle">{mobile ? "HUMAN" : "HUMAN · looking × acting"}</text>
            {!mobile && <text x={xh} y={bottom + 28} className="mlab dim" textAnchor="middle">100-Car · no interval</text>}
          </g>
        )}
        {autoT && h3all && <path d={`M ${xa} ${y(autoT.c)} Q ${(xa + xh) / 2} ${Math.min(y(autoT.c), y(h3all.c)) - 28} ${xh} ${y(h3all.c)}`} className="warc" />}
        {/* the third pillar: human × automation on the same hazard. Not yet
            measured: drawn as the explicit unknown it is, never as a guess */}
        <g className="wunk">
          <line x1={xj} x2={xj} y1={y(1)} y2={top + 6} className="wunkstem" />
          <circle cx={xj} cy={top + 14} r={mobile ? 6 : 8} className="wunkdot" />
          <text x={xj} y={top + 14} className="wunkmark" textAnchor="middle" dominantBaseline="central">∅</text>
          <text x={xj} y={bottom + 16} className="mlab" textAnchor="middle">{mobile ? "HUMAN × AUTO" : "HUMAN × AUTOMATION"}</text>
          <text x={xj} y={bottom + 28} className="mlab dim" textAnchor="middle">not yet measured</text>
        </g>
        {!mobile && <text x={cx} y={top - 4} className="mlab" textAnchor="middle">the same signature on both sides · the meeting point still unmeasured</text>}
      </svg>
    );
  })() : null;

  /* ---- takeover by task: a dot-and-bar chart in pixels ---- */
  const take = h4 && tbox.w > 0 ? (() => {
    const W = tbox.w, H = tbox.h, rowH = Math.min(18, Math.max(12, (H - 22) / (h4.tasks.length + 1)));
    const lab = W < 560 ? 84 : 110, padR = 42;
    const lo = 1.5, hi = Math.max(...h4.tasks.map((t) => t.mean)) + 0.15;
    const x = (v: number) => lab + ((W - lab - padR) * (v - lo)) / (hi - lo);
    const rows = [...h4.tasks].sort((a, b) => a.mean - b.mean);
    const base = h4base?.mean ?? rows[0].mean;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mchart" aria-label="Takeover time by non-driving task">
        <line x1={x(base)} x2={x(base)} y1={4} y2={rows.length * rowH + 8} className="mind" />
        <text x={x(base)} y={rows.length * rowH + 18} className="mlab" textAnchor="middle">no task {fmt(base, 2)} s</text>
        {rows.map((t, i) => {
          const yy = 8 + i * rowH + rowH / 2;
          return (
            <g key={t.id} className="mser s0">
              <text x={2} y={yy + 3} className="mlab" textAnchor="start">{t.name}</text>
              <line x1={x(base)} x2={x(t.mean)} y1={yy} y2={yy} className="mci" />
              <circle cx={x(t.mean)} cy={yy} r={3} className="mdot" />
              <text x={x(t.mean) + 6} y={yy + 3} className="mval" textAnchor="start">{fmt(t.mean, 2)} s</text>
            </g>
          );
        })}
      </svg>
    );
  })() : null;

  const g1 = (n: string) => h1?.groups.find((g) => g.name === n);
  const g2 = (n: string) => h2?.groups.find((g) => g.name === n);

  return (
    <Station id="ST–13" name="The Windshield" sub="both sides · the human channel · proposed · descriptive">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="automation · c" value={autoT ? fmt(autoT.c) : "∅"} sub={autoT ? `camera × lidar · [${fmt(autoT.lo)}, ${fmt(autoT.hi)}]` : "transcript absent"}
            rule="the terminal conditional coefficient of Result L: joint-miss rate over independence within strata of class, range, visibility, weather and motion" from={d.auto ? [src(d.auto.file)] : []} />
          <Stat label="human · c" value={h3all ? fmt(h3all.c, 2) : "∅"} sub={h3all ? `looking × acting · ${h3all.n} conflicts · no interval` : "transcript absent"}
            rule="H3: P(both fail) over P(obs fail) × P(resp fail) across all events with known gaze and known reaction; obs fail = gaze not forward at the conflict instant, resp fail = no reaction; illustrative on counts, not an inferential test" from={h3 ? [src(h3.file)] : []} />
          <Stat label="looked forward, did nothing" value={h3cr ? `${fmt(h3cr.forwardNoReact, 1)}%` : "∅"} sub={h3cr ? `of crashes · n ${h3cr.forwardNoReactN} · the human silent miss` : "transcript absent"}
            rule="H3, crashes: share of events where the gaze was forward at the conflict instant and the reaction was none" from={h3 ? [src(h3.file)] : []} />
          <Stat label="eyes forward, entire window" value={h1 ? <>{fmt(g1("crashes")?.forwardEntire, 1)}%<em> ← {fmt(h1.baseline!.forwardEntire, 1)}%</em></> : "∅"} sub={h1 ? `crashes ← normal driving · n ${g1("crashes")?.n} vs ${h1.baseline!.n} epochs` : "transcript absent"}
            rule="H1, strict Forward: share of events whose observed window is forward throughout, crashes versus the normal-driving baseline epochs" from={h1 ? [src(h1.file)] : []} />
          <Stat label="takeover · visual-manual" value={h4vm && h4base ? `+${fmt(h4vm.mean - h4base.mean, 2)} s` : "∅"} sub={h4vm && h4base ? `+${Math.round(((h4vm.mean - h4base.mean) / h4base.mean) * 100)}% vs no task · cognitive +${fmt((h4cog?.mean ?? 0) - h4base.mean, 2)} s · ${h4?.trials ?? "?"} trials` : "transcript absent"}
            rule="H4, DCPT: mean takeover time for visual-manual tasks minus the no-task baseline, and the same for cognitive-only tasks" from={h4 ? [src(h4.file)] : []} />
        </div>

        <div className="wsgrid">
          <div className="ipanel wspanel">
            <div className="ilabel">the windshield · two coefficients above one independence line · automation left, human right</div>
            <div className="mbox" ref={wbox.ref}>{wind ?? <div className="note">transcripts not present or not in their known shape</div>}</div>
          </div>
          <div className="wsside">
            <div className="ipanel wspanel">
              <div className="ilabel">the human channel · 100-Car NDS · H1 observation · H2 gaze at the instant · H3 the joint</div>
              <div className="wsrows">
                {h1 && (
                  <div className="wsrow">
                    <span className="wsk">eyes forward for the entire window</span>
                    <span className="wsv"><b>{fmt(h1.baseline!.forwardEntire, 1)}%</b> normal → <b>{fmt(g1("all events")?.forwardEntire, 1)}%</b> conflicts → <b>{fmt(g1("crashes")?.forwardEntire, 1)}%</b> crashes</span>
                  </div>
                )}
                {h1 && (
                  <div className="wsrow">
                    <span className="wsk">off-road gaze, mean of window</span>
                    <span className="wsv">{fmt(h1.baseline!.offMean, 1)}% normal · {fmt(g1("near-crashes")?.offMean, 1)}% near-crashes · <b>{fmt(g1("crashes")?.offMean, 1)}%</b> crashes</span>
                  </div>
                )}
                {h2 && (
                  <div className="wsrow">
                    <span className="wsk">gaze forward at the conflict instant</span>
                    <span className="wsv"><b>{fmt(g2("all events")?.forward, 1)}%</b> of all events · <b>{fmt(g2("crashes")?.forward, 1)}%</b> of crashes · unknown kept as unknown {fmt(g2("all events")?.unknown, 1)}%</span>
                  </div>
                )}
                {h3 && h3.groups.map((g) => (
                  <div key={g.name} className="wsrow" data-joint="true">
                    <span className="wsk">{g.name} · n {g.n}</span>
                    <span className="wsv">both fail <b>{fmt(g.pBoth, 1)}%</b> vs independent {fmt(g.expected, 1)}% · <b>c {fmt(g.c, 2)}</b> · forward yet no reaction {fmt(g.forwardNoReact, 1)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ipanel wspanel fillpanel">
              <div className="ilabel">takeover time by non-driving task · DCPT, L3 automation · H4 · {h4 ? `${h4.participants} participants` : ""}</div>
              <div className="mbox" ref={tbox.ref}>{take ?? <div className="note">H4 transcript not present or not in its known shape</div>}</div>
            </div>
          </div>
        </div>
        {d.s && d.reg && (() => {
          /* the register governs: evidence-cost claims are withdrawn as stated
             and their use forbidden until the register's reconsideration
             requirements are met; a newer transcript does not lift that */
          const cost = d.reg.claims.filter((c) => /evidence-cost|result-g/.test(c.claim_id));
          const forbidden = cost.filter((c) => c.current_scientific_use === "forbidden").length;
          return (
            <div className="wsreg">
              <span className="cvl">register check</span>
              <span className="wsregv">Result S computes a corrected evidence figure from the measured c; the claims register holds {cost.length} evidence-cost claims <b>withdrawn as stated</b>, use forbidden ({forbidden}/{cost.length}), with reconsideration requirements; the instrument shows the register's state, not the newer transcript's number</span>
              <Digest id={src(d.s.file).id} sha={src(d.s.file).sha256} path={src(d.s.file).path} />
            </div>
          );
        })()}
        <div className="mnon">
          {[d.h1?.nonclaims, d.h3?.nonclaims, d.h4?.nonclaims].filter(Boolean).join(" · ")} · <Digest id={src((h3 ?? d.h1)!.file).id} sha={src((h3 ?? d.h1)!.file).sha256} path={src((h3 ?? d.h1)!.file).path} />
        </div>
      </div>
    </Station>
  );
}
