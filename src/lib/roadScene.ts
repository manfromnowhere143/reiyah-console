/* The road at night, shared by every station that looks through a
   windshield. Pure canvas 2D in measured pixels. Nothing here is data: it is
   the frame the data stands in, the horizon, the road, the cabin. Obsidian
   draws night, paper draws day; the geometry is identical on both grounds.
   Drawn once for a still station, once per frame for a moving one. */

export interface World { w: number; h: number; dark: boolean; horizon: number; vpX: number; nearHalf: number; farHalf: number }
export interface WorldOpts {
  w: number; h: number; dark: boolean; horizon: number;
  phase?: number;          /* 0..1, advances the centre dashes toward the cabin */
  headlight?: boolean;     /* the near road lit from below the frame */
  dashes?: number;
  detail?: "harbor";     /* richer material pass, only for the opening scene */
  travel?: number;       /* continuous illustrative travel, before phase wrap */
}

export const MONO = '"B612 Mono", Menlo, monospace';
export const tones = (dark: boolean) => ({
  INK: dark ? "255,255,255" : "16,18,21",
  OK: dark ? "126,166,255" : "47,102,214",
  RED: dark ? "227,25,55" : "214,23,50",
  VOID: dark ? "5,5,7" : "244,243,238",
});

export function drawWorld(ctx: CanvasRenderingContext2D, o: WorldOpts): World {
  if (o.detail === "harbor") return drawHarborWorld(ctx, o);
  const { w, h, dark, horizon } = o;
  const { INK, OK } = tones(dark);
  const vpX = w / 2, nearHalf = w * 0.64, farHalf = Math.max(5, w * 0.016);
  /* the sky: light gathers at the horizon */
  const sky = ctx.createLinearGradient(0, Math.max(0, horizon - h * 0.6), 0, horizon);
  sky.addColorStop(0, `rgba(${OK},0)`); sky.addColorStop(1, `rgba(${OK},${dark ? 0.16 : 0.11})`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
  /* the night: a still field of stars and a few distant lights along the
     horizon, seeded so they never move; the day has neither */
  if (dark) {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const n = Math.round((w * horizon) / 2600);
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * horizon * 0.92, a = 0.12 + rnd() * 0.45, r = rnd() < 0.15 ? 1.1 : 0.7;
      ctx.fillStyle = `rgba(255,255,255,${(a * (0.4 + 0.6 * (1 - y / horizon))).toFixed(3)})`;
      ctx.fillRect(x, y, r, r);
    }
    for (let i = 0; i < 9; i++) {
      const x = w * (0.06 + rnd() * 0.88), a = 0.25 + rnd() * 0.35, r = 4 + rnd() * 9;
      if (Math.abs(x - vpX) < w * 0.06) continue;
      const g = ctx.createRadialGradient(x, horizon - 1, 0, x, horizon - 1, r);
      g.addColorStop(0, `rgba(${OK},${a.toFixed(2)})`); g.addColorStop(1, `rgba(${OK},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, horizon - 1, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  /* the ground haze just past the horizon */
  const gnd = ctx.createLinearGradient(0, horizon, 0, h);
  gnd.addColorStop(0, `rgba(${INK},${dark ? 0.09 : 0.07})`); gnd.addColorStop(0.55, `rgba(${INK},0)`);
  ctx.fillStyle = gnd; ctx.fillRect(0, horizon, w, h - horizon);
  /* the road surface */
  const road = new Path2D();
  road.moveTo(vpX - farHalf, horizon); road.lineTo(vpX + farHalf, horizon); road.lineTo(vpX + nearHalf, h + 2); road.lineTo(vpX - nearHalf, h + 2); road.closePath();
  const rs = ctx.createLinearGradient(0, horizon, 0, h);
  rs.addColorStop(0, `rgba(${INK},${dark ? 0.03 : 0.05})`); rs.addColorStop(1, `rgba(${INK},${dark ? 0.08 : 0.10})`);
  ctx.fillStyle = rs; ctx.fill(road);
  /* wet asphalt: the horizon's light mirrored down the road */
  ctx.save(); ctx.clip(road);
  const wet = ctx.createLinearGradient(0, horizon, 0, h);
  wet.addColorStop(0, `rgba(${OK},${dark ? 0.14 : 0.08})`); wet.addColorStop(1, `rgba(${OK},0)`);
  ctx.fillStyle = wet;
  ctx.beginPath(); ctx.moveTo(vpX - farHalf, horizon); ctx.lineTo(vpX + farHalf, horizon); ctx.lineTo(vpX + w * 0.17, h); ctx.lineTo(vpX - w * 0.17, h); ctx.closePath(); ctx.fill();
  if (o.headlight !== false) {
    const hl = ctx.createRadialGradient(vpX, h + h * 0.2, 0, vpX, h + h * 0.2, h * 0.9);
    hl.addColorStop(0, `rgba(255,255,255,${dark ? 0.17 : 0.10})`); hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl; ctx.fillRect(0, horizon, w, h - horizon);
  }
  ctx.restore();
  /* edge lines, fading into the distance */
  const edge = ctx.createLinearGradient(0, horizon, 0, h);
  edge.addColorStop(0, `rgba(${INK},0.06)`); edge.addColorStop(1, `rgba(${INK},0.45)`);
  ctx.strokeStyle = edge; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(vpX - farHalf, horizon); ctx.lineTo(vpX - nearHalf, h + 2); ctx.moveTo(vpX + farHalf, horizon); ctx.lineTo(vpX + nearHalf, h + 2); ctx.stroke();
  /* the horizon itself */
  ctx.strokeStyle = `rgba(${INK},0.2)`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, horizon + 0.5); ctx.lineTo(w, horizon + 0.5); ctx.stroke();
  /* centre dashes in perspective */
  const N = o.dashes ?? 8, phase = o.phase ?? 0;
  for (let i = 0; i < N; i++) {
    const f = ((i + phase) % N) / N;
    const y = horizon + (h - horizon) * f * f;
    const len = (h - horizon) * 0.05 * (0.25 + f);
    ctx.strokeStyle = `rgba(${INK},${(0.1 + f * 0.42).toFixed(3)})`; ctx.lineWidth = 0.8 + f * 2.6;
    ctx.beginPath(); ctx.moveTo(vpX, y); ctx.lineTo(vpX, Math.min(h, y + len)); ctx.stroke();
  }
  return { w, h, dark, horizon, vpX, nearHalf, farHalf };
}

/* A pinhole ground-plane projection in normalized staging coordinates. Depth
   is illustrative, never a reported vehicle range. Using one reciprocal-depth
   law for paint, shoulders and reflectors gives the road a coherent scale. */
export function harborRoadPoint(w: number, h: number, horizon: number, depth: number, lateral: number) {
  const f = 1 / Math.max(1, depth);
  return { x: w / 2 + lateral * w * 0.64 * f, y: horizon + (h - horizon) * f, f };
}

function drawHarborWorld(ctx: CanvasRenderingContext2D, o: WorldOpts): World {
  const { w, h, dark, horizon } = o;
  const vpX = w / 2, nearHalf = w * 0.64, farHalf = 0;
  const gh = Math.max(1, h - horizon), phase = o.phase ?? 0;
  const point = (depth: number, lateral = 0) => harborRoadPoint(w, h, horizon, depth, lateral);
  const quad = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  };

  // Opaque environment separates material color from the motion-trail alpha.
  // Cool distance and a warmer near surface are perceptual depth cues, not a
  // spectral atmosphere or an assertion that these are captured road pixels.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, dark ? "#05070b" : "#cdd9e0");
  sky.addColorStop(0.58, dark ? "#0b121b" : "#e1e6e5");
  sky.addColorStop(1, dark ? "#25323d" : "#efebe0");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon + 1);

  // A quiet, layered horizon: silhouettes give the eye a distance reference.
  // The seeded contour stays fixed through pause, resize and host fallback.
  for (let layer = 0; layer < 3; layer++) {
    const height = h * (0.028 + layer * 0.013);
    ctx.fillStyle = dark ? ["#1b2630", "#111c25", "#0a1118"][layer] : ["#c8d0ce", "#b5c0bc", "#99a8a3"][layer];
    ctx.beginPath(); ctx.moveTo(0, horizon + 2);
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const ridge = 0.45 + 0.24 * Math.sin(u * 13 + layer * 1.7) + 0.18 * Math.sin(u * 31 + layer * 2.1) + 0.07 * Math.sin(u * 71);
      // Keep the vanishing point open; the road runs through a shallow valley.
      const valley = 0.25 + 0.75 * Math.min(1, Math.abs(u - 0.5) * 4);
      ctx.lineTo(u * w, horizon - height * ridge * valley + layer * 3);
    }
    ctx.lineTo(w, horizon + 3); ctx.closePath(); ctx.fill();
  }
  const verge = ctx.createLinearGradient(0, horizon, 0, h);
  verge.addColorStop(0, dark ? "#18242b" : "#a1ada1");
  verge.addColorStop(0.35, dark ? "#0a1115" : "#949d88");
  verge.addColorStop(1, dark ? "#05080b" : "#858e7b");
  ctx.fillStyle = verge; ctx.fillRect(0, horizon, w, gh);

  // Gravel shoulders frame a restrained, low-roughness wet asphalt surface.
  ctx.fillStyle = dark ? "#20292e" : "#b7b6a8";
  quad(point(1000, -1.14), point(1000, 1.14), point(1, 1.14), point(1, -1.14));
  const road = new Path2D();
  road.moveTo(vpX, horizon); road.lineTo(vpX + nearHalf, h + 1); road.lineTo(vpX - nearHalf, h + 1); road.closePath();
  const asphalt = ctx.createLinearGradient(0, horizon, 0, h);
  asphalt.addColorStop(0, dark ? "#293139" : "#a0aaa9");
  asphalt.addColorStop(0.26, dark ? "#151d24" : "#8e9897");
  asphalt.addColorStop(1, dark ? "#0c1117" : "#828887");
  ctx.fillStyle = asphalt; ctx.fill(road);
  ctx.save(); ctx.clip(road);

  // The distant sky is reflected most at a grazing angle. Broad roughness
  // breaks it up below, instead of painting a full-screen white headlight.
  ctx.save(); ctx.translate(vpX, horizon); ctx.scale(Math.max(1, w * 0.4), gh * 0.95);
  const sheen = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  sheen.addColorStop(0, dark ? "rgba(142,172,190,0.16)" : "rgba(246,245,231,0.13)");
  sheen.addColorStop(0.48, dark ? "rgba(115,146,169,0.035)" : "rgba(242,241,225,0.045)");
  sheen.addColorStop(1, "rgba(140,160,176,0)");
  ctx.fillStyle = sheen; ctx.fillRect(-1, 0, 2, 1); ctx.restore();

  // Two soft footprints originate from the cabin. Elliptical falloff is a
  // bounded appearance approximation, not calibrated headlamp photometry.
  if (o.headlight !== false && dark) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(vpX + side * w * 0.14, horizon + gh * 0.7);
      ctx.scale(Math.max(1, w * 0.22), gh * 0.62);
      const beam = ctx.createRadialGradient(0, 0.45, 0, 0, 0.45, 1);
      beam.addColorStop(0, "rgba(219,223,204,0.115)");
      beam.addColorStop(0.38, "rgba(205,218,218,0.075)");
      beam.addColorStop(1, "rgba(205,218,218,0)");
      ctx.fillStyle = beam; ctx.fillRect(-1, -0.55, 2, 2); ctx.restore();
    }
  }

  // Stable material microstructure: sparse projected marks, with distant
  // detail faded before it becomes subpixel shimmer. No animated white noise.
  const count = w < 560 ? 72 : 132;
  for (let i = 0; i < count; i++) {
    const hash = (Math.sin(i * 127.1 + 19.7) * 43758.5453) % 1;
    const lane = (Math.abs(hash) - 0.5) * 1.92;
    const u = (i * 0.61803398875 + (o.travel ?? phase) * 0.045) % 1;
    const depth = 1.04 + (1 - u) * 10;
    const p = point(depth, lane);
    if (p.f < 0.11) continue;
    ctx.strokeStyle = dark ? `rgba(156,173,180,${0.016 + p.f * 0.035})` : `rgba(57,67,68,${0.025 + p.f * 0.055})`;
    ctx.lineWidth = 0.45 + p.f * 0.65;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (2 + Math.abs(hash) * 14) * p.f, p.y); ctx.stroke();
  }
  // The very faint twin tire tracks interrupt the wet surface longitudinally.
  for (const lane of [-0.34, 0.34]) {
    ctx.fillStyle = dark ? "rgba(0,0,0,0.045)" : "rgba(48,57,58,0.04)";
    quad(point(1000, lane - 0.045), point(1000, lane + 0.045), point(1, lane + 0.045), point(1, lane - 0.045));
  }
  ctx.restore();

  // Paint has a width in the ground plane, not a fixed screen-space stroke.
  for (const side of [-1, 1]) {
    const paint = ctx.createLinearGradient(0, horizon, 0, h);
    paint.addColorStop(0, dark ? "rgba(198,210,209,0.05)" : "rgba(247,246,231,0.15)");
    paint.addColorStop(1, dark ? "rgba(219,225,211,0.42)" : "rgba(252,251,240,0.92)");
    ctx.fillStyle = paint;
    quad(point(1000, side * 0.96 - 0.006), point(1000, side * 0.96 + 0.006), point(1, side * 0.96 + 0.006), point(1, side * 0.96 - 0.006));
  }
  const spacing = 2.15;
  for (let i = 0; i < 18; i++) {
    const z = 0.15 + (i + 1 - phase) * spacing, end = z + 0.76;
    const near = point(z), far = point(end);
    if (near.y - far.y < 0.55) continue;
    const fade = Math.min(1, near.f * 3);
    ctx.fillStyle = dark ? `rgba(208,216,211,${0.08 + 0.45 * fade})` : `rgba(252,251,237,${0.22 + 0.7 * fade})`;
    quad(point(end, -0.0045), point(end, 0.0045), point(z, 0.0045), point(z, -0.0045));
  }

  // Roadside delineators share the same projection. Their neutral reflectors
  // are scenery; never red detections or fabricated traffic participants.
  for (let i = 13; i >= 0; i--) {
    const z = 0.3 + (i + 1 - phase) * 2.9;
    if (z < 1) continue;
    for (const side of [-1, 1]) {
      const p = point(z, side * 1.10), stem = Math.max(0.8, h * 0.057 * p.f);
      ctx.strokeStyle = dark ? `rgba(133,155,163,${0.14 + p.f * 0.35})` : `rgba(60,75,76,${0.18 + p.f * 0.55})`;
      ctx.lineWidth = Math.max(0.55, w * 0.0025 * p.f);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - stem); ctx.stroke();
      ctx.fillStyle = dark ? `rgba(220,222,199,${0.32 + p.f * 0.6})` : "rgba(251,248,228,0.85)";
      const sw = Math.max(0.7, w * 0.003 * p.f);
      ctx.fillRect(p.x - sw / 2, p.y - stem, sw, Math.max(0.6, stem * 0.22));
    }
  }

  // A shallow atmospheric veil removes the infinitely sharp drawn horizon.
  const fog = ctx.createLinearGradient(0, horizon - h * 0.017, 0, horizon + gh * 0.14);
  fog.addColorStop(0, dark ? "rgba(97,123,137,0)" : "rgba(226,231,222,0)");
  fog.addColorStop(0.15, dark ? "rgba(97,123,137,0.13)" : "rgba(226,231,222,0.36)");
  fog.addColorStop(1, dark ? "rgba(97,123,137,0)" : "rgba(226,231,222,0)");
  ctx.fillStyle = fog; ctx.fillRect(0, horizon - h * 0.017, w, h * 0.017 + gh * 0.14);
  return { w, h, dark, horizon, vpX, nearHalf, farHalf };
}

/* the cabin: two A-pillars and, when asked, the dashboard. Drawn last and
   never moved: the camera sits in the cabin, the world moves outside it. */
export function drawCabin(ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean, pillarW: number, dash: number, refined = false) {
  const VOID = dark ? "6,7,9" : "228,226,218";
  const RIM = dark ? "255,255,255" : "16,18,21";
  const SHADE = dark ? "0,0,0" : "16,18,21";
  /* the lens: corners fall off, the frame is a view and not a box */
  const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.75);
  vg.addColorStop(0, `rgba(${SHADE},0)`); vg.addColorStop(1, `rgba(${SHADE},${dark ? 0.55 : 0.12})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  /* A-pillars: solid outside, a soft shadow falling onto the glass inside */
  const pillar = (left: boolean) => {
    const sx = left ? 1 : -1, x0 = left ? 0 : w;
    ctx.fillStyle = `rgba(${VOID},0.985)`;
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + sx * pillarW * 0.42, 0); ctx.lineTo(x0 + sx * pillarW, h); ctx.lineTo(x0, h); ctx.closePath(); ctx.fill();
    const sw = Math.max(10, pillarW * 0.5);
    const g = ctx.createLinearGradient(x0 + sx * pillarW * 0.7, 0, x0 + sx * (pillarW * 0.7 + sw), 0);
    g.addColorStop(0, `rgba(${SHADE},${dark ? 0.6 : 0.16})`); g.addColorStop(1, `rgba(${SHADE},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0 + sx * pillarW * 0.42, 0); ctx.lineTo(x0 + sx * (pillarW * 0.42 + sw), 0); ctx.lineTo(x0 + sx * (pillarW + sw), h); ctx.lineTo(x0 + sx * pillarW, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${RIM},${dark ? 0.07 : 0.12})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0 + sx * pillarW * 0.42, 0); ctx.lineTo(x0 + sx * pillarW, h); ctx.stroke();
  };
  pillar(true); pillar(false);
  if (dash > 0) {
    const y0 = h - dash;
    const top = new Path2D(); top.moveTo(0, y0 + dash * 0.22); top.quadraticCurveTo(w / 2, y0 - dash * 0.22, w, y0 + dash * 0.22);
    const dg = ctx.createLinearGradient(0, y0 - dash * 0.1, 0, h);
    dg.addColorStop(0, `rgba(${VOID},0.97)`); dg.addColorStop(1, `rgba(${VOID},1)`);
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.moveTo(0, y0 + dash * 0.22); ctx.quadraticCurveTo(w / 2, y0 - dash * 0.22, w, y0 + dash * 0.22); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    /* the dashboard's top edge catches the horizon's light */
    ctx.strokeStyle = `rgba(${RIM},${dark ? 0.16 : 0.2})`; ctx.lineWidth = 1; ctx.stroke(top);
    const rg = ctx.createLinearGradient(0, y0 - dash * 0.22, 0, y0 + dash * 0.5);
    rg.addColorStop(0, `rgba(${RIM},${dark ? 0.06 : 0.3})`); rg.addColorStop(1, `rgba(${RIM},0)`);
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, y0 + dash * 0.22); ctx.quadraticCurveTo(w / 2, y0 - dash * 0.22, w, y0 + dash * 0.22); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.clip();
    ctx.fillStyle = rg; ctx.fillRect(0, y0 - dash * 0.22, w, dash); ctx.restore();
  }
  /* the glass: one soft highlight from the upper left */
  const sh = ctx.createLinearGradient(0, 0, w * 0.55, h * 0.7);
  sh.addColorStop(0, `rgba(255,255,255,${dark ? 0.04 : refined ? 0.07 : 0.22})`); sh.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
}
