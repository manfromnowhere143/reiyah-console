/* The Harbor engine — the living-diagram simulation and render, extracted from
   the component into a pure module with no DOM or window references. Every
   per-frame input arrives through `env` (size, dpr, theme, reduced-motion) or
   the input setters (pointer, pulse, rejection-rule map). The same engine runs
   in a Web Worker over an OffscreenCanvas (main thread freed) and, where that
   is unsupported, directly on the main thread as a byte-identical fallback.
   The drawing logic below is a faithful copy of the original component loop. */

export interface ArtifactRow {
  artifact: { path: string; sha256: string };
  byte_size: number;
  role: string;
}

export interface HarborEnv {
  w: number;      // CSS pixels
  h: number;
  dpr: number;
  dark: boolean;
  reduced: boolean;
  /* "canvas": the engine applies its own 2D bloom + vignette (fallback path).
     "none": a downstream GPU pass owns bloom/dispersion/vignette, so the engine
     emits the raw scene. Defaults to "canvas". */
  post?: "canvas" | "none";
}

/* Either a real canvas (main thread) or an OffscreenCanvas (worker). */
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type MakeCanvas = (w: number, h: number) => AnyCanvas;

const TAU = Math.PI * 2;
const KINDS = ["OBS", "BEL", "DEC", "INT", "OUT", "EVD"];

interface Packet {
  a: ArtifactRow;
  t: number;
  speed: number;
  bad: boolean;
  fall: number;
  fx?: number; fy?: number; vx?: number; vy?: number;
  stamp: number;
  lane: number;
  mass: number;   // 0..1, the artifact's real byte size, log-scaled
}
interface Spark { x: number; y: number; life: number }

export interface HarborEngine {
  frame(now: number, env: HarborEnv): void;
  setMouse(x: number, y: number, over: boolean): void;
  setPulse(at: number): void;
  setRuleMap(map: Record<string, string>): void;
}

export function createHarborEngine(
  output: AnyCanvas,
  artifacts: ArtifactRow[],
  badTotal: number,
  makeCanvas: MakeCanvas,
): HarborEngine {
  /* Two internal layers — a persistent trail buffer and a per-frame crisp
     layer — are composited onto `output` each frame. `output` is the visible
     canvas (2D fallback) or an internal scene buffer the GPU pass reads. */
  const trailCv = makeCanvas(2, 2);
  const mainCv = makeCanvas(2, 2);
  const tctx = trailCv.getContext("2d") as Ctx;
  const mctx = mainCv.getContext("2d") as Ctx;
  const octx = output.getContext("2d") as Ctx;

  const mono = '11px "B612 Mono","SF Mono",Menlo,monospace';
  const monoSmall = '9px "B612 Mono","SF Mono",Menlo,monospace';

  let spawnIdx = 0, sealed = 0, spawnAcc = 0, blink = 0;
  let timeScale = 1;
  const packets: Packet[] = [];
  const sparks: Spark[] = [];
  const nodeGlow = [0, 0, 0, 0, 0, 0];
  const pupil = { x: 0, y: 0 };
  const mouse = { x: -1, y: -1, over: false };
  const par = { x: 0, y: 0 };

  let pulseAt = 0;
  let ruleMap: Record<string, string> = {};
  let lastReject: { rule: string; at: number } | null = null;

  /* the real byte size of each artifact, log-scaled to 0..1 — drives packet
     mass so a heavier record visibly carries more weight. Committed data. */
  let lmin = Infinity, lmax = -Infinity;
  for (const a of artifacts) { const l = Math.log(Math.max(1, a.byte_size || 1)); if (l < lmin) lmin = l; if (l > lmax) lmax = l; }
  const massOf = (b: number) => (lmax > lmin ? (Math.log(Math.max(1, b || 1)) - lmin) / (lmax - lmin) : 0.5);

  const spawn = () => {
    const a = artifacts[spawnIdx % artifacts.length];
    spawnIdx++;
    const hh = parseInt(a.artifact.sha256.slice(9, 13), 16) / 0xffff;
    packets.push({
      a, t: 0, speed: 0.085 + hh * 0.05,
      bad: a.role === "known_bad_fixture",
      fall: 0, stamp: 0, lane: (hh - 0.5) * 2,
      mass: massOf(a.byte_size),
    });
  };
  for (let i = 0; i < 6; i++) { spawn(); packets[i].t = i * 0.15; }

  let ghost: AnyCanvas | null = null;
  let ghostKey = "";
  const buildGhost = (w: number, h: number, dpr: number, ink: string) => {
    ghost = makeCanvas(w * dpr, h * dpr);
    const g = ghost.getContext("2d") as Ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const a of artifacts) {
      const hex = a.artifact.sha256.slice(9);
      const x = (parseInt(hex.slice(0, 5), 16) / 0xfffff) * w;
      const y = (parseInt(hex.slice(5, 10), 16) / 0xfffff) * h;
      g.fillStyle = `rgba(${ink},${a.role === "known_bad_fixture" ? 0.028 : 0.055})`;
      g.beginPath(); g.arc(x, y, 1, 0, TAU); g.fill();
    }
  };

  let last = 0;
  let started = false;

  const frame = (now: number, env: HarborEnv) => {
    if (!started) { last = now; started = true; }
    const rdt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const { dpr, dark, reduced } = env;
    const post = env.post ?? "canvas";
    const w = env.w, h = env.h;
    for (const cv of [trailCv, mainCv, output]) {
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    }
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const INK = dark ? "255,255,255" : "16,18,21";
    const RED = dark ? "227,25,55" : "214,23,50";
    const OK = dark ? "143,208,176" : "23,114,76";
    const FADE = dark ? "rgba(10,11,14,0.22)" : "rgba(236,234,226,0.24)";
    const TA = dark ? "0.96" : "0.8";
    const surge = !!pulseAt && now - pulseAt < 2000;
    const portrait = h > w * 1.05;

    timeScale += ((mouse.over ? 0.28 : 1) - timeScale) * Math.min(1, rdt * 6);
    const dt = rdt * (reduced ? 0 : timeScale) * (surge ? 2 : 1);

    /* damped parallax — the scene has depth; motion has inertia, never 1:1 */
    const MP = Math.min(w, h) * 0.018;
    const ptx = mouse.over && !reduced ? -((mouse.x / w) - 0.5) * 2 * MP : 0;
    const pty = mouse.over && !reduced ? -((mouse.y / h) - 0.5) * 2 * MP : 0;
    par.x += (ptx - par.x) * Math.min(1, rdt * 3);
    par.y += (pty - par.y) * Math.min(1, rdt * 3);

    /* ---- orientation-aware rail ---- */
    let railPt: (t: number) => { x: number; y: number };
    let tEye: number, tChain0: number, tChain1: number, tGate: number;
    if (!portrait) {
      const midY = h * 0.46, dip = h * 0.075;
      const x0 = w * 0.06, x2 = w * 0.9;
      railPt = (t) => ({
        x: x0 + (x2 - x0) * t,
        y: (1 - t) * (1 - t) * midY + 2 * (1 - t) * t * (midY + dip) + t * t * midY,
      });
      tEye = 0.18; tChain0 = 0.30; tChain1 = 0.62; tGate = 0.74;
    } else {
      const cx = w * 0.42, dipX = w * 0.11;
      const y0 = h * 0.06, y2 = h * 0.82;
      railPt = (t) => ({
        x: (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * (cx + dipX) + t * t * cx,
        y: y0 + (y2 - y0) * t,
      });
      tEye = 0.16; tChain0 = 0.30; tChain1 = 0.60; tGate = 0.74;
    }
    const eyeP = railPt(tEye), gateP = railPt(tGate);

    const key = `${w}x${h}x${dpr}x${dark}`;
    if (key !== ghostKey) { buildGhost(w, h, dpr, INK); ghostKey = key; }

    /* ============ TRAIL LAYER ============ */
    tctx.fillStyle = FADE;
    tctx.fillRect(0, 0, w, h);
    if (reduced) tctx.clearRect(0, 0, w, h);

    spawnAcc += dt * 1.15;
    if (!reduced && spawnAcc > 0.5 && packets.length < 30) { spawnAcc = 0; spawn(); }
    let leading: Packet | null = null;
    let hovered: { p: Packet; x: number; y: number } | null = null;

    tctx.save();
    tctx.translate(par.x, par.y);
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      if (p.fall > 0 || (p.bad && p.t >= tGate)) {
        if (p.fall === 0) {
          sparks.push({ x: gateP.x, y: gateP.y, life: 1 });
          const rule = ruleMap[p.a.artifact.path];
          if (rule) lastReject = { rule, at: now };
          p.fx = gateP.x; p.fy = gateP.y;
          if (portrait) { p.vx = 90 + Math.random() * 60; p.vy = 30; }
          else { p.vx = 30 + Math.random() * 30; p.vy = 40; }
        }
        p.fall += dt * 1.4;
        p.vy! += (portrait ? 420 : 640) * dt;
        p.fx! += p.vx! * dt; p.fy! += p.vy! * dt;
        const fa = Math.max(0, 1 - p.fall * 0.8);
        tctx.fillStyle = `rgba(${RED},${(0.9 * fa).toFixed(2)})`;
        tctx.beginPath(); tctx.arc(p.fx!, p.fy!, 2.8, 0, TAU); tctx.fill();
        if (p.fy! > h + 10 || p.fx! > w + 10 || p.fall > 1.8) packets.splice(i, 1);
        continue;
      }
      p.t += dt * p.speed;
      if (p.t >= 1) { sealed++; packets.splice(i, 1); continue; }
      const pt = railPt(p.t);
      const jx = portrait ? Math.sin(p.t * 30) * 2 * p.lane : 0;
      const jy = portrait ? 0 : Math.sin(p.t * 30) * 2 * p.lane;
      const x = pt.x + jx, y = pt.y + jy;
      for (let k = 0; k < 6; k++) {
        const tN = tChain0 + (k / 5) * (tChain1 - tChain0);
        if (Math.abs(p.t - tN) < 0.006) nodeGlow[k] = 1;
      }
      if (Math.abs(p.t - tGate) < 0.012 && !p.bad) p.stamp = 1;
      p.stamp = Math.max(0, p.stamp - dt * 2.2);
      const rgb = p.stamp > 0 ? OK : p.bad ? INK : INK;
      /* size carries the artifact's real byte mass */
      const coreR = (p.bad ? 2.1 : 2.6) * (0.72 + p.mass * 0.9);
      /* comet: additive halo on obsidian, then the bright core */
      if (dark) {
        tctx.globalCompositeOperation = "lighter";
        tctx.fillStyle = `rgba(${p.stamp > 0 ? OK : p.bad ? "120,120,124" : "200,205,212"},${p.bad ? 0.1 : 0.22})`;
        tctx.beginPath(); tctx.arc(x, y, coreR * 3.2, 0, TAU); tctx.fill();
        tctx.globalCompositeOperation = "source-over";
      }
      tctx.fillStyle = `rgba(${rgb},${p.stamp > 0 ? 0.98 : p.bad ? 0.42 : 0.9})`;
      tctx.beginPath(); tctx.arc(x, y, coreR, 0, TAU); tctx.fill();
      if (!leading || p.t > leading.t) leading = p;
      if (mouse.over) {
        const d = Math.hypot(mouse.x - x, mouse.y - y);
        if (d < 26 && (!hovered || d < Math.hypot(mouse.x - hovered.x, mouse.y - hovered.y))) {
          hovered = { p, x, y };
        }
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt * 2.4;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      tctx.strokeStyle = `rgba(${RED},${(s.life * 0.8).toFixed(2)})`;
      tctx.lineWidth = 1.5;
      tctx.beginPath(); tctx.arc(s.x, s.y, (1 - s.life) * 22 + 4, 0, TAU); tctx.stroke();
    }
    tctx.restore();

    /* ============ CRISP LAYER ============ */
    mctx.clearRect(0, 0, w, h);

    /* soft radial glow — cheap bloom, depth without spectacle */
    const glow = (gx: number, gy: number, gr: number, rgb: string, a: number) => {
      const g = mctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      mctx.fillStyle = g;
      mctx.beginPath(); mctx.arc(gx, gy, gr, 0, TAU); mctx.fill();
    };

    /* the far layer: the ghost population moves less — depth by parallax */
    if (ghost) mctx.drawImage(ghost as CanvasImageSource, par.x * 0.35, par.y * 0.35, w, h);

    /* the scene rides the near parallax layer */
    mctx.save();
    mctx.translate(par.x, par.y);

    const breath = reduced ? 1 : 0.85 + 0.15 * Math.sin(now / 1400);
    if (dark) {
      glow(eyeP.x, eyeP.y, Math.min(w, h) * 0.32, INK, 0.05 * breath);
      glow(eyeP.x, eyeP.y, Math.min(w, h) * 0.15, RED, 0.05 * breath);
      glow(gateP.x, gateP.y, Math.min(w, h) * 0.26, INK, 0.045);
    } else {
      glow(eyeP.x, eyeP.y, Math.min(w, h) * 0.3, INK, 0.03 * breath);
      glow(gateP.x, gateP.y, Math.min(w, h) * 0.24, INK, 0.028);
    }

    /* the rail: a luminous cable with a faint under-glow */
    mctx.strokeStyle = `rgba(${INK},${dark ? 0.22 : 0.16})`;
    mctx.lineWidth = 1;
    const r0 = railPt(0), r1 = railPt(1);
    mctx.beginPath();
    if (!portrait) {
      mctx.moveTo(r0.x, r0.y);
      mctx.quadraticCurveTo((r0.x + r1.x) / 2, h * 0.46 + h * 0.15, r1.x, r1.y);
    } else {
      mctx.moveTo(r0.x, r0.y);
      mctx.quadraticCurveTo(w * 0.42 + w * 0.22, (r0.y + r1.y) / 2, r1.x, r1.y);
    }
    mctx.stroke();

    mctx.font = monoSmall;

    /* encounter */
    mctx.strokeStyle = `rgba(${INK},0.45)`; mctx.lineWidth = 1.2;
    if (!portrait) {
      mctx.textAlign = "center";
      mctx.beginPath();
      mctx.moveTo(r0.x - 22, r0.y + 38); mctx.lineTo(r0.x - 6, r0.y - 26);
      mctx.moveTo(r0.x + 22, r0.y + 38); mctx.lineTo(r0.x + 6, r0.y - 26);
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(r0.x, r0.y - 45); mctx.lineTo(r0.x + 7, r0.y - 38);
      mctx.lineTo(r0.x, r0.y - 31); mctx.lineTo(r0.x - 7, r0.y - 38);
      mctx.closePath(); mctx.stroke();
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.fillText("ENCOUNTER", r0.x, r0.y + 58);
    } else {
      mctx.beginPath();
      mctx.moveTo(r0.x - 26, r0.y - 7); mctx.lineTo(r0.x - 8, r0.y);
      mctx.moveTo(r0.x - 26, r0.y + 7); mctx.lineTo(r0.x - 8, r0.y);
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(r0.x - 36, r0.y - 6); mctx.lineTo(r0.x - 30, r0.y);
      mctx.lineTo(r0.x - 36, r0.y + 6); mctx.lineTo(r0.x - 42, r0.y);
      mctx.closePath(); mctx.stroke();
      mctx.textAlign = "left";
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.fillText("ENCOUNTER", r0.x + 14, r0.y + 3);
    }

    /* the eye */
    blink = Math.max(0, blink - rdt);
    if (!reduced && Math.random() < rdt / 7) blink = 0.16;
    const eyeR = portrait ? Math.min(22, w * 0.055) : Math.min(30, w * 0.024);
    let target = { x: Math.cos(-TAU / 8) * eyeR * 0.18, y: Math.sin(-TAU / 8) * eyeR * 0.18 };
    let bestD = Infinity;
    for (const p of packets) {
      if (p.fall > 0 || p.t > tEye + 0.06) continue;
      const pt = railPt(p.t);
      const d = tEye - p.t;
      if (d >= 0 && d < bestD) {
        bestD = d;
        const ang = Math.atan2(pt.y - eyeP.y, pt.x - eyeP.x);
        target = { x: Math.cos(ang) * eyeR * 0.22, y: Math.sin(ang) * eyeR * 0.22 };
      }
    }
    pupil.x += (target.x - pupil.x) * Math.min(1, rdt * 14);
    pupil.y += (target.y - pupil.y) * Math.min(1, rdt * 14);
    mctx.save();
    mctx.translate(eyeP.x, eyeP.y);
    mctx.scale(1, blink > 0 ? Math.max(0.1, 1 - blink * 6) : 1);
    mctx.strokeStyle = `rgba(${INK},0.94)`;
    mctx.lineWidth = Math.max(3, eyeR * 0.24);
    mctx.lineCap = "round";
    mctx.beginPath();
    mctx.arc(0, 0, eyeR, -TAU / 8 + (25 * Math.PI) / 180, -TAU / 8 - (25 * Math.PI) / 180 + TAU);
    mctx.stroke();
    const pr = eyeR * 0.3 * (surge ? 1.25 : 1);
    const em = surge ? 1 : 0.62;
    if (dark) {
      mctx.globalCompositeOperation = "lighter";
      glow(pupil.x, pupil.y, pr * 6.5, RED, 0.16 * em);
      glow(pupil.x, pupil.y, pr * 2.7, RED, 0.4 * em);
      const sw = eyeR * (surge ? 7.5 : 4.4);
      const sg = mctx.createLinearGradient(pupil.x - sw, 0, pupil.x + sw, 0);
      sg.addColorStop(0, `rgba(${RED},0)`);
      sg.addColorStop(0.5, `rgba(${RED},${(0.5 * em).toFixed(3)})`);
      sg.addColorStop(1, `rgba(${RED},0)`);
      mctx.fillStyle = sg;
      const sh = 0.8 + em * 0.9;
      mctx.fillRect(pupil.x - sw, pupil.y - sh, sw * 2, sh * 2);
      mctx.globalCompositeOperation = "source-over";
    } else {
      glow(pupil.x, pupil.y, pr * 3.6, RED, 0.28 * em);
    }
    mctx.fillStyle = `rgba(${RED},0.98)`;
    mctx.beginPath(); mctx.arc(pupil.x, pupil.y, pr, 0, TAU); mctx.fill();
    mctx.restore();
    mctx.fillStyle = `rgba(${INK},${TA})`;
    if (!portrait) {
      mctx.textAlign = "center";
      mctx.fillText("REIYAH SEES", eyeP.x, eyeP.y + eyeR + 26);
    } else {
      mctx.textAlign = "left";
      mctx.fillText("REIYAH SEES", eyeP.x + eyeR + 12, eyeP.y + 3);
    }

    /* six kinds */
    for (let k = 0; k < 6; k++) {
      const tN = tChain0 + (k / 5) * (tChain1 - tChain0);
      const pN = railPt(tN);
      nodeGlow[k] = Math.max(0, nodeGlow[k] - rdt * 2.4);
      const gGlow = nodeGlow[k];
      mctx.strokeStyle = `rgba(${INK},${(0.45 + gGlow * 0.55).toFixed(2)})`;
      mctx.lineWidth = 1.2 + gGlow;
      mctx.beginPath(); mctx.arc(pN.x, pN.y, (portrait ? 4.5 : 5.5) + gGlow * 2.5, 0, TAU); mctx.stroke();
      mctx.fillStyle = `rgba(${INK},${TA})`;
      if (!portrait) {
        mctx.textAlign = "center";
        mctx.fillText(KINDS[k], pN.x, pN.y - 15 - gGlow * 2);
      } else {
        const leftSide = k % 2 === 0;
        mctx.textAlign = leftSide ? "right" : "left";
        mctx.fillText(KINDS[k], pN.x + (leftSide ? -18 : 18), pN.y + 3);
      }
    }
    if (!portrait) {
      const midChain = railPt((tChain0 + tChain1) / 2);
      mctx.textAlign = "center";
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.fillText("SIX KINDS, NEVER MERGED", midChain.x, midChain.y + 58);
    }

    /* the gate — luminous bars with a scanning beam that sweeps the aperture */
    const closing = sparks.length > 0 ? 6 : 0;
    const gh = portrait ? Math.min(44, w * 0.12) : 54;
    const scan = reduced ? 0.5 : (Math.sin(now / 900) * 0.5 + 0.5);
    mctx.save();
    mctx.strokeStyle = `rgba(${INK},0.9)`;
    mctx.lineWidth = 2; mctx.lineCap = "round";
    mctx.beginPath();
    if (!portrait) {
      mctx.moveTo(gateP.x, gateP.y - gh); mctx.lineTo(gateP.x, gateP.y - 10 + closing);
      mctx.moveTo(gateP.x, gateP.y + 10 - closing); mctx.lineTo(gateP.x, gateP.y + gh);
    } else {
      mctx.moveTo(gateP.x - gh, gateP.y); mctx.lineTo(gateP.x - 10 + closing, gateP.y);
      mctx.moveTo(gateP.x + 10 - closing, gateP.y); mctx.lineTo(gateP.x + gh, gateP.y);
    }
    mctx.stroke();
    if (dark) mctx.globalCompositeOperation = "lighter";
    const bx = portrait ? gateP.x - (gh - 12) + scan * (gh - 12) * 2 : gateP.x;
    const by = portrait ? gateP.y : gateP.y - (gh - 12) + scan * (gh - 12) * 2;
    glow(bx, by, 10, OK, dark ? 0.55 : 0.32);
    mctx.fillStyle = `rgba(${OK},0.85)`;
    mctx.beginPath(); mctx.arc(bx, by, 1.6, 0, TAU); mctx.fill();
    mctx.restore();
    mctx.fillStyle = `rgba(${INK},${TA})`;
    if (!portrait) {
      mctx.textAlign = "center";
      mctx.fillText("THE GATE", gateP.x, gateP.y + 70);
      mctx.fillText("FAILS CLOSED", gateP.x, gateP.y + 82);
      mctx.fillStyle = `rgba(${RED},0.8)`;
      mctx.fillText(`↓ REJECTED BY DESIGN · ${badTotal}`, gateP.x, gateP.y + 100);
      const lr = lastReject;
      if (lr && now - lr.at < 2800) {
        mctx.fillStyle = `rgba(${RED},${(0.85 * (1 - (now - lr.at) / 2800)).toFixed(2)})`;
        mctx.fillText(lr.rule, gateP.x, gateP.y + 114);
      }
    } else {
      mctx.textAlign = "left";
      mctx.fillText("THE GATE", gateP.x + gh + 10, gateP.y - 4);
      mctx.fillText("FAILS CLOSED", gateP.x + gh + 10, gateP.y + 8);
      mctx.fillStyle = `rgba(${RED},0.8)`;
      mctx.fillText(`→ REJECTED · ${badTotal}`, gateP.x + gh + 10, gateP.y + 22);
    }

    /* sealed ledger */
    const lP = railPt(1);
    if (!portrait) {
      const stackW = 46;
      const frac = Math.min(1, ((sealed % artifacts.length) / artifacts.length) + 0.15);
      mctx.strokeStyle = `rgba(${INK},0.4)`; mctx.lineWidth = 1;
      mctx.strokeRect(lP.x - stackW / 2 + 8, lP.y - 50, stackW, 100);
      mctx.fillStyle = `rgba(${INK},0.85)`;
      mctx.fillRect(lP.x - stackW / 2 + 8, lP.y + 50 - 100 * frac, stackW, 100 * frac);
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.textAlign = "center";
      mctx.fillText(`SEALED · ${artifacts.length}`, lP.x + 8, lP.y + 66);
    } else {
      const stackW2 = Math.min(120, w * 0.34);
      const frac = Math.min(1, ((sealed % artifacts.length) / artifacts.length) + 0.15);
      mctx.strokeStyle = `rgba(${INK},0.4)`; mctx.lineWidth = 1;
      mctx.strokeRect(lP.x - stackW2 / 2, lP.y + 12, stackW2, 20);
      mctx.fillStyle = `rgba(${INK},0.85)`;
      mctx.fillRect(lP.x - stackW2 / 2, lP.y + 12, stackW2 * frac, 20);
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.textAlign = "center";
      mctx.fillText(`SEALED · ${artifacts.length}`, lP.x, lP.y + 48);
    }

    /* ticker */
    if (leading) {
      mctx.font = portrait ? monoSmall : mono;
      mctx.fillStyle = `rgba(${INK},${TA})`;
      if (!portrait) {
        mctx.textAlign = "right";
        const label = `IN FLIGHT · ${leading.a.artifact.path} · ${leading.a.artifact.sha256.slice(0, 20)}…`;
        mctx.fillText(label.length > 96 ? "…" + label.slice(-94) : label, w - 16, 26);
      } else {
        mctx.textAlign = "left";
        const name = leading.a.artifact.path.split("/").pop() ?? "";
        mctx.fillText(`IN FLIGHT · ${name.length > 32 ? name.slice(0, 32) + "…" : name}`, 12, h - 10);
      }
      mctx.textAlign = "center";
    }

    /* hover tooltip */
    if (hovered) {
      mctx.strokeStyle = `rgba(${INK},0.9)`;
      mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(hovered.x, hovered.y, 8, 0, TAU); mctx.stroke();
      const name = hovered.p.a.artifact.path.split("/").pop() ?? "";
      const sha = hovered.p.a.artifact.sha256.slice(7, 15);
      const bytes = (hovered.p.a.byte_size || 0).toLocaleString();
      const tip = `${name} · ${sha} · ${bytes} B · ${hovered.p.bad ? "WILL BE REJECTED" : "WILL SEAL"}`;
      mctx.font = monoSmall; mctx.textAlign = "left";
      const tw = mctx.measureText(tip).width + 16;
      const tx = Math.min(w - tw - 8, Math.max(8, hovered.x + 14)), ty = Math.max(8, hovered.y - 26);
      mctx.fillStyle = dark ? "rgba(5,5,7,0.85)" : "rgba(251,250,246,0.92)";
      mctx.strokeStyle = `rgba(${INK},0.25)`;
      mctx.beginPath(); mctx.roundRect(tx, ty, tw, 18, 5); mctx.fill(); mctx.stroke();
      mctx.fillStyle = hovered.p.bad ? `rgba(${RED},0.9)` : `rgba(${INK},0.85)`;
      mctx.fillText(tip, tx + 8, ty + 13);
      mctx.textAlign = "center";
    }

    mctx.restore(); /* end the parallax layer — post & vignette are screen-fixed */

    /* filmic bloom + vignette — applied here only on the 2D fallback path.
       When a GPU pass owns them (post === "none") the engine emits the raw
       scene so the shader pipeline can do real bright-pass bloom, radial
       dispersion, tone-mapping and grain. */
    if (post === "canvas") {
      if (dark) {
        mctx.save();
        mctx.globalCompositeOperation = "lighter";
        mctx.globalAlpha = 0.3;
        mctx.filter = "blur(6px)";
        mctx.drawImage(mainCv as CanvasImageSource, 0, 0, w, h);
        mctx.filter = "none";
        mctx.restore();
      }
      const vg = (rgb: string, ox: number, a: number) => {
        const g = mctx.createRadialGradient(w / 2 + ox, h * 0.46, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.72);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(1, `rgba(${rgb},${a})`);
        mctx.fillStyle = g;
        mctx.fillRect(0, 0, w, h);
      };
      if (dark) {
        vg("150,70,95", -4, 0.09);
        vg("70,95,140", 4, 0.09);
        vg("3,3,5", 0, 0.52);
      } else {
        vg("196,120,120", -3, 0.05);
        vg("120,140,180", 3, 0.05);
        vg("210,208,198", 0, 0.42);
      }
    }

    /* composite the persistent trail and the crisp layer onto the output, in
       device space (both buffers are already sized w*dpr). */
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, output.width, output.height);
    octx.drawImage(trailCv as CanvasImageSource, 0, 0);
    octx.drawImage(mainCv as CanvasImageSource, 0, 0);
  };

  return {
    frame,
    setMouse(x, y, over) { mouse.x = x; mouse.y = y; mouse.over = over; },
    setPulse(at) { pulseAt = at; },
    setRuleMap(m) { ruleMap = m; },
  };
}
