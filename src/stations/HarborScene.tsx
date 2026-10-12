/* The original Harbor renderer, with visibility/pause control and recoverable
   worker failover. Motion illustrates the saved index; it is not live inference. */
import { useEffect, useRef, useState } from "react";
import { useStationReadiness } from "../components/StationFrame";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { fetchSurface } from "../lib/evidence";
import {
  createHarborEngine,
  type ArtifactRow,
  type HarborEngine,
  type HarborEnv,
} from "./harborEngine";
export function HarborScene({
  ev,
  pulse,
}: {
  ev: VerifiedEvidence;
  pulse?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const engineRef = useRef<HarborEngine | null>(null);
  const rules = useRef<Record<string, string>>({});
  const ruleSink = useRef<(m: Record<string, string>) => void>(() => {});

  const artifacts: ArtifactRow[] = ev.index?.artifacts ?? [];
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const refresh = useRef<() => void>(() => {});
  useEffect(() => refresh.current(), [paused]);
  const [sceneReady, setSceneReady] = useState(false);
  useStationReadiness(
    sceneReady || artifacts.length === 0 ? "ready" : "loading",
  );
  const badTotal = artifacts.filter(
    (a) => a.role === "known_bad_fixture",
  ).length;

  /* rejection-rule map: loaded live, forwarded to whichever host is running */
  useEffect(() => {
    let alive = true;
    fetchSurface<any>("fixtures").then((s) => {
      if (!alive || s.state !== "observed") return;
      const m: Record<string, string> = {};
      for (const f of s.data.fixtures ?? [])
        if (f.expected_primary_rule_id) m[f.path] = f.expected_primary_rule_id;
      rules.current = m;
      ruleSink.current(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* re-verify pulse -> surge, forwarded to the running host */
  useEffect(() => {
    if (!pulse) return;
    const at = performance.now();
    if (workerRef.current) workerRef.current.postMessage({ type: "pulse", at });
    else engineRef.current?.setPulse(at);
  }, [pulse]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || artifacts.length === 0) return;
    let disposed = false;

    const reducedMq = matchMedia("(prefers-reduced-motion: reduce)");
    const domMakeCanvas = (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    };

    /* every canvas this mount creates (worker path may discard one and make a
       fresh one for the fallback) so cleanup removes them all */
    const canvases: HTMLCanvasElement[] = [];
    const makeVisibleCanvas = () => {
      const c = document.createElement("canvas");
      c.setAttribute(
        "aria-label",
        `Illustrated engine architecture with ${artifacts.length} artifact identities from the verified historical index. Motion is conceptual, not a running evaluation.`,
      );
      wrap.insertBefore(c, wrap.firstChild);
      canvases.push(c);
      return c;
    };
    const readEnv = (cv: HTMLCanvasElement): HarborEnv => ({
      w: cv.clientWidth,
      h: cv.clientHeight,
      dpr: Math.min(2, window.devicePixelRatio || 1),
      dark: document.documentElement.dataset.ground === "dark",
      reduced: reducedMq.matches || pausedRef.current || document.hidden,
      dash: Math.round(cv.clientHeight * 0.12),
    });
    const rectMouse = (cv: HTMLCanvasElement, e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    /* the current host owns a list of teardown callbacks; switching hosts (a GL
       failover) tears the old one down before starting the new */
    let teardown: Array<() => void> = [];
    const runTeardown = () => {
      for (const t of teardown.splice(0)) {
        try {
          t();
        } catch {
          /* noop */
        }
      }
    };

    /* ---------- main-thread 2D fallback (also the no-worker path) ---------- */
    const startFallback = () => {
      if (disposed) return;
      wrap.removeAttribute("data-live"); // visible immediately: the synchronous first frame lands in the view-transition snapshot
      wrap.dataset.render = "2d";
      const cv = makeVisibleCanvas();
      const engine = createHarborEngine(cv, artifacts, badTotal, domMakeCanvas);
      engineRef.current = engine;
      ruleSink.current = (m) => engine.setRuleMap(m);
      engine.setRuleMap(rules.current);
      const onMove = (e: PointerEvent) => {
        const p = rectMouse(cv, e);
        engine.setMouse(p.x, p.y, true);
      };
      const onLeave = () => engine.setMouse(-1, -1, false);
      cv.addEventListener("pointermove", onMove);
      cv.addEventListener("pointerleave", onLeave);
      let raf = 0,
        announced = false;
      const tick = (now: number) => {
        if (disposed || document.hidden) return;
        const env = readEnv(cv);
        try {
          engine.frame(now, env);
          if (!announced) {
            announced = true;
            setSceneReady(true);
          }
        } catch {
          setError(
            "The scene renderer is unavailable. Evidence remains accessible below.",
          );
          setSceneReady(true);
          return;
        }
        if (!env.reduced) raf = requestAnimationFrame(tick);
      };
      const redraw = () => {
        cancelAnimationFrame(raf);
        tick(performance.now());
      };
      refresh.current = redraw;
      const ro = new ResizeObserver(redraw);
      ro.observe(cv);
      const mo = new MutationObserver(redraw);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-ground"],
      });
      reducedMq.addEventListener("change", redraw);
      document.addEventListener("visibilitychange", redraw);
      redraw();
      teardown.push(() => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        mo.disconnect();
        reducedMq.removeEventListener("change", redraw);
        document.removeEventListener("visibilitychange", redraw);
        refresh.current = () => {};
        engineRef.current = null;
        cv.removeEventListener("pointermove", onMove);
        cv.removeEventListener("pointerleave", onLeave);
        ruleSink.current = () => {};
      });
    };

    /* ---------- worker path (OffscreenCanvas; GL or 2D inside the worker) ---------- */
    const startWorker = () => {
      let worker: Worker | null = null;
      try {
        worker = new Worker(new URL("./harbor.worker.ts", import.meta.url), {
          type: "module",
        });
      } catch {
        worker = null;
      }
      if (!worker) {
        startFallback();
        return;
      }
      const w = worker;
      workerRef.current = w;
      const cv = makeVisibleCanvas();
      wrap.dataset.live = "false"; // the opening waits for the worker's first frame
      let off: OffscreenCanvas;
      try {
        off = cv.transferControlToOffscreen();
      } catch {
        w.terminate();
        workerRef.current = null;
        cv.remove();
        startFallback();
        return;
      }
      w.postMessage(
        { type: "init", canvas: off, artifacts, badTotal, env: readEnv(cv) },
        [off],
      );
      ruleSink.current = (m) => w.postMessage({ type: "ruleMap", map: m });
      ruleSink.current(rules.current);

      let failed = false;
      const failover = () => {
        if (failed || disposed) return;
        failed = true;
        clearTimeout(wd);
        runTeardown(); // tear the worker host down
        cv.remove(); // drop the transferred (dead) canvas
        startFallback(); // restart on a fresh main-thread canvas
      };
      const wd = window.setTimeout(failover, 4500); // software renderers can stall building shaders; then fall back

      w.onmessage = (e: MessageEvent) => {
        if (disposed || failed) return;
        const d = e.data as {
          type?: string;
          mode?: string;
          where?: string;
          message?: string;
        };
        if (d?.type === "ready") {
          clearTimeout(wd);
          wrap.dataset.live = "true";
          if (d.mode) wrap.dataset.render = d.mode;
          setSceneReady(true);
        } else if (d?.type === "needfallback") {
          failover();
        } else if (d?.type === "error") {
          failover();
        }
      };
      w.onerror = () => {
        failover();
      };

      const pushEnv = () => w.postMessage({ type: "env", env: readEnv(cv) });
      refresh.current = pushEnv;
      document.addEventListener("visibilitychange", pushEnv);
      const ro = new ResizeObserver(pushEnv);
      ro.observe(cv);
      const mo = new MutationObserver(pushEnv);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-ground"],
      });
      reducedMq.addEventListener("change", pushEnv);
      const onMove = (e: PointerEvent) => {
        const p = rectMouse(cv, e);
        w.postMessage({ type: "mouse", x: p.x, y: p.y, over: true });
      };
      const onLeave = () =>
        w.postMessage({ type: "mouse", x: -1, y: -1, over: false });
      cv.addEventListener("pointermove", onMove);
      cv.addEventListener("pointerleave", onLeave);

      teardown.push(() => {
        clearTimeout(wd);
        w.postMessage({ type: "stop" });
        w.terminate();
        workerRef.current = null;
        ro.disconnect();
        mo.disconnect();
        document.removeEventListener("visibilitychange", pushEnv);
        refresh.current = () => {};
        reducedMq.removeEventListener("change", pushEnv);
        cv.removeEventListener("pointermove", onMove);
        cv.removeEventListener("pointerleave", onLeave);
        ruleSink.current = () => {};
      });
    };

    const canWorker =
      typeof OffscreenCanvas !== "undefined" &&
      typeof (
        document.createElement("canvas") as unknown as {
          transferControlToOffscreen?: unknown;
        }
      ).transferControlToOffscreen === "function" &&
      typeof Worker !== "undefined";

    if (canWorker) startWorker();
    else startFallback();

    return () => {
      disposed = true;
      runTeardown();
      for (const c of canvases) c.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts]);

  return (
    <div className="harbor-scene">
      <div className="fieldwrap" ref={wrapRef} />
      <div className="scene-caption">
        <span>Driving perspective · conceptual evidence flow</span>
        <button
          className="scene-pause"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
        >
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      </div>
      {error && (
        <p role="status" className="scene-error">
          {error}
        </p>
      )}
    </div>
  );
}
