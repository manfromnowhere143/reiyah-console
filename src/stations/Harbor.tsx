/* HARBOR — THE LIVING ENGINE. The simulation and render live in a pure engine
   (harborEngine.ts). It runs either inside a Web Worker over an OffscreenCanvas
   — so the sustained animation never touches the main thread and the UI stays
   responsive on any device — or, where that is unsupported, on the main thread
   as a byte-identical fallback. The two canvases are created imperatively so
   each mount owns fresh, transferable elements (transferControlToOffscreen may
   run only once per element, and React StrictMode double-invokes effects). */
import { useEffect, useRef } from "react";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { Digest } from "../components/primitives";
import { fetchSurface } from "../lib/evidence";
import { createHarborEngine, type ArtifactRow, type HarborEngine, type HarborEnv } from "./harborEngine";

export function Harbor({ ev, pulse }: { ev: VerifiedEvidence; go: (id: string) => void; pulse?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const engineRef = useRef<HarborEngine | null>(null);
  const ruleSink = useRef<(m: Record<string, string>) => void>(() => {});

  const artifacts: ArtifactRow[] = ev.index?.artifacts ?? [];
  const auth = ev.index?.authority ?? {};
  const proj = ev.index?.candidate_projection ?? {};
  const badTotal = artifacts.filter((a) => a.role === "known_bad_fixture").length;

  /* rejection-rule map: loaded live, forwarded to whichever host is running */
  useEffect(() => {
    fetchSurface<any>("fixtures").then((s) => {
      if (s.state !== "observed") return;
      const m: Record<string, string> = {};
      for (const f of s.data.fixtures ?? []) if (f.expected_primary_rule_id) m[f.path] = f.expected_primary_rule_id;
      ruleSink.current(m);
    });
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
    const domMakeCanvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

    /* every canvas this mount creates (worker path may discard one and make a
       fresh one for the fallback) so cleanup removes them all */
    const canvases: HTMLCanvasElement[] = [];
    const makeVisibleCanvas = () => {
      const c = document.createElement("canvas");
      c.setAttribute("aria-label", `Living diagram of the Reiyah engine processing ${artifacts.length} digest-verified artifacts`);
      wrap.insertBefore(c, wrap.firstChild);
      canvases.push(c);
      return c;
    };
    const readEnv = (cv: HTMLCanvasElement): HarborEnv => ({
      w: cv.clientWidth, h: cv.clientHeight,
      dpr: Math.min(2, window.devicePixelRatio || 1),
      dark: document.documentElement.dataset.ground === "dark",
      reduced: reducedMq.matches,
    });
    const rectMouse = (cv: HTMLCanvasElement, e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    /* the current host owns a list of teardown callbacks; switching hosts (a GL
       failover) tears the old one down before starting the new */
    let teardown: Array<() => void> = [];
    const runTeardown = () => { for (const t of teardown.splice(0)) { try { t(); } catch { /* noop */ } } };

    /* ---------- main-thread 2D fallback (also the no-worker path) ---------- */
    const startFallback = () => {
      if (disposed) return;
      wrap.removeAttribute("data-live"); // visible immediately: the synchronous first frame lands in the view-transition snapshot
      wrap.dataset.render = "2d";
      const cv = makeVisibleCanvas();
      const engine = createHarborEngine(cv, artifacts, badTotal, domMakeCanvas);
      engineRef.current = engine;
      ruleSink.current = (m) => engine.setRuleMap(m);
      const onMove = (e: PointerEvent) => { const p = rectMouse(cv, e); engine.setMouse(p.x, p.y, true); };
      const onLeave = () => engine.setMouse(-1, -1, false);
      cv.addEventListener("pointermove", onMove);
      cv.addEventListener("pointerleave", onLeave);
      let raf = 0;
      const tick = (now: number) => {
        const env = readEnv(cv);
        engine.frame(now, env);
        if (!env.reduced) raf = requestAnimationFrame(tick);
      };
      engine.frame(performance.now(), readEnv(cv)); // synchronous first frame
      if (!reducedMq.matches) raf = requestAnimationFrame(tick);
      teardown.push(() => {
        cancelAnimationFrame(raf);
        engineRef.current = null;
        cv.removeEventListener("pointermove", onMove);
        cv.removeEventListener("pointerleave", onLeave);
        ruleSink.current = () => {};
      });
    };

    /* ---------- worker path (OffscreenCanvas; GL or 2D inside the worker) ---------- */
    const startWorker = () => {
      let worker: Worker | null = null;
      try { worker = new Worker(new URL("./harbor.worker.ts", import.meta.url), { type: "module" }); } catch { worker = null; }
      if (!worker) { startFallback(); return; }
      const w = worker;
      workerRef.current = w;
      const cv = makeVisibleCanvas();
      wrap.dataset.live = "false"; // fade in when the worker's first frame lands
      const off = (cv as unknown as { transferControlToOffscreen(): OffscreenCanvas }).transferControlToOffscreen();
      w.postMessage({ type: "init", canvas: off, artifacts, badTotal, env: readEnv(cv) }, [off]);
      ruleSink.current = (m) => w.postMessage({ type: "ruleMap", map: m });

      let ready = false;
      const failover = () => {
        if (ready || disposed) return;
        ready = true; clearTimeout(wd);
        runTeardown();       // tear the worker host down
        cv.remove();         // drop the transferred (dead) canvas
        startFallback();     // restart on a fresh main-thread canvas
      };
      const wd = window.setTimeout(failover, 4500); // software renderers can stall building shaders; then fall back

      w.onmessage = (e: MessageEvent) => {
        const d = e.data as { type?: string; mode?: string; where?: string; message?: string };
        if (d?.type === "ready") { ready = true; clearTimeout(wd); wrap.dataset.live = "true"; if (d.mode) wrap.dataset.render = d.mode; }
        else if (d?.type === "needfallback") { failover(); }
        else if (d?.type === "error") { console.error(`[harbor.worker:${d.where}]`, d.message); wrap.dataset.live = "true"; }
      };
      w.onerror = () => { failover(); };

      const pushEnv = () => w.postMessage({ type: "env", env: readEnv(cv) });
      const ro = new ResizeObserver(pushEnv); ro.observe(cv);
      const mo = new MutationObserver(pushEnv);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ground"] });
      reducedMq.addEventListener("change", pushEnv);
      const onMove = (e: PointerEvent) => { const p = rectMouse(cv, e); w.postMessage({ type: "mouse", x: p.x, y: p.y, over: true }); };
      const onLeave = () => w.postMessage({ type: "mouse", x: -1, y: -1, over: false });
      cv.addEventListener("pointermove", onMove);
      cv.addEventListener("pointerleave", onLeave);

      teardown.push(() => {
        clearTimeout(wd);
        w.postMessage({ type: "stop" });
        w.terminate();
        workerRef.current = null;
        ro.disconnect(); mo.disconnect();
        reducedMq.removeEventListener("change", pushEnv);
        cv.removeEventListener("pointermove", onMove);
        cv.removeEventListener("pointerleave", onLeave);
        ruleSink.current = () => {};
      });
    };

    const canWorker =
      typeof OffscreenCanvas !== "undefined" &&
      typeof (document.createElement("canvas") as unknown as { transferControlToOffscreen?: unknown }).transferControlToOffscreen === "function" &&
      typeof Worker !== "undefined";

    if (canWorker) startWorker(); else startFallback();

    return () => {
      disposed = true;
      runTeardown();
      for (const c of canvases) c.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts]);

  const authRows: Array<[string, string]> = [
    ["runtime_authorized", String(auth.runtime_authorized ?? "unknown").toUpperCase()],
    ["scientific_claim_authority", String(auth.scientific_claim_authority ?? "unknown").toUpperCase()],
    ["gate_b_authorized", String(auth.gate_b_authorized ?? "unknown").toUpperCase()],
    ["operator_acceptance", String(auth.operator_acceptance_state ?? "unknown").toUpperCase()],
    ["ga_17", String(auth.ga_17_state ?? "unknown").toUpperCase()],
    ["transport_verification", String(auth.transport_verification_state ?? "unknown").toUpperCase()],
  ];

  return (
    <div className="harbor">
      <div className="fieldwrap" ref={wrapRef}>
        {/* the two canvases are created imperatively by the effect above */}
        <div className="harbortitle">
          THE LIVING ENGINE · {artifacts.length.toLocaleString()} ARTIFACTS · {Number(proj.total_bytes ?? 0).toLocaleString()} BYTES · {badTotal} REJECTED BY DESIGN
        </div>
        <div className="fieldhud">
          <div className="fh">
            <Digest id="index" sha={ev.indexSha256} path="gate/GATE_A_EVIDENCE_INDEX.json" />
          </div>
          <div className="fh authwall glass" style={{ maxWidth: "34rem" }}>
            {authRows.map(([k, v]) => (
              <div key={k} className="authrow"><span>{k}</span><span className="st">{v}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
