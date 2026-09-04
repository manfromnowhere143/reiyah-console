/* ST-03 · THE ENCOUNTER — the science, felt, on one screen.
   One person-vehicle-automation encounter (synthetic fixture 001) told as a
   self-playing film on a pinned first-person scene. The encounter clock runs
   at the fixture's own offsets: observation at t=0, belief at 1, decision at 2,
   intervention at 3, the outcome window 4-10, evidence after. The object holds
   station ahead because its observed relative speed is zero; what changes over
   the ten seconds is not the world but what is known about it. Two sightlines,
   the human's and the automation's, watch the same object; the one moment they
   both look away is the joint silent miss, drawn as a concept and labelled so.
   Every value is a committed byte. Reiyah records encounters; it does not
   watch drivers. */
import { useEffect, useRef, useState } from "react";
import { fetchSurface } from "../lib/evidence";

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const T0 = -1, T1 = 11;               // the clock: a one-second prelude, then the fixture's ten seconds
const DURATION = 17;                    // real seconds to play the whole clock
const tOf = (p: number) => T0 + (T1 - T0) * p;
const pOf = (t: number) => (t - T0) / (T1 - T0);

interface Ev { state: string; value?: unknown; unit?: string; reason?: string }
interface Chain {
  speed: Ev; color: Ev;
  p1: number; p2: number;
  action: string; researchOnly: boolean;
  assigned: Ev; delivered: Ev; received: Ev; adherence: Ev; physical: boolean;
  window: [number, number]; count: Ev; censoring: string;
  basis: string; gap: string; validity: string;
}
const FALLBACK: Chain = {
  speed: { state: "observed", value: 0, unit: "meters_per_second" },
  color: { state: "unmeasured", reason: "not measured by the fixture protocol" },
  p1: 0.75, p2: 0.25,
  action: "record-candidate-prompt", researchOnly: true,
  assigned: { state: "observed", value: "synthetic_candidate_prompt" },
  delivered: { state: "unmeasured" }, received: { state: "unmeasured" }, adherence: { state: "unmeasured" }, physical: false,
  window: [4, 10], count: { state: "observed", value: 0, unit: "count" }, censoring: "not_censored",
  basis: "evidence_gap", gap: "structure only, not scientific evidence", validity: "unknown",
};

const evTxt = (e: Ev) => e.state === "observed" ? `${String(e.value)}${e.unit ? " " + e.unit.replace("meters_per_second", "m/s").replace(/_/g, " ") : ""}` : `∅ ${e.state.replace(/_/g, " ")}`;

export function Encounter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progRef = useRef(0);
  const easedRef = useRef(0);
  const playingRef = useRef(true);
  const draggingRef = useRef(false);
  const lastBeat = useRef(-1);
  const [beatIdx, setBeatIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [prog, setProg] = useState(0);
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
      const c: Chain = { ...FALLBACK };
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
      if (dec.state === "observed") {
        c.action = String(dec.data.selected_action?.value ?? c.action).split(".").pop()!;
        c.researchOnly = !!dec.data.research_only;
      }
      if (itv.state === "observed") {
        c.assigned = itv.data.assigned_level ?? c.assigned;
        c.delivered = itv.data.delivered_level ?? c.delivered;
        c.received = itv.data.received_level ?? c.received;
        c.adherence = itv.data.adherence ?? c.adherence;
        c.physical = !!itv.data.physical_control_enabled;
      }
      if (out.state === "observed") {
        const w = out.data.measurement_window;
        c.window = [w?.start?.offset?.value ?? 4, w?.end?.offset?.value ?? 10];
        const m = (out.data.measurements ?? [])[0];
        if (m?.value) c.count = m.value;
        c.censoring = String(out.data.censoring?.state ?? c.censoring);
      }
      if (evd.state === "observed") {
        c.basis = evd.data.basis?.state ?? c.basis;
        c.gap = evd.data.basis?.gap_reason ?? c.gap;
        c.validity = evd.data.validity?.state ?? c.validity;
      }
      setChain(c);
    })();
    return () => { alive = false; };
  }, []);

  /* ---- the scene ---- */
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
    const MONO = '"B612 Mono", Menlo, monospace';

    const draw = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (playingRef.current && !draggingRef.current) {
        progRef.current += dt / DURATION;
        if (progRef.current >= 1) { progRef.current = 1; playingRef.current = false; setPlaying(false); }
      }
      easedRef.current += (progRef.current - easedRef.current) * (reduced ? 1 : 0.14);
      const t = tOf(easedRef.current);
      const c = chainRef.current;

      const bi = beatFor(tOf(progRef.current));
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
      const OK = dark ? "126,166,255" : "47,102,214";
      const VOID = dark ? "5,5,7" : "244,243,238";
      const s = now / 1000;
      const mobile = w < 560;
      const fs = mobile ? 8 : 9;

      /* ---- ego motion: the road flows, the cabin sways a little ---- */
      const sway = reduced ? 0 : Math.sin(s * 0.55) * 2.2 + Math.sin(s * 1.7) * 0.6;
      const bob = reduced ? 0 : Math.sin(s * 1.1) * 1.1;
      ctx.save();
      ctx.translate(sway, bob);
      const horizon = h * 0.42;
      const cx = w / 2;
      const roadW = w * 0.44;
      /* the horizon wash: light gathers where the road vanishes */
      const sky = ctx.createLinearGradient(0, horizon - h * 0.28, 0, horizon);
      sky.addColorStop(0, `rgba(${INK},0)`); sky.addColorStop(1, `rgba(${INK},${dark ? 0.06 : 0.045})`);
      ctx.fillStyle = sky; ctx.fillRect(-10, horizon - h * 0.28, w + 20, h * 0.28);
      const gnd = ctx.createLinearGradient(0, horizon, 0, h);
      gnd.addColorStop(0, `rgba(${INK},${dark ? 0.05 : 0.04})`); gnd.addColorStop(0.5, `rgba(${INK},0)`);
      ctx.fillStyle = gnd; ctx.fillRect(-10, horizon, w + 20, h - horizon);
      /* the ground grid, flowing toward the cabin: depth you can feel */
      const phase0 = reduced ? 0 : (s * 0.32) % 1;
      for (let i = 0; i < 12; i++) {
        const f = ((i + phase0) % 12) / 12;
        const y = horizon + (h - horizon) * f * f;
        ctx.strokeStyle = `rgba(${INK},${(0.03 + f * 0.09).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(w + 10, y); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${INK},0.07)`;
      for (let k = -4; k <= 4; k++) {
        if (k === 0) continue;
        ctx.beginPath(); ctx.moveTo(cx + k * 6, horizon); ctx.lineTo(cx + k * w * 0.34, h + 20); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${INK},0.34)`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 24, horizon); ctx.lineTo(cx - roadW, h + 20);
      ctx.moveTo(cx + 24, horizon); ctx.lineTo(cx + roadW, h + 20);
      ctx.moveTo(-10, horizon); ctx.lineTo(w + 10, horizon);
      ctx.stroke();
      const phase = reduced ? 0 : (s * 0.32) % 1;
      for (let i = 0; i < 7; i++) {
        const f = ((i + phase) % 7) / 7;
        const y = horizon + (h - horizon) * f * f;
        ctx.strokeStyle = `rgba(${INK},${(0.16 + f * 0.4).toFixed(2)})`;
        ctx.lineWidth = 1 + f * 2.8;
        ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + (h - horizon) * 0.045 * (0.3 + f)); ctx.stroke();
      }

      /* ---- the object: holds station (relative speed observed 0) ---- */
      const objY = horizon + (h - horizon) * 0.34;
      const r = mobile ? 9 : 11;
      const seen = smooth(-0.2, 0.15, t);               // detected at t=0
      ctx.restore();

      /* ---- two sightlines: the human (dashed) and the automation (solid) ---- */
      const coneOn = smooth(-0.4, 0.4, t);
      const jsm = smooth(6.3, 6.9, t) * (1 - smooth(9.0, 9.6, t)); // both look away at once
      const apexL = { x: cx - w * 0.26, y: h + 14 }, apexR = { x: cx + w * 0.26, y: h + 14 };
      const scanH = reduced ? 0 : Math.sin(s * 0.7) * w * 0.035;
      const scanA = reduced ? 0 : Math.sin(s * 1.6 + 1) * w * 0.018;
      const aimL = cx + scanH + (-w * 0.30 - scanH) * jsm;
      const aimR = cx + scanA + (w * 0.30 - scanA) * jsm;
      const halfW = mobile ? 22 : 30;
      const cone = (apex: { x: number; y: number }, aimX: number, dashed: boolean, alpha: number) => {
        if (alpha <= 0.01) return;
        const dx = aimX - apex.x, dy = objY - apex.y, L = Math.hypot(dx, dy);
        const ux = dx / L, uy = dy / L, px = -uy, py = ux;
        const far = L * 1.1;
        const fx = apex.x + ux * far, fy = apex.y + uy * far;
        const hw = halfW * (far / L);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(apex.x, apex.y); ctx.lineTo(fx + px * hw, fy + py * hw); ctx.lineTo(fx - px * hw, fy - py * hw); ctx.closePath();
        const cg = ctx.createLinearGradient(apex.x, apex.y, fx, fy);
        cg.addColorStop(0, `rgba(${INK},${(0.075 * alpha).toFixed(3)})`); cg.addColorStop(1, `rgba(${INK},0)`);
        ctx.fillStyle = cg; ctx.fill();
        ctx.strokeStyle = `rgba(${INK},${(0.26 * alpha).toFixed(3)})`; ctx.lineWidth = 1;
        if (dashed) ctx.setLineDash([3, 4]);
        ctx.stroke();
        /* the scan beam sweeps the field of view */
        ctx.setLineDash([]);
        const sw = reduced ? 0 : Math.sin(s * (dashed ? 1.9 : 3.1) + (dashed ? 0 : 2));
        ctx.strokeStyle = `rgba(${INK},${(0.22 * alpha).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(apex.x, apex.y); ctx.lineTo(fx + px * hw * sw, fy + py * hw * sw); ctx.stroke();
        ctx.restore();
      };
      cone(apexL, aimL, true, coneOn);
      cone(apexR, aimR, false, coneOn);
      if (coneOn > 0.5 && !mobile) {
        ctx.fillStyle = `rgba(${INK},0.55)`; ctx.font = `${fs}px ${MONO}`;
        ctx.textAlign = "left"; ctx.fillText("HUMAN", apexL.x - 18, h - 6);
        ctx.textAlign = "right"; ctx.fillText("AUTOMATION", apexR.x + 18, h - 6);
      }

      /* ---- the joint blind: neither sightline holds the object ---- */
      if (jsm > 0.02) {
        const bw = (mobile ? 30 : 42) * (0.85 + 0.15 * (reduced ? 1 : Math.sin(s * 2) * 0.5 + 0.5));
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = `rgba(${RED},${(0.7 * jsm).toFixed(3)})`; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(cx - bw, h + 4); ctx.lineTo(cx, objY + r + 4); ctx.lineTo(cx + bw, h + 4); ctx.stroke();
        ctx.restore();
        const grd = ctx.createRadialGradient(cx, objY, r, cx, objY, r + 40);
        grd.addColorStop(0, `rgba(${RED},${(0.22 * jsm).toFixed(3)})`); grd.addColorStop(1, `rgba(${RED},0)`);
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, objY, r + 40, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(${RED},${(0.95 * jsm).toFixed(3)})`; ctx.font = `${fs}px ${MONO}`; ctx.textAlign = "center";
        const jy = objY + (h - objY) * (mobile ? 0.22 : 0.42);
        ctx.fillText("JOINT BLIND", cx, jy);
        ctx.fillStyle = `rgba(${INK},${(0.5 * jsm).toFixed(3)})`;
        ctx.fillText("concept · not measured in this fixture", cx, jy + fs + 4);
      }

      /* ---- the object, its doubt halo, its lock brackets ---- */
      if (seen > 0.01) {
        const doubt = smooth(0.8, 1.4, t) * (1 - smooth(1.9, 2.4, t) * 0.55);
        if (doubt > 0) {
          const grd = ctx.createRadialGradient(cx, objY, r, cx, objY, r + 24 * doubt);
          grd.addColorStop(0, `rgba(${INK},0)`); grd.addColorStop(0.5, `rgba(${INK},${(0.14 * doubt).toFixed(3)})`); grd.addColorStop(1, `rgba(${INK},0)`);
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, objY, r + 24 * doubt, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = seen;
        /* a wire cuboid, its back face drawn toward the vanishing point */
        const fw = r * 1.15, fh = r * 0.95, kq = 0.72;
        const bx = cx, by = objY - (objY - horizon) * (1 - kq) * 0.5;
        const F = [[cx - fw, objY - fh], [cx + fw, objY - fh], [cx + fw, objY + fh], [cx - fw, objY + fh]];
        const B = [[bx - fw * kq, by - fh * kq], [bx + fw * kq, by - fh * kq], [bx + fw * kq, by + fh * kq], [bx - fw * kq, by + fh * kq]];
        ctx.strokeStyle = `rgba(${INK},0.42)`; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { ctx.moveTo(B[i][0], B[i][1]); ctx.lineTo(B[(i + 1) % 4][0], B[(i + 1) % 4][1]); ctx.moveTo(F[i][0], F[i][1]); ctx.lineTo(B[i][0], B[i][1]); }
        ctx.stroke();
        ctx.fillStyle = `rgba(${VOID},0.55)`;
        ctx.beginPath(); ctx.rect(cx - fw, objY - fh, fw * 2, fh * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${INK},0.9)`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(cx - fw, objY - fh, fw * 2, fh * 2); ctx.stroke();
        ctx.fillStyle = `rgba(${INK},0.75)`; ctx.beginPath(); ctx.arc(cx, objY, 1.8, 0, TAU); ctx.fill();
        /* lock brackets: the observation happened; the object is a record now */
        const b = r + 7, k = 5;
        ctx.strokeStyle = `rgba(${INK},0.5)`; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - b, objY - b + k); ctx.lineTo(cx - b, objY - b); ctx.lineTo(cx - b + k, objY - b);
        ctx.moveTo(cx + b - k, objY - b); ctx.lineTo(cx + b, objY - b); ctx.lineTo(cx + b, objY - b + k);
        ctx.moveTo(cx + b, objY + b - k); ctx.lineTo(cx + b, objY + b); ctx.lineTo(cx + b - k, objY + b);
        ctx.moveTo(cx - b + k, objY + b); ctx.lineTo(cx - b, objY + b); ctx.lineTo(cx - b, objY + b - k);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      /* ---- diegetic tags: anchored to the object with a leader line ---- */
      const tag = (ax: number, ay: number, tx: number, ty: number, lines: Array<[string, string]>, alpha: number, align: CanvasTextAlign = "left") => {
        if (alpha <= 0.02) return;
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgba(${INK},0.35)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = `rgba(${INK},0.6)`; ctx.beginPath(); ctx.arc(ax, ay, 1.6, 0, TAU); ctx.fill();
        ctx.font = `${fs}px ${MONO}`; ctx.textAlign = align;
        const lh = fs + 4;
        const off = align === "left" ? 6 : align === "right" ? -6 : 0;
        /* a ground plate under the text: the scene never fights the words */
        const wid = Math.max(...lines.map(([txt]) => ctx.measureText(txt).width));
        const px0 = align === "left" ? tx + off - 4 : align === "right" ? tx + off - wid - 4 : tx - wid / 2 - 4;
        ctx.fillStyle = `rgba(${VOID},0.78)`;
        ctx.beginPath(); ctx.roundRect(px0, ty - fs + 1, wid + 8, lines.length * lh + 4, 3); ctx.fill();
        lines.forEach(([txt, tone], i) => { ctx.fillStyle = tone; ctx.fillText(txt, tx + off, ty + 3 + i * lh); });
        ctx.restore();
      };
      const ink = (a: number) => `rgba(${INK},${a})`;
      const okc = `rgba(${OK},0.95)`, redc = `rgba(${RED},0.95)`;
      const rightX = Math.min(w - (mobile ? 118 : 200), cx + r + 34), leftX = Math.max(mobile ? 120 : 200, cx - r - 34);

      /* OBSERVATION t=0 */
      const obsA = smooth(-0.05, 0.35, t) * (1 - smooth(0.85, 1.15, t));
      tag(cx + r, objY - 2, rightX, objY - 22, [
        ["OBSERVATION · t 0", ink(0.55)],
        [`rel speed ${evTxt(c.speed)} · ${c.speed.state}`, ink(0.95)],
        [`colour ${evTxt(c.color)}`, ink(0.6)],
      ], obsA);

      /* BELIEF t=1: the quantile dot plot, countable probability */
      const belA = smooth(0.95, 1.35, t) * (1 - smooth(1.9, 2.2, t));
      if (belA > 0.02) {
        const filled = Math.round(c.p1 * 20);
        const dot = 5.5, gap = 4.2, cols = 4;
        const ox = rightX + 6, oy = objY - 26;
        ctx.save(); ctx.globalAlpha = belA;
        ctx.strokeStyle = `rgba(${INK},0.35)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + r, objY); ctx.lineTo(rightX, objY - 10); ctx.stroke();
        for (let d = 0; d < 20; d++) {
          const col = d % cols, row = Math.floor(d / cols);
          const dx = ox + col * (dot + gap), dy = oy + row * (dot + gap);
          ctx.beginPath(); ctx.arc(dx, dy, dot / 2, 0, TAU);
          if (d < filled) { ctx.fillStyle = `rgba(${INK},0.9)`; ctx.fill(); }
          else { ctx.strokeStyle = `rgba(${INK},0.4)`; ctx.stroke(); }
        }
        ctx.fillStyle = `rgba(${INK},0.6)`; ctx.font = `${fs}px ${MONO}`; ctx.textAlign = "left";
        ctx.fillText(`BELIEF · t 1 · relevant ${c.p1.toFixed(2)}`, ox, oy + 5 * (dot + gap) + 2);
        ctx.fillText(`${filled} of 20 · not relevant ${c.p2.toFixed(2)}`, ox, oy + 5 * (dot + gap) + 2 + fs + 4);
        ctx.restore();
      }

      /* DECISION t=2 */
      const decA = smooth(1.95, 2.35, t) * (1 - smooth(2.9, 3.2, t));
      tag(cx, objY + r, cx + 40, objY + (h - objY) * 0.36, [
        ["DECISION · t 2", ink(0.55)],
        [c.action, ink(0.95)],
        [c.researchOnly ? "research only · never touches the wheel" : "research_only: FALSE", c.researchOnly ? ink(0.6) : redc],
      ], decA);

      /* INTERVENTION t=3: assignment is not delivery */
      const intA = smooth(2.95, 3.35, t) * (1 - smooth(3.9, 4.2, t));
      tag(mobile ? cx : cx - r, mobile ? objY + r : objY, mobile ? cx : leftX, mobile ? objY + r + 22 : objY - 30, [
        ["INTERVENTION · t 3", ink(0.55)],
        [`assigned ${evTxt(c.assigned)}`, okc],
        [`delivered ${evTxt(c.delivered)}`, ink(0.55)],
        [`received ${evTxt(c.received)}`, ink(0.55)],
        [`adherence ${evTxt(c.adherence)}`, ink(0.55)],
        [`physical control ${c.physical ? "TRUE" : "FALSE"}`, c.physical ? redc : ink(0.75)],
      ], intA, mobile ? "center" : "right");

      /* OUTCOME window 4-10 */
      const [w0, w1] = c.window;
      const outA = smooth(w0 - 0.05, w0 + 0.35, t) * (1 - smooth(w1 + 0.05, w1 + 0.3, t)) * (1 - jsm);
      if (outA > 0.02) {
        const prog = clamp01((t - w0) / (w1 - w0));
        tag(cx + r, objY + 2, rightX, objY + 6, [
          [`OUTCOME WINDOW · t ${w0}-${w1}`, ink(0.55)],
          [`count ${c.count.state === "observed" ? String(c.count.value) : evTxt(c.count)} · ${c.count.state}`, ink(0.95)],
          [`censoring ${c.censoring.replace(/_/g, " ")}`, ink(0.6)],
        ], outA);
        ctx.save(); ctx.globalAlpha = outA;
        const bx = rightX + 6, by = objY + 6 + 3 * (fs + 4) + 2, bwid = mobile ? 96 : 150;
        ctx.fillStyle = ink(0.15); ctx.fillRect(bx, by, bwid, 2);
        ctx.fillStyle = ink(0.8); ctx.fillRect(bx, by, bwid * prog, 2);
        ctx.restore();
      }

      /* EVIDENCE after the window */
      const evdA = smooth(w1 + 0.35, w1 + 0.7, t);
      tag(cx, objY + r, cx + 40, objY + (h - objY) * 0.36, [
        ["EVIDENCE · after t 10", ink(0.55)],
        [`basis ${c.basis.replace(/_/g, " ")} · validity ${c.validity}`, ink(0.95)],
        ["a gap stays a gap", ink(0.6)],
      ], evdA);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- transport ---- */
  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rct = el.getBoundingClientRect();
    progRef.current = clamp01((clientX - rct.left) / rct.width);
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
  const jumpTo = (p: number) => { progRef.current = p; setProg(p); playingRef.current = false; setPlaying(false); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === " " && !(e.target as HTMLElement)?.closest?.("input,textarea")) { e.preventDefault(); togglePlay(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- the beats, at the fixture's own offsets ---- */
  const [w0, w1] = chain.window;
  const beats: Array<{ t: number; label: string; k: string; body: React.ReactNode; kind?: string; jsm?: boolean }> = [
    { t: T0, label: "prelude", k: "THE ENCOUNTER",
      body: <>One person, one vehicle, one automation, one object ahead. What changes is not the world but what is known of it.</> },
    { t: 0, label: "t 0", k: "OBSERVATION", kind: "OBS",
      body: <>Relative speed <b>{evTxt(chain.speed)}</b>, observed. Colour <b>{chain.color.state}</b>: Reiyah will not guess what it never measured.</> },
    { t: 1, label: "t 1", k: "BELIEF", kind: "BEL",
      body: <><b>{chain.p1} relevant</b>, <b>{chain.p2} not</b>. A distribution, never a certainty.</> },
    { t: 2, label: "t 2", k: "DECISION", kind: "DEC",
      body: <><b>{chain.action}</b>{chain.researchOnly ? ", research only" : ""}. It never touches the wheel.</> },
    { t: 3, label: "t 3", k: "INTERVENTION", kind: "INT",
      body: <><b>Assigned</b> is not delivered. Delivery, receipt, adherence: <b>unmeasured</b>, and kept apart.</> },
    { t: w0, label: `t ${w0}-${w1}`, k: "OUTCOME WINDOW", kind: "OUT",
      body: <>Where recoverability, readiness, and the miss that hides all live. Count <b>{chain.count.state === "observed" ? String(chain.count.value) : evTxt(chain.count)}</b>, {chain.censoring.replace(/_/g, " ")}.</> },
    { t: 6.5, label: "the measure", k: "THE JOINT SILENT MISS", jsm: true,
      body: <>Both sightlines leave the <i>same</i> object in the <i>same</i> window, unwarned. Two marginal rates hide it; their dependence reveals it. The one thing Reiyah exists to measure.</> },
    { t: w1, label: `after t ${w1}`, k: "EVIDENCE", kind: "EVD",
      body: <>Basis <b>{chain.basis.replace(/_/g, " ")}</b>, validity <b>{chain.validity}</b>. A gap stays a gap until a gate accepts a result.</> },
  ];
  function beatFor(t: number) {
    let i = 0;
    for (let k = 0; k < beats.length; k++) if (beats[k].t <= t + 1e-4) i = k;
    return i;
  }
  const beat = beats[beatIdx];
  const tNow = tOf(prog);

  return (
    <div className="encounter2">
      <div className="encStage">
        <canvas ref={canvasRef} aria-label="Cinematic scene of one synthetic person-vehicle-automation encounter" />
        <div className="encTag">ST-03 · THE ENCOUNTER · synthetic fixture 001</div>
        <div className="encNonclaim">reiyah records encounters · it does not watch drivers · no performance claim</div>
        <div className="encCaption" key={beatIdx}>
          <div className="encBeatT">{beat.label}</div>
          <h3 className="encBeatK">{beat.k}</h3>
          <p className="encBeatBody">{beat.body}</p>
        </div>
      </div>

      <div className="encScrub">
        <button className="encPlay" onClick={togglePlay} aria-label={playing ? "pause" : "play"} title="space">
          {playing ? "❚❚" : progRef.current >= 0.999 ? "↺" : "▶"}
        </button>
        <div
          className="encTrack" ref={trackRef}
          role="slider" aria-label="encounter clock" aria-valuemin={T0} aria-valuemax={T1}
          aria-valuenow={Math.round(tNow * 10) / 10}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <div className="encTrackFill" style={{ transform: `scaleX(${prog})` }} />
          <div className="encSpan" data-on={String(tNow >= w0)} style={{ left: `${pOf(w0) * 100}%`, width: `${(pOf(w1) - pOf(w0)) * 100}%` }} title={`outcome window ${w0}-${w1} s`} />
          {beats.slice(1).map((b, i) => (
            <button
              key={i} className="encMark" data-on={String(tNow >= b.t - 1e-4)} data-jsm={String(!!b.jsm)}
              style={{ left: `${pOf(b.t) * 100}%` }} title={b.k}
              onPointerDown={(e) => { e.stopPropagation(); jumpTo(pOf(b.t)); }}
            >
              <span className="encMarkL">{b.kind ?? "JSM"}</span>
            </button>
          ))}
          <div className="encHead" style={{ left: `${prog * 100}%` }} />
        </div>
        <div className="encClock">t {tNow < 0 ? "−" : ""}{Math.abs(tNow).toFixed(1)}s</div>
      </div>
    </div>
  );
}
