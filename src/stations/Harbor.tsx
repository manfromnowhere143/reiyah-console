/* HARBOR — THE LIVING ENGINE. The simulation and render live in a pure engine
   (harborEngine.ts). It runs either inside a Web Worker over an OffscreenCanvas
   — so the sustained animation never touches the main thread and the UI stays
   responsive on any device — or, where that is unsupported, on the main thread
   as a byte-identical fallback. The two canvases are created imperatively so
   each mount owns fresh, transferable elements (transferControlToOffscreen may
   run only once per element, and React StrictMode double-invokes effects). */
import { useEffect, useRef } from "react";
import { claimShort, fetchLane, fetchLaneText, parseAC, parseConvergence, parseH3, parseH6, parseRegister, parseV, registerPath } from "../lib/gateb";
import { fetchCatalog, getSealedInfo } from "../lib/evidence";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { Digest, useSurfaceState } from "../components/primitives";
import { fetchSurface } from "../lib/evidence";
import { createHarborEngine, type ArtifactRow, type HarborEngine, type HarborEnv } from "./harborEngine";

/* the instruments' data: every number from committed bytes; primed during boot
   so the first screen mounts with its numbers in hand, and re-read on every
   re-verification (the station keys this loader on the pulse) */
export async function loadHarborInstruments() {
  const lane = await fetchLane();
  const [cat] = await Promise.all([fetchCatalog().catch(() => [])]);
  const diVersions = [...new Set(cat.map((c) => c.path).filter((p) => p.includes("operator-decision-interface")).map((p) => p.match(/1\.2\.\d+/)?.[0]).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!lane.present) return { lane, diVersions, reg: null, auto: null, h3: null, h6: null, ac: null, v: null };
  const [R, L, H3, H6, AC, V] = await Promise.all([await registerPath(), "evidence/measurement/result_l.txt", "human-channel/evidence/h3_observation_response_joint.txt", "human-channel/evidence/h6_total_both_miss.txt", "llm-generalization/evidence/result_ac.txt", "llm-generalization/evidence/result_v.txt"].map((q) => fetchLaneText(q).catch(() => null)));
  return {
    lane, diVersions,
    reg: R ? { ...parseRegister(R.text), file: R.file } : null,
    auto: L ? { ...parseConvergence(L.text), file: L.file } : null,
    h3: H3 ? { ...parseH3(H3.text), file: H3.file } : null,
    h6: H6 ? (() => { const v = parseH6(H6.text); return v ? { ...v, file: H6.file } : null; })() : null,
    ac: AC ? (() => { const v = parseAC(AC.text); return v ? { ...v, file: AC.file } : null; })() : null,
    v: V ? (() => { const v = parseV(V.text); return v ? { ...v, file: V.file } : null; })() : null,
  };
}

export function Harbor({ ev, go, pulse }: { ev: VerifiedEvidence; go: (id: string) => void; pulse?: number }) {
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
      dash: cv.clientWidth < 760 ? Math.round(cv.clientHeight * 0.1) : Math.round(cv.clientHeight * 0.26),
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

  /* the instruments: every number from committed bytes, warmed after boot,
     re-read on every re-verification (pulse) */
  const inst = useSurfaceState(loadHarborInstruments, [pulse]);
  const I = inst.phase === "ready" ? inst.data : null;
  const sealed = getSealedInfo();
  const src = (f: { id: string; path: string; sha256?: string }) => ({ id: `gateb/${f.id}`, path: `gate-b · ${f.path}`, sha256: f.sha256 ?? "" });
  const autoT = I?.auto?.terminal ?? null;
  const h3all = I?.h3?.groups.find((g) => g.name === "all events") ?? null;
  const mmlu = I?.ac?.benches.find((b) => b.name === "mmlu")?.q.get("marginal c, mean") ?? null;
  const marks: Array<{ c: number; cross: boolean; name: string }> = [
    ...(autoT ? [{ c: autoT.c, cross: false, name: "camera × lidar" }] : []),
    ...(h3all ? [{ c: h3all.c, cross: false, name: "eyes × hands" }] : []),
    ...(mmlu ? [{ c: mmlu.point, cross: false, name: "LLM jury" }] : []),
    ...(I?.h6 ? [{ c: I.h6.c, cross: true, name: "human × machine" }] : []),
  ];
  const status = (re: RegExp) => I?.reg?.claims.filter((c) => re.test(c.status)).length ?? 0;
  const regCounts: Array<[string, number, string]> = I?.reg ? [
    ["measured", status(/^measured$/), "ok"], ["derived", status(/^derived$/), "ok"], ["narrowed", status(/^narrowed$/), "ink"],
    ["inconclusive", status(/^inconclusive$/), "faint"], ["unknown", status(/^(unknown|not_established)$/), "faint"], ["withdrawn", status(/withdrawn/), "red"],
  ] : [];
  const regTotal = I?.reg?.claims.length ?? 0;
  const engineHead = ev.summary?.identity?.state === "observed" ? ev.summary.identity : null;

  void auth;
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
      <div className="fieldwrap" ref={wrapRef}>{/* the canvas is created imperatively by the effect above */}</div>
      <div className="dash" data-ready={String(!!I)} aria-label="The dashboard: six instruments, every number a committed byte">
          <button className="gauge" onClick={() => go("ledger")}>
            <span className="gk">the field</span>
            <span className="gv">{artifacts.length.toLocaleString()}<em> sealed</em></span>
            <span className="gs"><b className="red">{badTotal}</b> rejected by design</span>
            <span className="gd" onClick={(e) => e.stopPropagation()}><Digest id="index" sha={ev.indexSha256} path="gate/GATE_A_EVIDENCE_INDEX.json" /></span>
          </button>
          <button className="gauge" onClick={() => go("chair")}>
            <span className="gk">it corrects itself</span>
            <span className="gv">{I ? I.diVersions.length : "∅"}<em> releases</em></span>
            <span className="gs">{I && I.diVersions.length ? `${I.diVersions[0]} → ${I.diVersions.at(-1)} · acceptance ${String(auth.operator_acceptance_state ?? "unknown")}` : "operator decision records not present"}</span>
          </button>
          <button className="gauge glaw" onClick={() => go("law")}>
            <span className="gk">the law · one estimand</span>
            <svg viewBox="0 0 200 34" className="glawline" aria-label="Same-kind pairings above one, human and machine at one">
              <line x1={((1 - 0.9) / 1.6) * 200} x2={((1 - 0.9) / 1.6) * 200} y1="4" y2="30" className="mind" />
              {marks.map((m) => { const x = ((Math.min(2.5, m.c) - 0.9) / 1.6) * 200; return <g key={m.name} className={m.cross ? "cross" : "same"}><line x1={((1 - 0.9) / 1.6) * 200} x2={x} y1="17" y2="17" /><circle cx={x} cy="17" r="4" /></g>; })}
              <text x="0" y="31" textAnchor="start">1.0</text><text x="200" y="31" textAnchor="end">2.5</text>
            </svg>
            <span className="gs">{marks.length ? "same kind fails together · human and machine near independence" : "lane transcripts not present"}</span>
          </button>
          <button className="gauge" onClick={() => go("law")}>
            <span className="gk">the register</span>
            <span className="gv">{regTotal || "∅"}<em> claims</em></span>
            <span className="regbar" aria-hidden="true">{regCounts.map(([k, n, tone]) => n > 0 && <i key={k} className={`rs ${tone}`} style={{ flex: n }} title={`${k} ${n}`} />)}</span>
            <span className="gs">{I?.reg ? regCounts.filter(([, n]) => n > 0).slice(0, 3).map(([k, n]) => `${n} ${k}`).join(" · ") : "register not present"}</span>
          </button>
          <button className="gauge" onClick={() => go("monitor")}>
            <span className="gk">the monitor</span>
            <span className="gv">{I?.v ? I.v.monitor.auc.toFixed(3) : "∅"}<em> AUC</em></span>
            <span className="gs">{I?.v ? `vs naive ${I.v.naive.auc.toFixed(3)} · read from outputs alone` : "Result V not present"}</span>
          </button>
          <button className="gauge" onClick={() => go("lineage")}>
            <span className="gk">the source</span>
            <span className="gv small">{engineHead ? engineHead.head.slice(0, 7) : sealed?.head.slice(0, 7) ?? "∅"}<em> engine</em>{I?.lane.identity ? <em> · lane {I.lane.identity.head.slice(0, 7)}</em> : null}</span>
            <span className="gs">{engineHead ? `${engineHead.worktree_clean ? "clean" : "dirty"} · verified live` : sealed ? `${sealed.branch.replace(/^gate-a-/, "")} · ${new Date(sealed.sealedAt).toLocaleString("en-GB", { hour12: false, dateStyle: "short", timeStyle: "short" })}` : "identity blocked"}</span>
          </button>
      </div>
    </div>
  );
}
