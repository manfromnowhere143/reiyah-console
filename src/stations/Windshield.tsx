/* ST-13 · THE WINDSHIELD — both sides. The automation side measured that a
   camera and a lidar miss the same objects more than independence allows.
   The human side, from naturalistic driving, measured that the driver's
   two channels, looking and acting, fail together the same way, and that
   eyes on the road at the moment of the conflict did not mean the hazard was
   seen. One windshield, two coefficients above the same independence line.
   Every figure is parsed from a retained transcript by a strict pattern and
   carries its digest; the lane's non-claims are rendered verbatim: descriptive,
   proposed, not causal, not a safety determination, not driver-clustered. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MONO, drawCabin, drawWorld, tones, useGround } from "../lib/roadScene";
import { fetchLane, fetchLaneText, parseConvergence, parseH1, parseH2, parseH3, parseH4, parseH5, parseH6, parseH7, parseRegister, type LaneFile, registerPath } from "../lib/gateb";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const F = {
  L: "evidence/measurement/result_l.txt",
  H1: "human-channel/evidence/h1_driver_observation.txt", H2: "human-channel/evidence/h2_glance_at_conflict.txt",
  H3: "human-channel/evidence/h3_observation_response_joint.txt", H4: "human-channel/evidence/h4_dcpt_takeover.txt",
  H5: "human-channel/evidence/h5_cross_agent_joint.txt", H6: "human-channel/evidence/h6_total_both_miss.txt", H7: "human-channel/evidence/h7_intervals.txt",
  S: "evidence/measurement/result_s.txt", R: "evidence/claim-status-register-2026-08-29.json" /* superseded at read time by registerPath() */,
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

/* ---- the windshield scene: the independence line is the horizon ----
   A coefficient above 1 rises into the sky as a column of light, reflected
   on the wet road; one below 1 sits on the far road just under the horizon.
   Drawn once per size, data and ground; reduced motion changes nothing
   because nothing moves. Every mark is a parsed transcript figure. */
interface Mark { c: number; lo?: number; hi?: number; label: string; short: string; sub: string; hold?: boolean }
function WindshieldScene({ w, h, marks, header }: { w: number; h: number; marks: Array<Mark | null>; header: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useGround();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const cv = ref.current; if (!cv || w === 0 || h === 0) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const { INK, OK, RED } = tones(dark);
      const mobile = w < 560;
      const dash = mobile ? 22 : 40, pillarW = mobile ? w * 0.05 : w * 0.075;
      const top = mobile ? 22 : 30, bottom = h - dash - (mobile ? 4 : 8);
      const ymin = 0.55, ymax = 1.75;
      const y = (v: number) => bottom - (bottom - top) * ((Math.min(ymax, Math.max(ymin, v)) - ymin) / (ymax - ymin));
      const horizon = Math.round(y(1)) + 0.5;
      drawWorld(ctx, { w, h, dark, horizon, headlight: true, dashes: 7 });
      /* the independence line, on the horizon */
      ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = `rgba(${RED},0.85)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pillarW, horizon); ctx.lineTo(w - pillarW, horizon); ctx.stroke(); ctx.restore();
      const xs = [w * 0.24, w * 0.5, w * 0.76];
      const column = (x: number, yTop: number) => {
        const hgt = horizon - yTop; if (hgt <= 0) return;
        /* the beam: narrow at its head, wider at its foot, brightest at the foot */
        const g = ctx.createLinearGradient(0, yTop, 0, horizon);
        g.addColorStop(0, `rgba(${OK},0.02)`); g.addColorStop(1, `rgba(${OK},0.30)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 3, yTop); ctx.lineTo(x + 3, yTop); ctx.lineTo(x + 13, horizon); ctx.lineTo(x - 13, horizon); ctx.closePath(); ctx.fill();
        const core = ctx.createLinearGradient(0, yTop, 0, horizon);
        core.addColorStop(0, `rgba(${OK},0.5)`); core.addColorStop(1, `rgba(${OK},1)`);
        ctx.fillStyle = core; ctx.fillRect(x - 1.1, yTop, 2.2, hgt);
        /* its reflection on the wet road */
        const rh = Math.min(hgt * 0.55, h - horizon - dash);
        const r = ctx.createLinearGradient(0, horizon, 0, horizon + rh);
        r.addColorStop(0, `rgba(${OK},0.40)`); r.addColorStop(1, `rgba(${OK},0)`);
        ctx.fillStyle = r; ctx.beginPath(); ctx.moveTo(x - 11, horizon); ctx.lineTo(x + 11, horizon); ctx.lineTo(x + 4, horizon + rh); ctx.lineTo(x - 4, horizon + rh); ctx.closePath(); ctx.fill();
      };
      const head = (x: number, yy: number, r: number) => {
        const halo = ctx.createRadialGradient(x, yy, r, x, yy, r * 4);
        halo.addColorStop(0, `rgba(${OK},0.35)`); halo.addColorStop(1, `rgba(${OK},0)`);
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, yy, r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${OK},1)`; ctx.beginPath(); ctx.arc(x, yy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${dark ? 0.85 : 0.6})`; ctx.beginPath(); ctx.arc(x, yy, r * 0.4, 0, Math.PI * 2); ctx.fill();
      };
      const big = mobile ? 15 : 19, r0 = mobile ? 4.5 : 6;
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      marks.forEach((m, i) => {
        if (!m) return;
        const x = xs[i], yc = y(m.c);
        if (m.c >= 1) column(x, yc); else { ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = `rgba(${OK},0.7)`; ctx.beginPath(); ctx.moveTo(x, horizon); ctx.lineTo(x, yc); ctx.stroke(); ctx.restore(); }
        if (m.lo !== undefined && m.hi !== undefined) {
          ctx.strokeStyle = `rgba(${INK},0.7)`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x - 7, y(m.lo)); ctx.lineTo(x + 7, y(m.lo)); ctx.moveTo(x - 7, y(m.hi)); ctx.lineTo(x + 7, y(m.hi)); ctx.moveTo(x, y(m.lo)); ctx.lineTo(x, y(m.hi)); ctx.stroke();
        }
        head(x, yc, r0);
        ctx.fillStyle = `rgba(${INK},1)`; ctx.font = `600 ${big}px ${MONO}`;
        const ty = Math.max(top + 12, (m.hi !== undefined ? y(m.hi) : Math.min(yc, horizon)) - r0 - 8);
        ctx.fillText(m.c.toFixed(i === 1 ? 2 : i === 2 ? 2 : 3), x, ty);
      });
      /* the arc between the two same-kind columns */
      const a = marks[0], b = marks[1];
      if (a && b) { ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = `rgba(${OK},0.55)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xs[0], y(a.c)); ctx.quadraticCurveTo((xs[0] + xs[1]) / 2, Math.min(y(a.c), y(b.c)) - 26, xs[1], y(b.c)); ctx.stroke(); ctx.restore(); }
      drawCabin(ctx, w, h, dark, pillarW, dash);
      /* HUD text: the header on the glass, the captions on the dashboard */
      ctx.font = `${mobile ? 8 : 9}px ${MONO}`; ctx.textAlign = "center";
      ctx.fillStyle = `rgba(${INK},${dark ? 0.8 : 0.7})`;
      if (!mobile) ctx.fillText(header, w / 2, 14);
      if (!mobile) { ctx.textAlign = "left"; ctx.fillStyle = `rgba(${RED},0.9)`; ctx.fillText("independence · the horizon", pillarW + 8, horizon + 28); }
      ctx.textAlign = "center";
      marks.forEach((m, i) => {
        if (!m) return;
        const x = xs[i];
        ctx.fillStyle = `rgba(${INK},${dark ? 0.92 : 0.85})`; ctx.font = `${mobile ? 8 : 9}px ${MONO}`;
        ctx.fillText(mobile ? m.short : m.label, x, h - (mobile ? 7 : 18));
        if (!mobile) { ctx.fillStyle = `rgba(${INK},${dark ? 0.6 : 0.5})`; ctx.fillText(m.sub, x, h - 6); }
      });
      setReady(true);
    });
    return () => { alive = false; };
  }, [w, h, marks, header, dark]);
  return <canvas ref={ref} className="wscene" data-ready={String(ready)} style={{ width: w, height: h }} aria-label="Three coefficients above the same independence line drawn as the horizon of a night road: automation, human, and the two together" />;
}

export function Windshield() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, d: null };
    const [L, H1, H2, H3, H4, H5, H6, H7, S, R] = await Promise.all([F.L, F.H1, F.H2, F.H3, F.H4, F.H5, F.H6, F.H7, F.S, await registerPath()].map((p) => fetchLaneText(p).catch(() => null)));
    return {
      lane,
      d: {
        auto: L ? { ...parseConvergence(L.text), file: L.file } : null,
        h1: H1 ? { ...parseH1(H1.text), file: H1.file } : null,
        h2: H2 ? { ...parseH2(H2.text), file: H2.file } : null,
        h3: H3 ? { ...parseH3(H3.text), file: H3.file } : null,
        h4: H4 ? { ...parseH4(H4.text), file: H4.file } : null,
        h5: H5 ? (() => { const v = parseH5(H5.text); return v ? { ...v, file: H5.file } : null; })() : null,
        h6: H6 ? (() => { const v = parseH6(H6.text); return v ? { ...v, file: H6.file } : null; })() : null,
        h7: H7 ? (() => { const v = parseH7(H7.text); return v ? { ...v, file: H7.file } : null; })() : null,
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
  const h5 = d.h5;
  const h6 = d.h6;
  const h7 = d.h7;
  const h7all = h7?.groups.find((g) => g.name === "all events") ?? null;
  const h7cr = h7?.groups.find((g) => g.name === "crashes") ?? null;

  /* ---- the windshield: the marks, then the scene ---- */
  const marks: Array<Mark | null> = [
    autoT ? { c: autoT.c, lo: autoT.lo, hi: autoT.hi, label: "AUTOMATION · camera × lidar", short: "AUTOMATION", sub: "nuScenes val · 95% CI" } : null,
    h3all ? { c: h3all.c, lo: h7all?.lo, hi: h7all?.hi, label: "HUMAN · looking × acting", short: "HUMAN", sub: h7all ? "100-Car · event-resampled 95% CI" : "100-Car · no interval" } : null,
    h6 ? { c: h6.c, lo: h6.lo, hi: h6.hi, label: "HUMAN × AUTOMATION", short: "HUMAN × AUTO", sub: "BDD-A · total miss · 95% CI", hold: true } : h5 ? { c: h5.c, label: "HUMAN × AUTOMATION", short: "HUMAN × AUTO", sub: "BDD-A · no interval", hold: true } : null,
  ];
  const wind = wbox.w > 0 && (autoT || h3all)
    ? <WindshieldScene w={wbox.w} h={wbox.h} marks={marks} header={(h5 || h6) ? "same-kind redundancy fails together · different-kind roughly holds" : "the same signature on both sides · the meeting point still unmeasured"} />
    : null;

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
          <Stat label="human · c" value={h3all ? fmt(h3all.c, 2) : "∅"} sub={h3all ? (h7all ? `looking × acting · ${h3all.n} conflicts · [${fmt(h7all.lo, 2)}, ${fmt(h7all.hi, 2)}] · H7` : `looking × acting · ${h3all.n} conflicts · no interval`) : "transcript absent"}
            rule="H3: P(both fail) over P(obs fail) × P(resp fail) across all events with known gaze and known reaction; obs fail = gaze not forward at the conflict instant, resp fail = no reaction; H7 adds an event-resampled bootstrap interval, not driver-clustered" from={[...(h3 ? [src(h3.file)] : []), ...(h7 ? [src(h7.file)] : [])]} />
          <Stat label="looked forward, did nothing" value={h3cr ? `${fmt(h3cr.forwardNoReact, 1)}%` : "∅"} sub={h3cr ? (h7cr ? `of crashes · n ${h3cr.forwardNoReactN} · [${fmt(h7cr.fnrLo, 1)}, ${fmt(h7cr.fnrHi, 1)}]% · the human silent miss` : `of crashes · n ${h3cr.forwardNoReactN} · the human silent miss`) : "transcript absent"}
            rule="H3, crashes: share of events where the gaze was forward at the conflict instant and the reaction was none" from={h3 ? [src(h3.file)] : []} />
          <Stat label="eyes forward, entire window" value={h1 ? <>{fmt(g1("crashes")?.forwardEntire, 1)}%<em> ← {fmt(h1.baseline!.forwardEntire, 1)}%</em></> : "∅"} sub={h1 ? `crashes ← normal driving · n ${g1("crashes")?.n} vs ${h1.baseline!.n} epochs` : "transcript absent"}
            rule="H1, strict Forward: share of events whose observed window is forward throughout, crashes versus the normal-driving baseline epochs" from={h1 ? [src(h1.file)] : []} />
          <Stat label="takeover · visual-manual" value={h4vm && h4base ? `+${fmt(h4vm.mean - h4base.mean, 2)} s` : "∅"} sub={h4vm && h4base ? (h7?.takeover ? `[${fmt(h7.takeover.vmLo, 2)}, ${fmt(h7.takeover.vmHi, 2)}] s · participant-clustered · cognitive +${fmt(h7.takeover.cog, 2)} s [${fmt(h7.takeover.cogLo, 2)}, ${fmt(h7.takeover.cogHi, 2)}]` : `+${Math.round(((h4vm.mean - h4base.mean) / h4base.mean) * 100)}% vs no task · cognitive +${fmt((h4cog?.mean ?? 0) - h4base.mean, 2)} s · ${h4?.trials ?? "?"} trials`) : "transcript absent"}
            rule="H4, DCPT: mean takeover time for visual-manual tasks minus the no-task baseline, and the same for cognitive-only tasks" from={h4 ? [src(h4.file)] : []} />
        </div>

        <div className="wsgrid">
          <div className="ipanel wspanel wshero">
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
              <span className="wsregv">register {d.reg.version} of {d.reg.createdOn}{d.reg.predecessor ? ", successor of its predecessor," : ","} holds {cost.length} evidence-cost claims <b>withdrawn as stated</b>, use forbidden ({forbidden}/{cost.length}); Result S computes a corrected evidence figure from the measured c, and the instrument shows the register's state, not the newer transcript's number</span>
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
