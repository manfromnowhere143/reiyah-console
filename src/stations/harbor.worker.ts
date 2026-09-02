/* Harbor render worker. Owns the visible OffscreenCanvas and drives the engine
   on its own thread, so the sustained animation never competes with the main
   thread. Two render modes, decided once at init:
     - "gl": the engine draws the scene into an internal buffer; a WebGL2
       deferred pipeline (harborGL) does bloom, chromatic dispersion, vignette
       and grain, then presents to the visible canvas.
     - "2d": the engine draws straight to the visible canvas with its own 2D
       post (used where WebGL2 is unavailable).
   If WebGL2 is obtained but its pipeline cannot be built, or the GL context is
   lost, the worker asks the main thread to fall back on a fresh canvas — the
   visible canvas cannot be un-committed from a context it already holds. The
   main thread also runs a ready-timeout watchdog for the rare case where a
   software renderer stalls building shaders. */
import { createHarborEngine, type ArtifactRow, type HarborEnv } from "./harborEngine";
import { createHarborGL, type HarborGL, type HarborGLOpts } from "./harborGL";

type InMsg =
  | { type: "init"; canvas: OffscreenCanvas; artifacts: ArtifactRow[]; badTotal: number; env: HarborEnv }
  | { type: "env"; env: HarborEnv }
  | { type: "mouse"; x: number; y: number; over: boolean }
  | { type: "pulse"; at: number }
  | { type: "ruleMap"; map: Record<string, string> }
  | { type: "stop" };

const post = (msg: unknown) => { try { (self as unknown as Worker).postMessage(msg); } catch { /* noop */ } };

const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const caf: (h: number) => void =
  typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (h) => clearTimeout(h);

const makeCanvas = (w: number, h: number) => new OffscreenCanvas(w, h);

let engine: ReturnType<typeof createHarborEngine> | null = null;
let glPost: HarborGL | null = null;
let scene: OffscreenCanvas | null = null;   // engine output in gl mode
let canvas: OffscreenCanvas | null = null;  // the visible canvas
let mode: "gl" | "2d" = "2d";
let env: HarborEnv | null = null;
let running = false;
let handle = 0;
let announced = false;

function glOpts(now: number): HarborGLOpts {
  const dark = !!env?.dark;
  return {
    dark,
    bloom: dark ? 0.9 : 0.34,
    dispersion: dark ? 0.0009 : 0.0006,
    vignette: dark ? 0.5 : 0.32,
    grain: dark ? 0.045 : 0.02,
    time: now / 1000,
  };
}

const loop = (now: number) => {
  if (!running || !engine || !env) return;
  try {
    if (mode === "gl" && glPost && scene && canvas) {
      const wDev = Math.max(1, Math.round(env.w * env.dpr));
      const hDev = Math.max(1, Math.round(env.h * env.dpr));
      if (canvas.width !== wDev || canvas.height !== hDev) { canvas.width = wDev; canvas.height = hDev; }
      engine.frame(now, { ...env, post: "none" });
      glPost.render(scene, wDev, hDev, glOpts(now));
    } else {
      engine.frame(now, { ...env, post: "canvas" });
    }
    if (!announced) { announced = true; post({ type: "ready", mode }); }
  } catch (err) {
    running = false;
    if (mode === "gl" && !announced) { post({ type: "needfallback" }); return; }
    post({ type: "error", where: "frame", message: String((err as Error)?.message ?? err) });
    return;
  }
  if (env.reduced) { running = false; return; }   // reduced motion: rest after a settle frame
  handle = raf(loop);
};

self.onmessage = (e: MessageEvent<InMsg>) => {
  const m = e.data;
  switch (m.type) {
    case "init": {
      try {
        canvas = m.canvas;
        env = m.env;
        let gl: WebGL2RenderingContext | null = null;
        try {
          gl = canvas.getContext("webgl2", { antialias: false, depth: false, stencil: false, premultipliedAlpha: true, alpha: true });
        } catch { gl = null; }
        if (gl) {
          const built = createHarborGL(gl);
          if (built) {
            glPost = built;
            scene = new OffscreenCanvas(2, 2);
            engine = createHarborEngine(scene, m.artifacts, m.badTotal, makeCanvas);
            mode = "gl";
            (canvas as unknown as EventTarget).addEventListener?.("webglcontextlost", (ev) => {
              (ev as Event).preventDefault?.();
              running = false; caf(handle);
              post({ type: "needfallback" });
            });
          } else {
            // WebGL2 present but the pipeline would not build; the canvas is
            // committed to webgl2, so the main thread must retry on a fresh one.
            post({ type: "needfallback" });
            return;
          }
        }
        if (!engine) {
          engine = createHarborEngine(canvas, m.artifacts, m.badTotal, makeCanvas);
          mode = "2d";
        }
        running = true;
        announced = false;
        handle = raf(loop);
      } catch (err) {
        post({ type: "error", where: "init", message: String((err as Error)?.message ?? err) });
      }
      break;
    }
    case "env": {
      env = m.env;
      if (engine && !running) { running = true; handle = raf(loop); }
      break;
    }
    case "mouse": engine?.setMouse(m.x, m.y, m.over); break;
    case "pulse": engine?.setPulse(m.at); break;
    case "ruleMap": engine?.setRuleMap(m.map); break;
    case "stop":
      running = false; caf(handle);
      glPost?.dispose(); glPost = null; engine = null; scene = null; canvas = null;
      break;
  }
};
