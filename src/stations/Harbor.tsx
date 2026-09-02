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

    /* fresh, transferable canvases for this mount */
    const trailCv = document.createElement("canvas");
    trailCv.setAttribute("aria-hidden", "true");
    const mainCv = document.createElement("canvas");
    mainCv.setAttribute("aria-label", `Living diagram of the Reiyah engine processing ${artifacts.length} digest-verified artifacts`);
    wrap.insertBefore(mainCv, wrap.firstChild);   // main above trail
    wrap.insertBefore(trailCv, wrap.firstChild);  // trail behind

    const reducedMq = matchMedia("(prefers-reduced-motion: reduce)");
    const readEnv = (): HarborEnv => ({
      w: mainCv.clientWidth, h: mainCv.clientHeight,
      dpr: Math.min(2, window.devicePixelRatio || 1),
      dark: document.documentElement.dataset.ground === "dark",
      reduced: reducedMq.matches,
    });
    const rectMouse = (e: PointerEvent) => {
      const r = mainCv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const canWorker =
      typeof OffscreenCanvas !== "undefined" &&
      typeof (mainCv as unknown as { transferControlToOffscreen?: unknown }).transferControlToOffscreen === "function" &&
      typeof Worker !== "undefined";

    /* ---------- main-thread fallback: the same engine, byte-identical ---------- */
    const runMainThread = () => {
      const engine = createHarborEngine(trailCv, mainCv, artifacts, badTotal, (w, h) => {
        const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
      });
      engineRef.current = engine;
      ruleSink.current = (m) => engine.setRuleMap(m);

      const onMove = (e: PointerEvent) => { const p = rectMouse(e); engine.setMouse(p.x, p.y, true); };
      const onLeave = () => engine.setMouse(-1, -1, false);
      mainCv.addEventListener("pointermove", onMove);
      mainCv.addEventListener("pointerleave", onLeave);

      let raf = 0;
      const tick = (now: number) => {
        const env = readEnv();
        engine.frame(now, env);
        if (!env.reduced) raf = requestAnimationFrame(tick);
      };
      engine.frame(performance.now(), readEnv()); // synchronous first frame -> no pop-in through the view transition
      if (!reducedMq.matches) raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
        engineRef.current = null;
        mainCv.removeEventListener("pointermove", onMove);
        mainCv.removeEventListener("pointerleave", onLeave);
        ruleSink.current = () => {};
        trailCv.remove(); mainCv.remove();
      };
    };

    let cleanup: () => void;
    if (canWorker) {
      let worker: Worker | null = null;
      try {
        worker = new Worker(new URL("./harbor.worker.ts", import.meta.url), { type: "module" });
      } catch {
        worker = null;
      }
      if (!worker) {
        cleanup = runMainThread();
      } else {
        const w = worker;
        workerRef.current = w;
        wrap.dataset.live = "false"; // fade the engine in when the worker's first frame lands
        const offTrail = (trailCv as unknown as { transferControlToOffscreen(): OffscreenCanvas }).transferControlToOffscreen();
        const offMain = (mainCv as unknown as { transferControlToOffscreen(): OffscreenCanvas }).transferControlToOffscreen();
        w.postMessage(
          { type: "init", trail: offTrail, main: offMain, artifacts, badTotal, env: readEnv() },
          [offTrail, offMain],
        );
        ruleSink.current = (m) => w.postMessage({ type: "ruleMap", map: m });
        w.onmessage = (e: MessageEvent) => { if ((e.data as { type?: string })?.type === "ready") wrap.dataset.live = "true"; };

        const pushEnv = () => w.postMessage({ type: "env", env: readEnv() });
        const ro = new ResizeObserver(pushEnv); ro.observe(mainCv);
        const mo = new MutationObserver(pushEnv);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ground"] });
        reducedMq.addEventListener("change", pushEnv);
        const onMove = (e: PointerEvent) => { const p = rectMouse(e); w.postMessage({ type: "mouse", x: p.x, y: p.y, over: true }); };
        const onLeave = () => w.postMessage({ type: "mouse", x: -1, y: -1, over: false });
        mainCv.addEventListener("pointermove", onMove);
        mainCv.addEventListener("pointerleave", onLeave);

        cleanup = () => {
          w.postMessage({ type: "stop" });
          w.terminate();
          workerRef.current = null;
          ro.disconnect(); mo.disconnect();
          reducedMq.removeEventListener("change", pushEnv);
          mainCv.removeEventListener("pointermove", onMove);
          mainCv.removeEventListener("pointerleave", onLeave);
          ruleSink.current = () => {};
          trailCv.remove(); mainCv.remove();
        };
      }
    } else {
      cleanup = runMainThread();
    }

    return cleanup;
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
