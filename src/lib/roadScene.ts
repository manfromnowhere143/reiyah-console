/* The road at night, shared by every station that looks through a
   windshield. Pure canvas 2D in measured pixels. Nothing here is data: it is
   the frame the data stands in, the horizon, the road, the cabin. Obsidian
   draws night, paper draws day; the geometry is identical on both grounds.
   Drawn once for a still station, once per frame for a moving one. */
import { useEffect, useState } from "react";

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
  ctx.fillStyle = `rgba(${VOID},0.97)`;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(pillarW * 0.42, 0); ctx.lineTo(pillarW, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w - pillarW * 0.42, 0); ctx.lineTo(w - pillarW, h); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(${RIM},${dark ? 0.11 : 0.15})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pillarW * 0.42, 0); ctx.lineTo(pillarW, h); ctx.moveTo(w - pillarW * 0.42, 0); ctx.lineTo(w - pillarW, h); ctx.stroke();
  if (dash > 0) {
    const y0 = h - dash;
    const top = new Path2D(); top.moveTo(0, y0 + dash * 0.35); top.quadraticCurveTo(w / 2, y0 - dash * 0.35, w, y0 + dash * 0.35);
    ctx.fillStyle = `rgba(${VOID},0.985)`;
    ctx.beginPath(); ctx.moveTo(0, y0 + dash * 0.35); ctx.quadraticCurveTo(w / 2, y0 - dash * 0.35, w, y0 + dash * 0.35); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${RIM},${dark ? 0.13 : 0.18})`; ctx.stroke(top);
  }
  /* the glass: one soft highlight from the upper left */
  const sh = ctx.createLinearGradient(0, 0, w * 0.55, h * 0.7);
  sh.addColorStop(0, `rgba(255,255,255,${dark ? 0.05 : 0.28})`); sh.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
}

/* the ground, observed: re-draws a still scene when the viewer flips it */
export function useGround(): boolean {
  const read = () => document.documentElement.dataset.ground === "dark";
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ground"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}
