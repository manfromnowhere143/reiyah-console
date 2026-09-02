/* ST-03 · THE ENCOUNTER — the science, felt, on one screen.
   One person-vehicle-automation encounter (synthetic fixture 001) told as a
   self-playing film: the encounter clock advances t=0->10s on a pinned scene,
   the narrative beat updates in place as the clock passes each moment, and a
   timeline lets you scrub through time or jump to any beat. No scrolling.
   Every value is a committed byte. Reiyah records encounters; it does not
   watch drivers. */
import { useEffect, useRef, useState } from "react";
import { fetchSurface } from "../lib/evidence";

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));
const DURATION = 15; // seconds to play the whole clock

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progRef = useRef(0);       // 0..1 encounter clock
  const easedRef = useRef(0);
  const playingRef = useRef(true);
  const draggingRef = useRef(false);
  const lastBeat = useRef(-1);
  const [beatIdx, setBeatIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [prog, setProg] = useState(0); // for the playhead position (throttled)
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { playingRef.current = false; setPlaying(false); }

    let raf = 0;
    let lastT = performance.now();
    let sync = 0;
    const draw = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      if (playingRef.current && !draggingRef.current) {
        progRef.current += dt / DURATION;
        if (progRef.current >= 1) { progRef.current = 1; playingRef.current = false; setPlaying(false); }
      }
      easedRef.current += (progRef.current - easedRef.current) * (reduced ? 1 : 0.12);
      const p = easedRef.current;

      /* update the beat caption + throttled playhead */
      const bi = beatPFor(progRef.current);
      if (bi !== lastBeat.current) { lastBeat.current = bi; setBeatIdx(bi); }
      if (now - sync > 60) { sync = now; setProg(progRef.current); }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const dark = document.documentElement.dataset.ground === "dark";
      const INK = dark ? "255,255,255" : "16,18,21";
      const RED = dark ? "227,25,55" : "214,23,50";
      const OK = dark ? "143,208,176" : "23,114,76";
      const t = now / 1000;

      /* ---- first-person road: horizon + converging lane, ego at the base ---- */
      const horizon = h * 0.4;
      const cx = w / 2;
      const objY = horizon + (h * 0.42) * smooth(0.06, 0.5, p);
      const objScale = 0.5 + smooth(0.06, 0.9, p) * 0.9;

      ctx.strokeStyle = `rgba(${INK},0.34)`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 26, horizon); ctx.lineTo(cx - w * 0.42, h);
      ctx.moveTo(cx + 26, horizon); ctx.lineTo(cx + w * 0.42, h);
      ctx.moveTo(0, horizon); ctx.lineTo(w, horizon);
      ctx.stroke();
      for (let i = 1; i <= 6; i++) {
        const f = i / 7, y = horizon + (h - horizon) * f * f;
        ctx.strokeStyle = `rgba(${INK},${(0.2 + f * 0.35).toFixed(2)})`;
        ctx.lineWidth = 1.2 + f * 2.5;
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + (h - horizon) * 0.04 * (1 + f)); ctx.stroke();
      }

      /* ---- perception cones: driver (left base) + automation (right base) ---- */
      const coneP = smooth(0.18, 0.42, p);
      if (coneP > 0) {
        const sweep = reduced ? 1 : 0.5 + 0.5 * Math.sin(t * 0.8);
        ctx.fillStyle = `rgba(${INK},${(0.05 * coneP).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.16, h);
        ctx.lineTo(cx - 10 - 16 * sweep, objY - 6);
        ctx.lineTo(cx + 10 + 16 * (1 - sweep), objY - 6);
        ctx.closePath(); ctx.fill();
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
        const doubt = smooth(0.24, 0.44, p) * (1 - smooth(0.5, 0.62, p) * 0.55);
        if (doubt > 0) {
          const grd = ctx.createRadialGradient(cx, objY, r, cx, objY, r + 22 * doubt);
          grd.addColorStop(0, `rgba(${INK},0)`);
          grd.addColorStop(0.5, `rgba(${INK},${(0.14 * doubt).toFixed(3)})`);
          grd.addColorStop(1, `rgba(${INK},0)`);
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(cx, objY, r + 22 * doubt, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = `rgba(${INK},0.85)`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, objY - r); ctx.lineTo(cx + r, objY);
        ctx.lineTo(cx, objY + r); ctx.lineTo(cx - r, objY);
        ctx.closePath(); ctx.stroke();

        const bShow = smooth(0.26, 0.42, p) * (1 - smooth(0.66, 0.74, p));
        if (bShow > 0.02) {
          const p1 = chainRef.current.p1 ?? 0.75;
          const filled = Math.round(p1 * 20);
          const dot = 5.5, gap = 4.2, cols = 4;
          const ox = cx + r + 26, oy = objY - (2 * (dot + gap));
          ctx.globalAlpha = bShow;
          for (let d = 0; d < 20; d++) {
            const col = d % cols, row = Math.floor(d / cols);
            const dx = ox + col * (dot + gap), dy = oy + row * (dot + gap);
            if (d < filled) {
              ctx.fillStyle = `rgba(${INK},0.9)`;
              ctx.beginPath(); ctx.arc(dx, dy, dot / 2, 0, TAU); ctx.fill();
            } else {
              ctx.strokeStyle = `rgba(${INK},0.4)`;
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.arc(dx, dy, dot / 2, 0, TAU); ctx.stroke();
            }
          }
          ctx.fillStyle = `rgba(${INK},0.55)`;
          ctx.font = '8px "B612 Mono", monospace';
          ctx.textAlign = "left";
          ctx.fillText(`RELEVANT ${p1.toFixed(2)}`, ox, oy + 5 * (dot + gap) + 2);
          ctx.globalAlpha = 1;
        }
      }

      /* ---- joint blind wedge ---- */
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

      /* ---- intervention void ---- */
      const iv = smooth(0.5, 0.62, p) * (1 - smooth(0.68, 0.74, p));
      if (iv > 0.02) {
        ctx.fillStyle = `rgba(${OK},${(0.85 * iv).toFixed(3)})`;
        ctx.font = '9px "B612 Mono", monospace';
        ctx.textAlign = "left";
        ctx.fillText("ASSIGNED", 12, horizon - 10);
        ctx.fillStyle = `rgba(${INK},${(0.4 * iv).toFixed(3)})`;
        ctx.fillText("DELIVERED / RECEIVED : unmeasured", 12, horizon + 4);
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- timeline scrub ---- */
  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    progRef.current = clamp01((clientX - r.left) / r.width);
    setProg(progRef.current);
  };
  const onDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    playingRef.current = false; setPlaying(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => { if (draggingRef.current) setFromClientX(e.clientX); };
  const onUp = () => { draggingRef.current = false; };
  const togglePlay = () => {
    if (progRef.current >= 0.999) progRef.current = 0;
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  };
  const jumpTo = (p: number) => {
    progRef.current = p; setProg(p);
    playingRef.current = false; setPlaying(false);
  };

  const speedTxt = chain.speed.state === "observed" ? `${chain.speed.value} m/s` : chain.speed.state;
  const beats: Array<{ p: number; t: string; k: string; body: React.ReactNode }> = [
    { p: 0.0, t: "t 0.0s", k: "THE ENCOUNTER",
      body: <>One person-vehicle-automation encounter. Synthetic fixture 001. Every value is a committed byte.</> },
    { p: 0.12, t: "t 1.0s", k: "OBSERVATION",
      body: <>An object appears ahead. Relative speed <b>{speedTxt}</b>, observed. Its colour? <b>{chain.color.state}</b> — Reiyah will not guess a value it never measured.</> },
    { p: 0.30, t: "t 1.4s", k: "BELIEF",
      body: <>A belief forms over the object: <b>{chain.p1} relevant</b>, <b>{chain.p2} not</b>. The two sum to one within a millionth — a distribution, never a certainty.</> },
    { p: 0.44, t: "t 2.0s", k: "DECISION",
      body: <>A decision forms: <b>{chain.action}</b>. Research only. It references the belief and the moment's information — and never touches the wheel.</> },
    { p: 0.56, t: "t 3.0s", k: "INTERVENTION",
      body: <>The prompt is <b>assigned</b>. Delivered? received? adhered to? <b>Unmeasured.</b> Assignment is not delivery, and Reiyah keeps them apart.</> },
    { p: 0.66, t: `t ${chain.window[0]}-${chain.window[1]}s`, k: "OUTCOME",
      body: <>The outcome window opens — where recoverability, readiness, and the miss that hides all live.</> },
    { p: 0.80, t: "the measure", k: "THE JOINT SILENT MISS",
      body: <>When the human channel and the automation channel go blind on the <i>same</i> object, in the <i>same</i> window, with no warning — a <b>joint silent miss</b>. Multiplying two marginal rates hides it; modelling their dependence reveals it. This is the one thing Reiyah exists to measure.</> },
    { p: 0.93, t: "the ledger", k: "EVIDENCE",
      body: <>Basis: <b>{chain.basis.replace(/_/g, " ")}</b>. A gap stays a gap; retention is identity, not truth. Nothing becomes a result until its gate accepts it.</> },
  ];
  function beatPFor(p: number) {
    let i = 0;
    for (let k = 0; k < beats.length; k++) if (beats[k].p <= p + 1e-4) i = k;
    return i;
  }
  const beat = beats[beatIdx];

  return (
    <div className="encounter2">
      <div className="encStage">
        <canvas ref={canvasRef} aria-label="Cinematic scene of one synthetic person-vehicle-automation encounter" />
        <div className="encTag">ST-03 · THE ENCOUNTER</div>
        <div className="encNonclaim">reiyah records encounters · it does not watch drivers</div>
        <div className="encCaption" key={beatIdx}>
          <div className="encBeatT">{beat.t}</div>
          <h3 className="encBeatK">{beat.k}</h3>
          <p className="encBeatBody">{beat.body}</p>
        </div>
      </div>

      <div className="encScrub">
        <button className="encPlay" onClick={togglePlay} aria-label={playing ? "pause" : "play"}>
          {playing ? "❚❚" : progRef.current >= 0.999 ? "↺" : "▶"}
        </button>
        <div
          className="encTrack" ref={trackRef}
          role="slider" aria-label="encounter clock" aria-valuemin={0} aria-valuemax={10}
          aria-valuenow={Math.round(prog * 100) / 10}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <div className="encTrackFill" style={{ transform: `scaleX(${prog})` }} />
          {beats.map((b, i) => (
            <button
              key={i} className="encMark" data-on={String(i <= beatIdx)}
              style={{ left: `${b.p * 100}%` }} title={b.k}
              onPointerDown={(e) => { e.stopPropagation(); jumpTo(b.p); }}
            />
          ))}
          <div className="encHead" style={{ left: `${prog * 100}%` }} />
        </div>
        <div className="encClock">t {(prog * 10).toFixed(1)}s</div>
      </div>
    </div>
  );
}
