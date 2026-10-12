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
import { fetchLane, fetchLaneJson, type LaneFile } from "../lib/gateb";
import { Digest, Blocked } from "../components/primitives";
import { useStationReadiness } from "../components/StationFrame";
import { drawCabin, drawWorld } from "../lib/roadScene";
import "../encounter.css";

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
  const requestDraw = useRef<()=>void>(()=>{});
  const [beatIdx, setBeatIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [prog, setProg] = useState(0);
  const [chainStatus, setChainStatus] = useState<"loading"|"ready"|"blocked">("loading");
  const [chainError, setChainError] = useState("");
  useStationReadiness(chainStatus);
  const [chain, setChain] = useState<Chain>(FALLBACK);
  /* the real case: the prepared reference study, read from its committed
     aggregates. The film stays a synthetic fixture until independent human
     judgments exist; this slot says so with the exact counts, never a stand-in. */
  const [study, setStudy] = useState<{ cases: number; scenes: number; judgments: number; frozen: string; file: LaneFile } | { state: "absent"; reason: string } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const lane = await fetchLane();
        if (!lane.present) { if (alive) setStudy({ state: "absent", reason: "lane not present" }); return; }
        const [sel, frz] = await Promise.all([
          fetchLaneJson<{ selected_cases: number; sampled_scenes: number; independent_judgments: number }>("evidence/reference-study/selection-aggregate-0.2.0.json"),
          fetchLaneJson<{ frozen_at_utc: string; independent_judgments_collected: number }>("research/reference-study/0.2.0/freeze.json").catch(() => null),
        ]);
        if (!alive) return;
        setStudy({ cases: sel.data.selected_cases, scenes: sel.data.sampled_scenes, judgments: frz?.data.independent_judgments_collected ?? sel.data.independent_judgments, frozen: frz?.data.frozen_at_utc ?? "", file: sel.file });
      } catch (e) { if (alive) setStudy({ state: "absent", reason: String((e as Error)?.message ?? e) }); }
    })();
    return () => { alive = false; };
  }, []);
  const chainRef = useRef<Chain>(FALLBACK);
  useEffect(() => { chainRef.current = chain; }, [chain]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [obs, bel, dec, itv, out, evd] = await Promise.all(
        ["observation", "belief", "decision", "intervention", "outcome", "evidence"].map((k) => fetchSurface<any>(`chain-${k}`))
      );
      if (!alive) return;
      if ([obs,bel,dec,itv,out,evd].some(s=>s.state !== "observed")) { setChainError("encounter_fixture_unavailable");setChainStatus("blocked");return; }
      const c: Chain = { ...FALLBACK, p1: NaN, p2: NaN, speed:{state:"missing"},count:{state:"missing"},action:"unavailable",window:[NaN,NaN] };
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
        c.window = [w?.start?.offset?.value ?? NaN, w?.end?.offset?.value ?? NaN];
        const m = (out.data.measurements ?? [])[0];
        if (m?.value) c.count = m.value;
        c.censoring = String(out.data.censoring?.state ?? c.censoring);
      }
      if (evd.state === "observed") {
        c.basis = evd.data.basis?.state ?? c.basis;
        c.gap = evd.data.basis?.gap_reason ?? c.gap;
        c.validity = evd.data.validity?.state ?? c.validity;
      }
      if (![c.p1,c.p2,...c.window].every(Number.isFinite) || c.speed.state==="missing" || c.count.state==="missing" || c.action==="unavailable") {setChainError("encounter_fixture_contract_incomplete");setChainStatus("blocked");return;}
      setChain(c);setChainStatus("ready");
    })();
    return () => { alive = false; };
  }, []);

  /* ---- the scene ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    if (reduced) { playingRef.current = false; setPlaying(false); }

    let raf = 0;
    let lastT = performance.now();
    let sync = 0;
    const MONO = '"B612 Mono", Menlo, monospace';

    const wake = () => { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(draw); } };
    requestDraw.current = wake;
    const draw = () => {
      raf = 0;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (document.hidden) return;
      if (playingRef.current && !draggingRef.current) {
        progRef.current += dt / DURATION;
        if (progRef.current >= 1) { progRef.current = 1; playingRef.current = false; setPlaying(false); }
      }
      easedRef.current += (progRef.current - easedRef.current) * (reduced || !playingRef.current ? 1 : 1 - Math.exp(-dt * 9));
      const t = tOf(easedRef.current);
      const c = chainRef.current;
      // A selected, paused stage is a reading state, not a frozen fraction of
      // the transition from the previous record. Playback retains soft fades.
      const reading = reduced || !playingRef.current;
      const currentBeat = beatFor(t);
      const reveal = (beat: number, animated: number) => reading ? Number(currentBeat === beat) : animated;

      const bi = beatFor(tOf(progRef.current));
      if (bi !== lastBeat.current) { lastBeat.current = bi; setBeatIdx(bi); }
      if (now - sync > 60) { sync = now; setProg(progRef.current); }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const wDev = Math.max(1, Math.round(w * dpr)), hDev = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== wDev) canvas.width = wDev;
      if (canvas.height !== hDev) canvas.height = hDev;
      ctx.setTransform(wDev / Math.max(1, w), 0, 0, hDev / Math.max(1, h), 0, 0);
      ctx.clearRect(0, 0, w, h);

      const dark = document.documentElement.dataset.ground === "dark";
      const INK = dark ? "255,255,255" : "16,18,21";
      const RED = dark ? "227,25,55" : "214,23,50";
      const OK = dark ? "126,166,255" : "47,102,214";
      const VOID = dark ? "5,5,7" : "244,243,238";
      // All illustration motion belongs to this encounter clock. A paused
      // frame must not change on theme/viewport redraw or after a hidden tab.
      const s = easedRef.current * DURATION;
      const mobile = w < 560;
      const fs = mobile ? 8 : 9;

      /* ---- ego motion: the road flows, the cabin sways a little ---- */
      const sway = reduced ? 0 : Math.sin(s * 0.55) * 2.2 + Math.sin(s * 1.7) * 0.6;
      const bob = reduced ? 0 : Math.sin(s * 1.1) * 1.1;
      ctx.save();
      ctx.translate(sway, bob);
      /* the composition follows the frame: a portrait phone keeps the horizon
         high, a real dashboard low, and the object large between them */
      const portrait = h > w * 1.05;
      const horizon = portrait ? h * 0.3 : h * 0.38;
      const dash = portrait ? h * 0.20 : h * 0.15;
      const floor = h - dash;
      const cx = w / 2;
      /* the shared world: sky, wet road, edge lines, dashes flowing toward the cabin */
      const travel = reduced ? 0 : s * 0.32;
      drawWorld(ctx, { w, h, dark, horizon, phase: travel % 1, travel, headlight: true, detail: "harbor" });

      // Six depth planes show the record sequence, not six physical distances.
      // Their activation comes only from the fixture clock; unknowns stay in
      // the individual readings below, never converted into a success color.
      const stages: Array<[string, number]> = [["OBS", 0], ["BEL", 1], ["DEC", 2], ["INT", 3], ["OUT", c.window[0]], ["EVD", c.window[1]]];
      let activeStage = -1;
      for (let i = 0; i < stages.length; i++) if (t >= stages[i][1]) activeStage = i;
      ctx.font = `${fs}px ${MONO}`; ctx.textAlign = "left";
      for (let i = 0; i < stages.length; i++) {
        const p = 0.16 + i * 0.14, y = horizon + (floor - horizon) * p * p;
        const f = (y - horizon) / (h - horizon), half = w * 0.64 * f * 0.82;
        const active = i === activeStage;
        ctx.strokeStyle = `rgba(${active ? OK : INK},${active ? 0.46 : dark ? 0.08 : 0.12})`;
        ctx.lineWidth = active ? 1.3 : 0.7;
        ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.stroke();
        const tx = i % 2 === 0 ? Math.min(w * 0.89 - 24, cx + half + 7) : Math.max(w * 0.11, cx - half - 31);
        if (!dark) { ctx.fillStyle = "rgba(244,245,236,0.78)"; ctx.fillRect(tx - 3, y - 6, 27, fs + 4); }
        ctx.fillStyle = `rgba(${active ? OK : INK},${dark ? active ? 0.94 : 0.50 : 0.94})`;
        ctx.fillText(stages[i][0], tx, y + 2);
      }

      /* ---- the object: holds station (relative speed observed 0) ---- */
      const objY = horizon + (floor - horizon) * (portrait ? 0.4 : 0.34);
      const r = Math.round(Math.max(12, Math.min(30, w * (portrait ? 0.047 : 0.023))));
      const seen = 0.28 + 0.72 * (reading ? Number(t >= 0) : smooth(-0.2, 0.15, t)); // fixture object exists in the prelude; channel lock begins at t=0
      ctx.restore();

      /* the cabin never sways: the camera sits in it */
      drawCabin(ctx, w, h, dark, w * (portrait ? 0.075 : 0.06), dash, true);

      /* ---- the two channels, in the language of the field: the human's
         attention is a soft field of light resting on the scene; the
         automation's detection is the lock on the object; the joint miss is
         one red ring, when the field has drifted and the lock has dropped ---- */
      const coneOn = reading ? Number(t >= 0) : smooth(-0.4, 0.4, t);
      const jsm = reveal(6, smooth(6.3, 6.9, t) * (1 - smooth(9.0, 9.6, t))); // both leave the object at once
      const wander = reduced ? 0 : Math.sin(s * 0.55) * w * 0.03;
      const wanderY = reduced ? 0 : Math.sin(s * 0.9 + 1) * h * 0.015;
      const gazeX = cx + wander + (-w * (portrait ? 0.24 : 0.3) - wander) * jsm;
      const gazeY = objY + wanderY + jsm * (floor - objY) * 0.3;
      const gr = portrait ? w * 0.19 : Math.max(60, w * 0.09);
      const FIELD = dark ? INK : OK;
      if (coneOn > 0.01) {
        const fa = (dark ? 0.24 : 0.16) * coneOn;
        const fg = ctx.createRadialGradient(gazeX, gazeY, 0, gazeX, gazeY, gr);
        fg.addColorStop(0, `rgba(${FIELD},${fa.toFixed(3)})`); fg.addColorStop(0.45, `rgba(${FIELD},${(fa * 0.45).toFixed(3)})`); fg.addColorStop(1, `rgba(${FIELD},0)`);
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(gazeX, gazeY, gr, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(${INK},${(0.6 * coneOn).toFixed(2)})`; ctx.font = `${fs}px ${MONO}`; ctx.textAlign = "center";
        ctx.fillText("HUMAN · attention", gazeX, Math.max(horizon + 12, gazeY - gr * 0.55 - (jsm < 0.1 ? fs + 6 : 0)));
      }
      /* the automation's scan: one thin line sweeps the road, lidar-like */
      if (!reduced && coneOn > 0.5) {
        const sp = (s * 0.42) % 1, sy = horizon + (floor - horizon) * sp * sp;
        ctx.strokeStyle = `rgba(${OK},${(0.16 * (1 - sp)).toFixed(3)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - w * 0.5 * sp - 20, sy); ctx.lineTo(cx + w * 0.5 * sp + 20, sy); ctx.stroke();
      }
      const lockA = coneOn * (1 - jsm);

      /* ---- the joint blind: neither channel holds the object ---- */
      if (jsm > 0.02) {
        const rr = r + 9 + (reduced ? 0 : Math.sin(s * 2) * 1.5);
        const grd = ctx.createRadialGradient(cx, objY, r, cx, objY, r + 44);
        grd.addColorStop(0, `rgba(${RED},${(0.22 * jsm).toFixed(3)})`); grd.addColorStop(1, `rgba(${RED},0)`);
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, objY, r + 44, 0, TAU); ctx.fill();
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = `rgba(${RED},${(0.9 * jsm).toFixed(3)})`; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(cx, objY, rr, 0, TAU); ctx.stroke(); ctx.restore();
        ctx.fillStyle = `rgba(${RED},${(0.95 * jsm).toFixed(3)})`; ctx.font = `${fs}px ${MONO}`; ctx.textAlign = "center";
        const jy = objY + (floor - objY) * (portrait ? 0.34 : 0.42);
        ctx.fillText("JOINT BLIND", cx, jy);
        ctx.fillStyle = `rgba(${INK},${(0.55 * jsm).toFixed(3)})`;
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
        /* its shadow and its reflection on the wet road: it has weight */
        ctx.save(); ctx.translate(cx, objY + r * 1.1); ctx.scale(1, 0.32);
        const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
        sg.addColorStop(0, `rgba(${dark ? "0,0,0" : "16,18,21"},${dark ? 0.55 : 0.18})`); sg.addColorStop(1, `rgba(0,0,0,0)`);
        ctx.fillStyle = sg; ctx.fillRect(-r * 2.6, -r * 2.6, r * 5.2, r * 5.2); ctx.restore();
        for (let band = 0; band < 7; band++) {
          const rw = r * (1.7 - band * 0.12);
          ctx.fillStyle = `rgba(${INK},${(dark ? 0.085 : 0.045) * (1 - band / 7)})`;
          ctx.fillRect(cx - rw / 2 + Math.sin(band * 2.3) * r * 0.12, objY + r * (1.3 + band * 0.34), rw, Math.max(0.5, r * 0.06));
        }
        /* A dimensional abstract cuboid, never a guessed car or pedestrian.
           Its neutral material is presentation; fixture color is unmeasured. */
        const fw = r * 1.15, fh = r * 0.95, kq = 0.72;
        const bx = cx + fw * 0.46, by = objY - (objY - horizon) * (1 - kq) * 0.5;
        const F = [[cx - fw, objY - fh], [cx + fw, objY - fh], [cx + fw, objY + fh], [cx - fw, objY + fh]];
        const B = [[bx - fw * kq, by - fh * kq], [bx + fw * kq, by - fh * kq], [bx + fw * kq, by + fh * kq], [bx - fw * kq, by + fh * kq]];
        const face = (points: number[][], color: string | CanvasGradient) => {
          ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
          for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill();
        };
        const topMaterial = ctx.createLinearGradient(cx - fw, by - fh, cx + fw, objY);
        topMaterial.addColorStop(0, dark ? "#9baeb7" : "#edf1ed"); topMaterial.addColorStop(1, dark ? "#3c5665" : "#a8babd");
        face([B[0], B[1], F[1], F[0]], topMaterial);
        face([B[1], B[2], F[2], F[1]], dark ? "#253744" : "#84999e");
        const frontMaterial = ctx.createLinearGradient(cx - fw, objY - fh, cx + fw, objY + fh);
        frontMaterial.addColorStop(0, dark ? "#506a7b" : "#d7e1de"); frontMaterial.addColorStop(1, dark ? "#15242e" : "#99aeaf");
        face(F, frontMaterial);
        ctx.strokeStyle = `rgba(${INK},0.42)`; ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { ctx.moveTo(B[i][0], B[i][1]); ctx.lineTo(B[(i + 1) % 4][0], B[(i + 1) % 4][1]); ctx.moveTo(F[i][0], F[i][1]); ctx.lineTo(B[i][0], B[i][1]); }
        ctx.stroke();
        ctx.strokeStyle = `rgba(${INK},0.9)`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(cx - fw, objY - fh, fw * 2, fh * 2); ctx.stroke();
        ctx.fillStyle = `rgba(${INK},0.75)`; ctx.beginPath(); ctx.arc(cx, objY, 1.8, 0, TAU); ctx.fill();
        /* the lock: the automation holds the object; it drops in the joint blind */
        const b = r + 7, k = 5;
        ctx.strokeStyle = `rgba(${INK},${(0.7 * lockA).toFixed(2)})`; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - b, objY - b + k); ctx.lineTo(cx - b, objY - b); ctx.lineTo(cx - b + k, objY - b);
        ctx.moveTo(cx + b - k, objY - b); ctx.lineTo(cx + b, objY - b); ctx.lineTo(cx + b, objY - b + k);
        ctx.moveTo(cx + b, objY + b - k); ctx.lineTo(cx + b, objY + b); ctx.lineTo(cx + b - k, objY + b);
        ctx.moveTo(cx - b + k, objY + b); ctx.lineTo(cx - b, objY + b); ctx.lineTo(cx - b, objY + b - k);
        ctx.stroke();
        if (lockA > 0.05) { ctx.fillStyle = `rgba(${INK},${(0.55 * lockA).toFixed(2)})`; ctx.font = `${fs}px ${MONO}`; ctx.textAlign = "center"; ctx.fillText("AUTOMATION · lock", cx, objY - b - 6); }
        ctx.globalAlpha = 1;
      }

      /* ---- diegetic tags: anchored to the object with a leader line ---- */
      const tag = (ax: number, ay: number, tx: number, ty: number, lines: Array<[string, string]>, alpha: number, align: CanvasTextAlign = "left") => {
        if (alpha <= 0.02) return;
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.font = `${fs}px ${MONO}`; ctx.textAlign = align;
        const lh = fs + 4;
        const off = align === "left" ? 6 : align === "right" ? -6 : 0;
        /* a ground plate under the text: the scene never fights the words */
        const wid = Math.max(...lines.map(([txt]) => ctx.measureText(txt).width));
        /* the tag stays inside the frame whatever the phone's width */
        if (align === "left") tx = Math.min(tx, w - 10 - wid - off);
        if (align === "right") tx = Math.max(tx, 10 + wid - off);
        ty = Math.max(fs + 12, Math.min(ty, h - 12 - lines.length * lh));
        ctx.strokeStyle = `rgba(${INK},0.35)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = `rgba(${INK},0.6)`; ctx.beginPath(); ctx.arc(ax, ay, 1.6, 0, TAU); ctx.fill();
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
      const obsA = reveal(1, smooth(-0.05, 0.35, t) * (1 - smooth(0.85, 1.15, t)));
      tag(cx + r, objY - 2, rightX, objY - 22, [
        ["OBSERVATION · t 0", ink(0.55)],
        [`rel speed ${evTxt(c.speed)} · ${c.speed.state}`, ink(0.95)],
        [`colour ${evTxt(c.color)}`, ink(0.6)],
      ], obsA);

      /* BELIEF t=1: the quantile dot plot, countable probability */
      const belA = reveal(2, smooth(0.95, 1.35, t) * (1 - smooth(1.9, 2.2, t)));
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
        const beliefLabels = [`BELIEF · t 1 · relevant ${c.p1.toFixed(2)}`, `${filled} of 20 · not relevant ${c.p2.toFixed(2)}`];
        const labelX = Math.min(ox, w - 12 - Math.max(...beliefLabels.map(txt => ctx.measureText(txt).width)));
        beliefLabels.forEach((txt, i) => ctx.fillText(txt, labelX, oy + 5 * (dot + gap) + 2 + i * (fs + 4)));
        ctx.restore();
      }

      /* DECISION t=2 */
      const decA = reveal(3, smooth(1.95, 2.35, t) * (1 - smooth(2.9, 3.2, t)));
      tag(cx, objY + r, cx + 40, objY + (floor - objY) * 0.36, [
        ["DECISION · t 2", ink(0.55)],
        [c.action, ink(0.95)],
        [c.researchOnly ? "research only · never touches the wheel" : "research_only: FALSE", c.researchOnly ? ink(0.6) : redc],
      ], decA);

      /* INTERVENTION t=3: assignment is not delivery */
      const intA = reveal(4, smooth(2.95, 3.35, t) * (1 - smooth(3.9, 4.2, t)));
      tag(mobile ? cx : cx - r, mobile ? objY + r : objY, mobile ? cx : leftX, mobile ? objY + r + 26 : objY - 30, [
        ["INTERVENTION · t 3", ink(0.55)],
        [`assigned ${evTxt(c.assigned)}`, okc],
        [`delivered ${evTxt(c.delivered)}`, ink(0.55)],
        [`received ${evTxt(c.received)}`, ink(0.55)],
        [`adherence ${evTxt(c.adherence)}`, ink(0.55)],
        [`physical control ${c.physical ? "TRUE" : "FALSE"}`, c.physical ? redc : ink(0.75)],
      ], intA, mobile ? "center" : "right");

      /* OUTCOME window 4-10 */
      const [w0, w1] = c.window;
      const outA = reveal(5, smooth(w0 - 0.05, w0 + 0.35, t) * (1 - smooth(w1 + 0.05, w1 + 0.3, t)) * (1 - jsm));
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
      const evdA = reveal(7, smooth(w1 + 0.35, w1 + 0.7, t));
      tag(cx, objY + r, cx + 40, objY + (floor - objY) * 0.36, [
        ["EVIDENCE · after t 10", ink(0.55)],
        [`basis ${c.basis.replace(/_/g, " ")} · validity ${c.validity}`, ink(0.95)],
        ["a gap stays a gap", ink(0.6)],
      ], evdA);

      if (!document.hidden && (playingRef.current || draggingRef.current || Math.abs(progRef.current-easedRef.current)>0.0001)) wake();
    };
    const motionChange=()=>{reduced=motion.matches;if(reduced){playingRef.current=false;setPlaying(false);}wake();};
    const ro=new ResizeObserver(wake);ro.observe(canvas);
    const mo=new MutationObserver(wake);mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-ground"]});
    document.addEventListener("visibilitychange",wake);motion.addEventListener("change",motionChange);
    draw();
    return () => { cancelAnimationFrame(raf);requestDraw.current=()=>{};ro.disconnect();mo.disconnect();document.removeEventListener("visibilitychange",wake);motion.removeEventListener("change",motionChange); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainStatus]);

  /* ---- transport ---- */
  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rct = el.getBoundingClientRect();
    progRef.current = clamp01((clientX - rct.left) / rct.width);
    easedRef.current = progRef.current;
    setProg(progRef.current);requestDraw.current();
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
    else if (playingRef.current) progRef.current = easedRef.current;
    easedRef.current = progRef.current;
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);setProg(progRef.current);requestDraw.current();
  };
  const jumpTo = (p: number) => { progRef.current = p; easedRef.current = p; setProg(p); playingRef.current = false; setPlaying(false); requestDraw.current(); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === " " && !(e.target as HTMLElement)?.closest?.("input,textarea,button,[role=slider]")) { e.preventDefault(); togglePlay(); } };
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
      body: <>Both sightlines leave the <i>same</i> object in the <i>same</i> window. This illustrates a research target; a joint silent miss was <b>not measured in this fixture</b>.</> },
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

  if (chainStatus === "blocked") return <Blocked reason={chainError}/>;
  if (chainStatus === "loading") return <p role="status">Reading the synthetic fixture…</p>;
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
        <button className="encPlay" onClick={togglePlay} aria-label={playing ? "Pause encounter" : progRef.current >= 0.999 ? "Replay encounter" : "Play encounter"} aria-pressed={playing} title="Space · play or pause">
          <svg viewBox="0 0 24 24" aria-hidden="true">{playing ? <><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></> : progRef.current >= 0.999 ? <path d="M6.8 6.8A7.3 7.3 0 1 1 5 14H3a9.3 9.3 0 1 0 2.4-8.6L2 2v8h8z" /> : <path d="m8 5 11 7-11 7z" />}</svg>
        </button>
        <div
          className="encTrack" ref={trackRef}
          role="slider" tabIndex={0} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();e.stopPropagation();jumpTo(e.key==="Home"?0:e.key==="End"?1:clamp01(progRef.current+(e.key==="ArrowRight"?.025:-.025)));}}} aria-label="encounter clock" aria-valuemin={T0} aria-valuemax={T1}
          aria-valuenow={Math.round(tNow * 10) / 10}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <div className="encTrackFill" style={{ transform: `scaleX(${prog})` }} />
          <div className="encSpan" data-on={String(tNow >= w0)} style={{ left: `${pOf(w0) * 100}%`, width: `${(pOf(w1) - pOf(w0)) * 100}%` }} title={`outcome window ${w0}-${w1} s`} />
          {beats.slice(1).map((b, i) => <span key={i} className="encMark" data-on={String(tNow >= b.t - 1e-4)} data-jsm={String(!!b.jsm)} style={{ left: `${pOf(b.t) * 100}%` }} aria-hidden="true" />)}
          <div className="encHead" style={{ left: `${prog * 100}%` }} />
        </div>
        <div className="encClock">t {tNow < 0 ? "−" : ""}{Math.abs(tNow).toFixed(1)}s</div>
      </div>
      <nav className="encJourney" aria-label="Encounter stages">
        {beats.slice(1).map((b, i) => <button key={b.k} onClick={() => jumpTo(pOf(b.t))} aria-label={`${b.k} · ${b.label}`} aria-current={beatIdx === i + 1 ? "step" : undefined} data-jsm={String(!!b.jsm)}><span>{b.kind ?? "JSM"}</span><small>{b.label}</small></button>)}
      </nav>
      <div className="encReal" aria-label="the real case">
        <span className="encRealK">the real case</span>
        {study && !("state" in study) ? (
          <span className="encRealV">
            <b>{study.judgments.toLocaleString("en-US")}</b> independent judgments · {study.cases.toLocaleString("en-US")} cases prepared across {study.scenes} scenes · this film stays the synthetic fixture until two blinded reviews exist · <Digest id={`gateb/${study.file.id}`} sha={study.file.sha256 ?? ""} path={`gate-b · ${study.file.path}`} />
          </span>
        ) : study ? <span className="encRealV">reference study aggregates not present in this source · {study.reason}</span> : <span className="encRealV">reading the study…</span>}
      </div>
    </div>
  );
}
