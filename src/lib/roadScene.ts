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
}

export const MONO = '"B612 Mono", Menlo, monospace';
export const tones = (dark: boolean) => ({
  INK: dark ? "255,255,255" : "16,18,21",
  OK: dark ? "126,166,255" : "47,102,214",
  RED: dark ? "227,25,55" : "214,23,50",
  VOID: dark ? "5,5,7" : "244,243,238",
});

export function drawWorld(ctx: CanvasRenderingContext2D, o: WorldOpts): World {
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

/* the cabin: two A-pillars and, when asked, the dashboard. Drawn last and
   never moved: the camera sits in the cabin, the world moves outside it. */
export function drawCabin(ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean, pillarW: number, dash: number) {
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
  sh.addColorStop(0, `rgba(255,255,255,${dark ? 0.04 : 0.22})`); sh.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
}
