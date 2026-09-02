/* Harbor render worker. Owns the OffscreenCanvas pair and drives the engine on
   its own thread, so the sustained animation never competes with the main
   thread — scrolling, navigation, and the proof overlay stay responsive even
   while the engine is fully alive. The main thread only forwards inputs
   (size, theme, pointer, pulse) and receives one "ready" signal. */
import { createHarborEngine, type ArtifactRow, type HarborEnv } from "./harborEngine";

type InMsg =
  | { type: "init"; trail: OffscreenCanvas; main: OffscreenCanvas; artifacts: ArtifactRow[]; badTotal: number; env: HarborEnv }
  | { type: "env"; env: HarborEnv }
  | { type: "mouse"; x: number; y: number; over: boolean }
  | { type: "pulse"; at: number }
  | { type: "ruleMap"; map: Record<string, string> }
  | { type: "stop" };

const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const caf: (h: number) => void =
  typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (h) => clearTimeout(h);

let engine: ReturnType<typeof createHarborEngine> | null = null;
let env: HarborEnv | null = null;
let running = false;
let handle = 0;
let announced = false;

const loop = (now: number) => {
  if (!running || !engine || !env) return;
  engine.frame(now, env);
  if (!announced) { announced = true; (self as unknown as Worker).postMessage({ type: "ready" }); }
  /* reduced motion: draw a couple of settle frames, then rest */
  if (env.reduced) { if (announced) { running = false; return; } }
  handle = raf(loop);
};

self.onmessage = (e: MessageEvent<InMsg>) => {
  const m = e.data;
  switch (m.type) {
    case "init": {
      engine = createHarborEngine(m.trail, m.main, m.artifacts, m.badTotal, (w, h) => new OffscreenCanvas(w, h));
      env = m.env;
      running = true;
      announced = false;
      /* one immediate frame, then the loop */
      handle = raf(loop);
      break;
    }
    case "env": {
      env = m.env;
      if (engine && !running) { running = true; handle = raf(loop); } // wake from reduced rest
      break;
    }
    case "mouse": engine?.setMouse(m.x, m.y, m.over); break;
    case "pulse": engine?.setPulse(m.at); break;
    case "ruleMap": engine?.setRuleMap(m.map); break;
    case "stop": running = false; caf(handle); engine = null; break;
  }
};
