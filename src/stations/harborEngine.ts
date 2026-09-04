/* The Harbor engine — THE SENSED WORLD. A first-person, in-cabin view of the
   real domain Reiyah exists for: driving forward, the committed artifacts
   stream toward you as sensed objects, each passing through the six kinds
   (OBS -> BEL -> DEC -> INT -> OUT -> EVD); the gate rejects known-bad fixtures
   in-world; a sensing reticle watches the road ahead. Every object is a real,
   digest-verified record. No DOM or window references — every per-frame input
   arrives through `env` or the input setters — so the same engine runs in a
   Web Worker over an OffscreenCanvas (with the WebGL2 post feeding on its
   scene) and, where that is unsupported, on the main thread as a fallback. */

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
     "none": a downstream GPU pass owns bloom/dispersion/vignette. */
  post?: "canvas" | "none";
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type MakeCanvas = (w: number, h: number) => AnyCanvas;

const TAU = Math.PI * 2;
const KINDS = ["OBS", "BEL", "DEC", "INT", "OUT", "EVD"];
/* the shape is the role: every sensed object is drawn as what it is */
type Shape = "diamond" | "square" | "circle" | "hex";
const shapeOf = (role: string): Shape =>
  role.includes("schema") ? "square" :
  role.includes("historical") || role.includes("recovery") ? "circle" :
  role.includes("validator") || role.includes("toolchain") || role.includes("launcher") ? "hex" : "diamond";
const drawShape = (c: Ctx, shape: Shape, x: number, y: number, s: number) => {
  c.beginPath();
  if (shape === "diamond") { c.moveTo(x, y - s); c.lineTo(x + s, y); c.lineTo(x, y + s); c.lineTo(x - s, y); }
  else if (shape === "square") { const q = s * 0.8; c.rect(x - q, y - q, q * 2, q * 2); }
  else if (shape === "circle") { c.arc(x, y, s * 0.9, 0, TAU); }
  else { for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + TAU / 12; const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); } }
  c.closePath();
};
const KIND_T = [0.10, 0.24, 0.38, 0.54, 0.70, 0.86]; // where each kind lives along the approach
const GATE_T = 0.46;                                  // the gate: bad fixtures are rejected here

interface Packet {
  a: ArtifactRow;
  t: number;        // 0 (far, at the horizon) -> 1 (near, passing the ego)
  speed: number;
  bad: boolean;
  shape: Shape;
  lane: number;     // -1..1 across the road
  mass: number;     // 0..1, real byte size (log-scaled)
  fall: number;     // > 0 once rejected
  vx: number; vy: number;
  px: number; py: number; // previous screen position, for the motion streak
  seen: boolean;
}

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
  const trailCv = makeCanvas(2, 2);
  const mainCv = makeCanvas(2, 2);
  const tctx = trailCv.getContext("2d") as Ctx;
  const mctx = mainCv.getContext("2d") as Ctx;
  const octx = output.getContext("2d") as Ctx;

  const monoSmall = '9px "B612 Mono","SF Mono",Menlo,monospace';

  let spawnIdx = 0, sealed = 0, spawnAcc = 0, raf0 = 0;
  let timeScale = 1;
  const packets: Packet[] = [];
  const kindGlow = [0, 0, 0, 0, 0, 0];
  const mouse = { x: -1, y: -1, over: false };
  let lastRejectAt = 0, lastRejectRule = "";

  let pulseAt = 0;
  let ruleMap: Record<string, string> = {};

  let lmin = Infinity, lmax = -Infinity;
  for (const a of artifacts) { const l = Math.log(Math.max(1, a.byte_size || 1)); if (l < lmin) lmin = l; if (l > lmax) lmax = l; }
  const massOf = (b: number) => (lmax > lmin ? (Math.log(Math.max(1, b || 1)) - lmin) / (lmax - lmin) : 0.5);

  const spawn = () => {
    const a = artifacts[spawnIdx % artifacts.length];
    spawnIdx++;
    const hh = parseInt(a.artifact.sha256.slice(9, 13), 16) / 0xffff;
    const hh2 = parseInt(a.artifact.sha256.slice(13, 17), 16) / 0xffff;
    packets.push({
      a, t: 0, speed: 0.055 + hh * 0.05,
      bad: a.role === "known_bad_fixture",
      shape: shapeOf(a.role),
      lane: (hh2 - 0.5) * 1.7,
      mass: massOf(a.byte_size),
      fall: 0, vx: 0, vy: 0, px: 0, py: 0, seen: false,
    });
  };
  for (let i = 0; i < 7; i++) { spawn(); packets[i].t = i * 0.13; }

  let last = 0, started = false;

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
    const OK = dark ? "126,166,255" : "47,102,214";
    const DIM = dark ? "150,157,166" : "120,128,138";
    const FADE = dark ? "rgba(5,5,7,0.30)" : "rgba(244,243,238,0.32)";
    const TA = dark ? "0.94" : "0.82";
    const surge = !!pulseAt && now - pulseAt < 2000;
    const t = now / 1000;

    timeScale += ((mouse.over ? 0.4 : 1) - timeScale) * Math.min(1, rdt * 6);
    const dt = rdt * (reduced ? 0 : timeScale) * (surge ? 1.7 : 1);
    const flow = reduced ? 0 : t * 0.28; // forward motion for the lane dashes

    /* ---- perspective of the road ---- */
    const horizon = Math.round(h * 0.40);
    const cx = w / 2 + (reduced ? 0 : Math.sin(t * 0.37) * 3 + Math.sin(t * 1.3) * 0.8);
    const groundH = h - horizon;
    const yAt = (p: number) => horizon + groundH * (p * p);
    const fAt = (y: number) => (y - horizon) / groundH;               // 0 at horizon, 1 at ego
    const halfAt = (f: number) => 22 + (w * 0.52 - 22) * f;           // road half-width
    const project = (p: number, lane: number) => {
      const y = yAt(p); const f = fAt(y);
      return { x: cx + lane * halfAt(f) * 0.82, y, f };
    };

    /* ============ TRAIL LAYER: motion, speed, the world in flight ============ */
    tctx.fillStyle = FADE;
    tctx.fillRect(0, 0, w, h);
    if (reduced) tctx.clearRect(0, 0, w, h);

    /* ============ CRISP LAYER ============ */
    mctx.clearRect(0, 0, w, h);

    const glow = (gx: number, gy: number, gr: number, rgb: string, a: number) => {
      const g = mctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      mctx.fillStyle = g;
      mctx.beginPath(); mctx.arc(gx, gy, gr, 0, TAU); mctx.fill();
    };

    /* the sky/road ground: a faint depth wash toward the horizon */
    if (dark) glow(cx, horizon, Math.max(w, h) * 0.5, INK, 0.05);

    /* road edges converging to the vanishing point */
    mctx.strokeStyle = `rgba(${INK},${dark ? 0.34 : 0.28})`;
    mctx.lineWidth = 1.5; mctx.lineCap = "round";
    mctx.beginPath();
    mctx.moveTo(cx - 22, horizon); mctx.lineTo(cx - w * 0.54, h);
    mctx.moveTo(cx + 22, horizon); mctx.lineTo(cx + w * 0.54, h);
    mctx.stroke();
    /* the horizon line */
    mctx.strokeStyle = `rgba(${INK},${dark ? 0.28 : 0.24})`;
    mctx.lineWidth = 1;
    mctx.beginPath(); mctx.moveTo(0, horizon); mctx.lineTo(w, horizon); mctx.stroke();

    /* ground ticks: faint cross-lines flowing toward the ego, so the road has depth */
    for (let k = 0; k < 8; k++) {
      const p = ((k / 8) + flow * 0.5) % 1;
      const y = yAt(p), f = fAt(y), hw = halfAt(f);
      mctx.strokeStyle = `rgba(${INK},${(0.03 + 0.07 * f).toFixed(3)})`;
      mctx.lineWidth = 1;
      mctx.beginPath(); mctx.moveTo(cx - hw, y); mctx.lineTo(cx + hw, y); mctx.stroke();
    }
    /* centre lane dashes, scrolling toward the ego (forward motion) */
    const N = 11;
    for (let k = 0; k < N; k++) {
      let p = ((k / N) + flow) % 1;
      const y = yAt(p), f = fAt(y);
      mctx.strokeStyle = `rgba(${INK},${(0.18 + 0.34 * f).toFixed(3)})`;
      mctx.lineWidth = 1.2 + f * 4;
      mctx.beginPath(); mctx.moveTo(cx, y); mctx.lineTo(cx, y - (6 + f * 34)); mctx.stroke();
    }

    /* ---- the sensing reticle: REIYAH watches the road ahead ---- */
    const scan = reduced ? 0.5 : (Math.sin(t * 1.1) * 0.5 + 0.5);
    const rr = 10 + scan * 6;
    if (dark) mctx.globalCompositeOperation = "lighter";
    glow(cx, horizon, 26 * (surge ? 1.4 : 1), RED, 0.14 * (surge ? 1.4 : 1));
    mctx.globalCompositeOperation = "source-over";
    mctx.strokeStyle = `rgba(${RED},${0.7})`;
    mctx.lineWidth = 1.2;
    mctx.beginPath(); mctx.arc(cx, horizon, rr, 0, TAU); mctx.stroke();
    mctx.strokeStyle = `rgba(${INK},0.5)`;
    for (let a = 0; a < 4; a++) {
      const ang = a * (TAU / 4) + t * 0.3;
      mctx.beginPath();
      mctx.moveTo(cx + Math.cos(ang) * (rr + 3), horizon + Math.sin(ang) * (rr + 3));
      mctx.lineTo(cx + Math.cos(ang) * (rr + 8), horizon + Math.sin(ang) * (rr + 8));
      mctx.stroke();
    }
    mctx.fillStyle = `rgba(${RED},0.95)`;
    mctx.beginPath(); mctx.arc(cx, horizon, 2, 0, TAU); mctx.fill();
    mctx.font = monoSmall; mctx.textAlign = "center"; mctx.fillStyle = `rgba(${INK},${TA})`;
    mctx.fillText("REIYAH SEES", cx, horizon - rr - 8);

    /* ---- objects (the real artifacts) approaching through the kinds ---- */
    for (let i = 0; i < 6; i++) kindGlow[i] = Math.max(0, kindGlow[i] - rdt * 2.2);
    spawnAcc += dt * 1.1;
    if (!reduced && spawnAcc > 0.42 && packets.length < 34) { spawnAcc = 0; spawn(); }

    let leading: Packet | null = null;
    let hovered: { p: Packet; x: number; y: number; s: number } | null = null;

    for (let i = packets.length - 1; i >= 0; i--) {
      const pk = packets[i];

      if (pk.fall > 0 || (pk.bad && pk.t >= GATE_T)) {
        if (pk.fall === 0) {
          const at = project(GATE_T, pk.lane);
          pk.px = at.x; pk.py = at.y;
          pk.vx = (pk.lane < 0 ? -1 : 1) * (60 + Math.random() * 60);
          pk.vy = 26;
          lastRejectAt = now; lastRejectRule = ruleMap[pk.a.artifact.path] || "known-bad fixture";
        }
        pk.fall += dt * 1.5;
        pk.vy += 340 * dt;
        pk.px += pk.vx * dt; pk.py += pk.vy * dt;
        const fa = Math.max(0, 1 - pk.fall * 0.7);
        if (dark) mctx.globalCompositeOperation = "lighter";
        glow(pk.px, pk.py, 10 * fa, RED, 0.4 * fa);
        mctx.globalCompositeOperation = "source-over";
        mctx.fillStyle = `rgba(${RED},${(0.9 * fa).toFixed(2)})`;
        mctx.beginPath(); mctx.arc(pk.px, pk.py, 3, 0, TAU); mctx.fill();
        if (pk.fall > 1.6 || pk.py > h + 20) packets.splice(i, 1);
        continue;
      }

      pk.t += dt * pk.speed;
      if (pk.t >= 1) { sealed++; packets.splice(i, 1); continue; }

      const pr = project(pk.t, pk.lane);
      const s = (2.4 + pr.f * pr.f * 20) * (0.65 + pk.mass * 0.7);

      /* light the kind zone this object is crossing */
      for (let k = 0; k < 6; k++) if (Math.abs(pk.t - KIND_T[k]) < 0.03) kindGlow[k] = 1;

      /* the motion streak (speed) on the trail layer */
      if (pk.seen && pr.f > 0.04) {
        tctx.strokeStyle = `rgba(${pk.bad ? RED : DIM},${(0.12 + pr.f * 0.3).toFixed(3)})`;
        tctx.lineWidth = Math.max(0.6, s * 0.4);
        tctx.beginPath(); tctx.moveTo(pk.px, pk.py); tctx.lineTo(pr.x, pr.y); tctx.stroke();
      }

      /* belief halo (doubt) around objects in the belief zone */
      if (pk.t > KIND_T[1] - 0.08 && pk.t < KIND_T[2]) {
        const doubt = 1 - smoothLocal(KIND_T[1], KIND_T[2], pk.t);
        if (dark) mctx.globalCompositeOperation = "lighter";
        glow(pr.x, pr.y, s + 10 + 10 * doubt, INK, 0.05 + 0.06 * doubt);
        mctx.globalCompositeOperation = "source-over";
      }

      /* the object: a sensed diamond. Bright core, additive halo on obsidian. */
      const rgb = pk.bad ? RED : (pk.t > KIND_T[4] ? OK : INK);
      if (dark) {
        mctx.globalCompositeOperation = "lighter";
        glow(pr.x, pr.y, s * 2.6, rgb, 0.16 + pr.f * 0.14);
        mctx.globalCompositeOperation = "source-over";
      }
      /* a ground shadow beneath near objects: they stand on the road */
      if (pr.f > 0.25) {
        mctx.fillStyle = `rgba(${dark ? "0,0,0" : INK},${(0.10 * pr.f).toFixed(3)})`;
        mctx.beginPath(); mctx.ellipse(pr.x, pr.y + s * 1.15, s * 1.1, s * 0.28, 0, 0, TAU); mctx.fill();
      }
      mctx.strokeStyle = `rgba(${rgb},${(0.5 + pr.f * 0.45).toFixed(2)})`;
      mctx.lineWidth = Math.max(1, s * 0.16);
      drawShape(mctx, pk.shape, pr.x, pr.y, s);
      mctx.stroke();
      if (pr.f > 0.3) {
        mctx.fillStyle = `rgba(${rgb},${(0.7 * pr.f).toFixed(2)})`;
        mctx.beginPath(); mctx.arc(pr.x, pr.y, s * 0.28, 0, TAU); mctx.fill();
      }

      /* detection bracket + kind label on tracked objects (the sensing HUD) */
      if (pr.f > 0.36) {
        const bs = s + 7, cor = Math.min(7, bs * 0.55);
        mctx.strokeStyle = `rgba(${pk.bad ? RED : INK},${(0.22 + pr.f * 0.4).toFixed(2)})`;
        mctx.lineWidth = 1;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          const bx = pr.x + sx * bs, by = pr.y + sy * bs;
          mctx.beginPath();
          mctx.moveTo(bx - sx * cor, by); mctx.lineTo(bx, by); mctx.lineTo(bx, by - sy * cor);
          mctx.stroke();
        }
        let ki = 0; for (let k = 0; k < 6; k++) if (pk.t >= KIND_T[k]) ki = k;
        mctx.fillStyle = `rgba(${pk.bad ? RED : INK},${(0.45 + pr.f * 0.4).toFixed(2)})`;
        mctx.font = monoSmall; mctx.textAlign = "left";
        mctx.fillText(pk.bad ? "REJECT" : KINDS[ki], pr.x - bs, pr.y - bs - 3);
      }

      pk.px = pr.x; pk.py = pr.y; pk.seen = true;
      if (!leading || pk.t > leading.t) leading = pk;
      if (mouse.over) {
        const d = Math.hypot(mouse.x - pr.x, mouse.y - pr.y);
        if (d < s + 14 && (!hovered || d < Math.hypot(mouse.x - hovered.x, mouse.y - hovered.y))) {
          hovered = { p: pk, x: pr.x, y: pr.y, s };
        }
      }
    }

    /* ---- the gate across the road: fails closed ---- */
    const gy = yAt(GATE_T), gf = fAt(gy), ghw = halfAt(gf) * 0.82;
    const fire = Math.max(0, 1 - (now - lastRejectAt) / 700);
    if (fire > 0 && dark) { mctx.globalCompositeOperation = "lighter"; glow(cx, gy, ghw * 0.6, RED, 0.12 * fire); mctx.globalCompositeOperation = "source-over"; }
    mctx.strokeStyle = fire > 0 ? `rgba(${RED},${(0.35 + 0.6 * fire).toFixed(2)})` : `rgba(${INK},${dark ? 0.5 : 0.4})`;
    mctx.lineWidth = 1 + fire;
    mctx.setLineDash([5, 5]);
    mctx.beginPath(); mctx.moveTo(cx - ghw, gy); mctx.lineTo(cx + ghw, gy); mctx.stroke();
    mctx.setLineDash([]);
    mctx.fillStyle = `rgba(${INK},${TA})`; mctx.font = monoSmall; mctx.textAlign = "left";
    mctx.fillText("GATE · FAILS CLOSED", cx + ghw + 8, gy - 4);
    mctx.fillStyle = `rgba(${RED},0.85)`;
    mctx.fillText(`REJECTED BY DESIGN · ${badTotal}`, cx + ghw + 8, gy + 8);
    if (now - lastRejectAt < 2600) {
      mctx.fillStyle = `rgba(${RED},${(0.85 * (1 - (now - lastRejectAt) / 2600)).toFixed(2)})`;
      mctx.fillText(lastRejectRule, cx + ghw + 8, gy + 20);
    }

    /* ---- the six kinds as a sensing readout down the left edge ---- */
    mctx.textAlign = "left"; mctx.font = monoSmall;
    for (let k = 0; k < 6; k++) {
      const ky = horizon + 16 + k * 15;
      const gk = kindGlow[k];
      mctx.fillStyle = `rgba(${gk > 0.2 ? RED : INK},${(0.4 + gk * 0.55).toFixed(2)})`;
      mctx.beginPath(); mctx.arc(14, ky, 2 + gk * 1.6, 0, TAU); mctx.fill();
      mctx.fillStyle = `rgba(${INK},${(0.5 + gk * 0.45).toFixed(2)})`;
      mctx.fillText(KINDS[k], 22, ky + 3);
    }
    mctx.fillStyle = `rgba(${INK},${TA})`;
    mctx.fillText("SIX KINDS · NEVER MERGED", 14, horizon + 16 + 6 * 15 + 4);

    /* ---- sealed ledger (objects that passed into evidence) ---- */
    mctx.textAlign = "right";
    mctx.fillStyle = `rgba(${OK},${TA})`;
    mctx.fillText(`SEALED · ${artifacts.length}`, w - 14, horizon + 18);
    mctx.fillStyle = `rgba(${INK},${TA})`;
    mctx.fillText(`IN FLIGHT · ${packets.filter((p) => p.fall === 0).length}`, w - 14, horizon + 32);
    mctx.fillStyle = `rgba(${INK},${dark ? 0.7 : 0.6})`;
    if (w < 560) { mctx.fillText("◇ FIXTURE  ▢ SCHEMA", w - 14, horizon + 46); mctx.fillText("○ HISTORY  ⬡ VALIDATOR", w - 14, horizon + 60); }
    else mctx.fillText("◇ FIXTURE  ▢ SCHEMA  ○ HISTORY  ⬡ VALIDATOR", w - 14, horizon + 46);

    /* ---- ticker: the nearest object's identity, as a HUD line under the title
       (kept clear of the receipt chip and authority wall at the bottom) ---- */
    if (leading) {
      mctx.font = monoSmall; mctx.textAlign = "left";
      mctx.fillStyle = `rgba(${INK},${TA})`;
      const name = leading.a.artifact.path.split("/").pop() ?? "";
      const label = `SENSING · ${name} · ${leading.a.artifact.sha256.slice(0, 16)}…`;
      const maxc = Math.max(16, Math.floor((w - 28) / 5.4));
      mctx.fillText(label.length > maxc ? label.slice(0, maxc - 1) + "…" : label, 14, 44);
    }

    /* ---- hover: identify the exact record ---- */
    if (hovered) {
      mctx.strokeStyle = `rgba(${INK},0.9)`; mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(hovered.x, hovered.y, hovered.s + 5, 0, TAU); mctx.stroke();
      const name = hovered.p.a.artifact.path.split("/").pop() ?? "";
      const sha = hovered.p.a.artifact.sha256.slice(7, 15);
      const bytes = (hovered.p.a.byte_size || 0).toLocaleString();
      const tip = `${name} · ${sha} · ${bytes} B · ${hovered.p.bad ? "WILL BE REJECTED" : "WILL SEAL"}`;
      mctx.font = monoSmall; mctx.textAlign = "left";
      const tw = mctx.measureText(tip).width + 16;
      const tx = Math.min(w - tw - 8, Math.max(8, hovered.x + 14)), ty = Math.max(8, hovered.y - 26);
      mctx.fillStyle = dark ? "rgba(5,5,7,0.9)" : "rgba(251,250,246,0.94)";
      mctx.beginPath(); mctx.roundRect(tx, ty, tw, 18, 5); mctx.fill();
      mctx.fillStyle = hovered.p.bad ? `rgba(${RED},0.9)` : `rgba(${INK},0.9)`;
      mctx.fillText(tip, tx + 8, ty + 13);
    }

    /* ---- the cabin frame: this is a view from inside ---- */
    mctx.textAlign = "center";
    /* A-pillars: darken the top corners */
    const pil = (side: number) => {
      const g = mctx.createLinearGradient(side < 0 ? 0 : w, 0, side < 0 ? w * 0.22 : w * 0.78, h * 0.5);
      g.addColorStop(0, dark ? "rgba(3,3,5,0.85)" : "rgba(210,208,200,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = g;
      mctx.beginPath();
      if (side < 0) { mctx.moveTo(0, 0); mctx.lineTo(w * 0.2, 0); mctx.lineTo(0, h * 0.42); }
      else { mctx.moveTo(w, 0); mctx.lineTo(w * 0.8, 0); mctx.lineTo(w, h * 0.42); }
      mctx.closePath(); mctx.fill();
    };
    pil(-1); pil(1);
    /* dashboard: a soft rise at the very bottom with a faint instrument glow */
    const dg = mctx.createLinearGradient(0, h - Math.max(26, h * 0.08), 0, h);
    dg.addColorStop(0, "rgba(0,0,0,0)");
    dg.addColorStop(1, dark ? "rgba(2,2,4,0.9)" : "rgba(214,212,204,0.85)");
    mctx.fillStyle = dg;
    mctx.fillRect(0, h - Math.max(26, h * 0.08), w, Math.max(26, h * 0.08));

    /* ---- 2D post (fallback path only) ---- */
    if (post === "canvas") {
      if (dark) {
        mctx.save();
        mctx.globalCompositeOperation = "lighter";
        mctx.globalAlpha = 0.28;
        mctx.filter = "blur(6px)";
        mctx.drawImage(mainCv as CanvasImageSource, 0, 0, w, h);
        mctx.filter = "none";
        mctx.restore();
      }
      const vg = (rgb: string, ox: number, a: number) => {
        const g = mctx.createRadialGradient(w / 2 + ox, h * 0.44, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.max(w, h) * 0.72);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(1, `rgba(${rgb},${a})`);
        mctx.fillStyle = g;
        mctx.fillRect(0, 0, w, h);
      };
      if (dark) { vg("150,70,95", -4, 0.08); vg("70,95,140", 4, 0.08); vg("3,3,5", 0, 0.5); }
      else { vg("196,120,120", -3, 0.05); vg("120,140,180", 3, 0.05); vg("210,208,198", 0, 0.4); }
    }

    /* composite the trail + crisp layers onto the output (device space) */
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, output.width, output.height);
    octx.drawImage(trailCv as CanvasImageSource, 0, 0);
    octx.drawImage(mainCv as CanvasImageSource, 0, 0);
    void raf0;
  };

  return {
    frame,
    setMouse(x, y, over) { mouse.x = x; mouse.y = y; mouse.over = over; },
    setPulse(at) { pulseAt = at; },
    setRuleMap(m) { ruleMap = m; },
  };
}

function smoothLocal(a: number, b: number, x: number) {
  const v = (x - a) / (b - a);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
