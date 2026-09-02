/* ST–03 · THE ENCOUNTER — the science, felt.
   One person-vehicle-automation encounter (synthetic fixture 001), told as
   you scroll: scrolling advances the encounter clock t=0→10s. A pinned road
   scene renders what the driver and the automation each see; narrative beats
   reveal the belief, the honest unmeasured void, the outcome window, and the
   one thing Reiyah exists to measure — the joint silent miss. Every value is
   a committed byte. Reiyah records encounters; it does not watch drivers. */
import { useEffect, useRef, useState } from "react";
import { fetchSurface } from "../lib/evidence";

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));

interface Chain {
  speed: { state: string; value?: unknown; unit?: string };
  color: { state: string };
  p1: number; p2: number;
  action: string;
  assigned: string;
  window: [number, number];
  basis: string;
}

const FALLBACK: Chain = {
  speed: { state: "observed", value: 0, unit: "meters_per_second" },
  color: { state: "unmeasured" },
  p1: 0.75, p2: 0.25,
  action: "record-candidate-prompt",
  assigned: "synthetic_candidate_prompt",
  window: [4, 10],
  basis: "evidence_gap",
};

export function Encounter() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progRef = useRef(0);
  const easedRef = useRef(0);
  const [chain, setChain] = useState<Chain>(FALLBACK);
  const chainRef = useRef<Chain>(FALLBACK);
  useEffect(() => { chainRef.current = chain; }, [chain]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [obs, bel, dec, itv, out, evd] = await Promise.all(
        ["observation", "belief", "decision", "intervention", "outcome", "evidence"].map((k) => fetchSurface<any>(`chain-${k}`))
      );
      if (!alive) return;
      const c = { ...FALLBACK };
      if (obs.state === "observed") {
        const ms = obs.data.measurements ?? [];
        const sp = ms.find((m: any) => m.measurement_id?.includes("relative-speed")) ?? ms[0];
        if (sp?.value) c.speed = sp.value;
        const col = ms.find((m: any) => m.value?.state !== "observed");
        if (col?.value) c.color = col.value;
      }
      if (bel.state === "observed") {
        const comp = bel.data.belief?.components ?? [];
        if (comp[0]) c.p1 = comp[0].probability;
        if (comp[1]) c.p2 = comp[1].probability;
      }
      if (dec.state === "observed") c.action = String(dec.data.selected_action?.value ?? c.action).split(".").pop()!;
      if (itv.state === "observed") c.assigned = String(itv.data.assigned_level?.value ?? c.assigned);
      if (out.state === "observed") {
        const w = out.data.measurement_window;
        c.window = [w?.start?.offset?.value ?? 4, w?.end?.offset?.value ?? 10];
      }
      if (evd.state === "observed") c.basis = evd.data.basis?.state ?? c.basis;
      setChain(c);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const el = scrollRef.current, canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      progRef.current = max > 0 ? clamp01(el.scrollTop / max) : 0;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    let raf = 0;
    const draw = () => {
      easedRef.current += (progRef.current - easedRef.current) * (reduced ? 1 : 0.12);
      const p = easedRef.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const dark = document.documentElement.dataset.ground === "dark";
      const INK = dark ? "255,255,255" : "16,18,21";
      const RED = dark ? "227,25,55" : "214,23,50";
      const OK = dark ? "143,208,176" : "23,114,76";
      const t = performance.now() / 1000;

      /* ---- first-person road: horizon + converging lane, ego at the base ---- */
      const horizon = h * 0.4;
      const cx = w / 2;
      const objY = horizon + (h * 0.42) * smooth(0.06, 0.5, p); // object approaches as time advances
      const objScale = 0.5 + smooth(0.06, 0.9, p) * 0.9;

      // road wedge
      ctx.strokeStyle = `rgba(${INK},0.12)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 26, horizon); ctx.lineTo(cx - w * 0.42, h);
      ctx.moveTo(cx + 26, horizon); ctx.lineTo(cx + w * 0.42, h);
      ctx.moveTo(0, horizon); ctx.lineTo(w, horizon);
      ctx.stroke();
      // lane dashes receding
      ctx.strokeStyle = `rgba(${INK},0.09)`;
      for (let i = 1; i <= 6; i++) {
        const f = i / 7, y = horizon + (h - horizon) * f * f;
        ctx.lineWidth = 1 + f * 2.5;
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + (h - horizon) * 0.04 * (1 + f)); ctx.stroke();
      }

      /* ---- the perception cones: driver (from left base) + automation (right base) ---- */
      const coneP = smooth(0.18, 0.42, p);
      if (coneP > 0) {
        const sweep = reduced ? 1 : 0.5 + 0.5 * Math.sin(t * 0.8);
        // driver gaze
        ctx.fillStyle = `rgba(${INK},${(0.05 * coneP).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.16, h);
        ctx.lineTo(cx - 10 - 16 * sweep, objY - 6);
        ctx.lineTo(cx + 10 + 16 * (1 - sweep), objY - 6);
        ctx.closePath(); ctx.fill();
        // automation sensor cone
        ctx.fillStyle = `rgba(${INK},${(0.05 * coneP).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(cx + w * 0.16, h);
        ctx.lineTo(cx + 10 + 16 * (1 - sweep), objY - 6);
        ctx.lineTo(cx - 10 - 16 * sweep, objY - 6);
        ctx.closePath(); ctx.fill();
      }

      /* ---- the object + belief doubt halo ---- */
      if (p > 0.05) {
        const r = 9 * objScale;
        const doubt = smooth(0.24, 0.44, p) * (1 - smooth(0.5, 0.62, p) * 0.55); // uncertainty blooms then firms
        // doubt halo (VSUP: fuzzier = less certain)
        if (doubt > 0) {
          const grd = ctx.createRadialGradient(cx, objY, r, cx, objY, r + 22 * doubt);
          grd.addColorStop(0, `rgba(${INK},0)`);
          grd.addColorStop(0.5, `rgba(${INK},${(0.14 * doubt).toFixed(3)})`);
          grd.addColorStop(1, `rgba(${INK},0)`);
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(cx, objY, r + 22 * doubt, 0, TAU); ctx.fill();
        }
        // the object (diamond) — color unmeasured, so it is drawn hollow
        ctx.strokeStyle = `rgba(${INK},0.85)`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, objY - r); ctx.lineTo(cx + r, objY);
        ctx.lineTo(cx, objY + r); ctx.lineTo(cx - r, objY);
        ctx.closePath(); ctx.stroke();

        /* the belief as a quantile dotplot — 20 dots, each 5% of probability;
           the most legible honest uncertainty encoding (Kay/Hullman). */
        const bShow = smooth(0.26, 0.42, p) * (1 - smooth(0.66, 0.74, p));
        if (bShow > 0.02) {
          const p1 = chainRef.current.p1 ?? 0.75;
          const filled = Math.round(p1 * 20);
          const dpr2 = 5.5, gap = 4.2, cols = 4;
          const ox = cx + r + 26, oy = objY - (2 * (dpr2 + gap));
          ctx.globalAlpha = bShow;
          for (let d = 0; d < 20; d++) {
            const col = d % cols, row = Math.floor(d / cols);
            const dx = ox + col * (dpr2 + gap), dy = oy + row * (dpr2 + gap);
            if (d < filled) {
              ctx.fillStyle = `rgba(${INK},0.9)`;
              ctx.beginPath(); ctx.arc(dx, dy, dpr2 / 2, 0, TAU); ctx.fill();
            } else {
              ctx.strokeStyle = `rgba(${INK},0.4)`;
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.arc(dx, dy, dpr2 / 2, 0, TAU); ctx.stroke();
            }
          }
          ctx.fillStyle = `rgba(${INK},0.55)`;
          ctx.font = '8px "B612 Mono", monospace';
          ctx.textAlign = "left";
          ctx.fillText(`RELEVANT ${p1.toFixed(2)}`, ox, oy + 5 * (dpr2 + gap) + 2);
          ctx.globalAlpha = 1;
        }
      }

      /* ---- the joint blind wedge: where neither channel reaches ---- */
      const jsm = smooth(0.72, 0.9, p);
      if (jsm > 0) {
        const bw = 26 + 10 * (reduced ? 0 : Math.sin(t * 1.2) * 0.5 + 0.5);
        ctx.save();
        ctx.strokeStyle = `rgba(${RED},${(0.5 * jsm).toFixed(3)})`;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx - bw, h); ctx.lineTo(cx, objY + 14); ctx.lineTo(cx + bw, h);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = `rgba(${RED},${(0.9 * jsm).toFixed(3)})`;
        ctx.font = '9px "B612 Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillText("JOINT BLIND", cx, objY + (h - objY) * 0.34);
      }

      /* ---- the intervention void: assigned → delivered ∅ ---- */
      const iv = smooth(0.5, 0.62, p) * (1 - smooth(0.68, 0.74, p));
      if (iv > 0.02) {
        ctx.fillStyle = `rgba(${OK},${(0.85 * iv).toFixed(3)})`;
        ctx.font = '9px "B612 Mono", monospace';
        ctx.textAlign = "left";
        ctx.fillText("ASSIGNED ●", 12, horizon - 10);
        ctx.fillStyle = `rgba(${INK},${(0.4 * iv).toFixed(3)})`;
        ctx.fillText("DELIVERED ∅   RECEIVED ∅", 12, horizon + 4);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", onScroll); };
  }, []);

  const speedTxt = chain.speed.state === "observed" ? `${chain.speed.value} m/s` : chain.speed.state;
  const beats: Array<{ t: string; k: string; body: React.ReactNode }> = [
    { t: "t 0.0s", k: "THE ENCOUNTER",
      body: <>One person–vehicle–automation encounter. Synthetic fixture 001. Every value below is a committed byte — <b>scroll to advance the clock</b>.</> },
    { t: "t 1.0s", k: "OBSERVATION",
      body: <>An object appears ahead. Relative speed <b>{speedTxt}</b>, observed. Its colour? <b>{chain.color.state}</b> — and Reiyah will not guess a value it never measured.</> },
    { t: "t 1.4s", k: "BELIEF",
      body: <>The driver and the automation each hold a belief over the object: <b>{chain.p1} relevant</b>, <b>{chain.p2} not</b>. The two sum to one within one millionth — a distribution, never a certainty.</> },
    { t: "t 2.0s", k: "DECISION",
      body: <>A decision forms: <b>{chain.action}</b>. Research only. It references the belief and the moment's information — and never touches the wheel.</> },
    { t: "t 3.0s", k: "INTERVENTION",
      body: <>The prompt is <b>assigned</b>. But was it delivered? received? adhered to? <b>Unmeasured, unmeasured, unmeasured.</b> The honest void — assignment is not delivery, and Reiyah keeps them apart.</> },
    { t: `t ${chain.window[0]}–${chain.window[1]}s`, k: "OUTCOME",
      body: <>The outcome window opens. What happens across these seconds is where every real question lives — recoverability, readiness, and the miss that hides.</> },
    { t: "the measure", k: "THE JOINT SILENT MISS",
      body: <>When the human channel and the automation channel go blind on the <i>same</i> object, in the <i>same</i> window, with no warning — a <b>joint silent miss</b>. Multiplying two marginal rates hides it; modelling their dependence reveals it. This is the one thing Reiyah exists to measure. <span className="jt">θ_JSM · θ_R readiness · θ_WG worst-group — defined, awaiting first light.</span></> },
    { t: "the ledger", k: "EVIDENCE",
      body: <>Basis: <b>{chain.basis.replace(/_/g, " ")}</b>. A gap stays a gap; retention is identity, not truth. Nothing here becomes a result until its gate accepts it.</> },
  ];

  return (
    <div className="encounter2" ref={scrollRef}>
      <div className="encStage">
        <canvas ref={canvasRef} aria-label="Cinematic scene of one synthetic person-vehicle-automation encounter" />
        <div className="encTag">ST–03 · THE ENCOUNTER</div>
        <div className="encNonclaim">reiyah records encounters · it does not watch drivers</div>
      </div>
      <div className="encBeats">
        {beats.map((b, i) => (
          <section key={i} className="encBeat">
            <div className="encBeatCard glass">
              <div className="encBeatT">{b.t}</div>
              <h3 className="encBeatK">{b.k}</h3>
              <p className="encBeatBody">{b.body}</p>
            </div>
          </section>
        ))}
        <div className="encEnd">↑ scroll back to rewind the encounter</div>
      </div>
    </div>
  );
}
