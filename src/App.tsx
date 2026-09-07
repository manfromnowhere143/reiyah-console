/* HARBOR INSTRUMENT — one permanent stage.
   Harbor's Living Engine is the home of the panel; pressing a dock card
   morphs the panel's content in place through the View Transitions API
   (compositor-speed cross-morph; jump cut under reduced motion). The dock
   and HUD never move. The URL is the panel state. Escape returns home. */
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ProofBoot, verifyEvidenceOnce, type VerifiedEvidence } from "./boot/ProofBoot";
import { STATIONS } from "./lib/camera";
import { getSealedInfo, subscribeEvents, warmSealedSurfaces } from "./lib/evidence";
import { warmLane } from "./lib/gateb";
import { Mark, TruthPill } from "./components/primitives";
import { GroundToggle } from "./components/GroundToggle";
import { Palette } from "./components/Palette";
import { ReceiptHost } from "./components/primitives";
import { Harbor } from "./stations/Harbor";
import { Dock } from "./components/Dock";
import { STATION_CODE, prefetchNeighbours, prefetchStation, warmFieldGently } from "./lib/prefetch";

/* every station but the Harbor is its own code chunk, fetched when first
   pressed (or a moment earlier, by the neighbour prefetch); the Harbor is the
   first screen and ships in the main bundle. The chunks are held in a plain
   registry rather than React.lazy: a component that suspends during the
   navigation commit would show its fallback and React would then hold the
   reveal for its 300 ms throttle, which is exactly the flash being removed.
   Here the module is awaited before the commit, so the station renders
   complete on its first frame. */
const stationModules = new Map<string, React.ComponentType<any>>();
const stationLoads = new Map<string, Promise<void>>();
function ensureStation(id: string): Promise<void> {
  if (stationModules.has(id)) return Promise.resolve();
  if (!STATION_CODE[id]) return Promise.resolve();
  if (!stationLoads.has(id)) {
    stationLoads.set(id, STATION_CODE[id]().then((m: any) => {
      const C = Object.values(m).find((v) => typeof v === "function") as React.ComponentType<any> | undefined;
      if (C) stationModules.set(id, C);
    }).catch(() => { stationLoads.delete(id); }));
  }
  return stationLoads.get(id)!;
}

export default function App() {
  const [evidence, setEvidence] = useState<VerifiedEvidence | null>(null);
  return (
    <>
      {!evidence && <GroundToggle />}
      {!evidence
        ? <ProofBoot onReady={setEvidence} />
        : <Stage ev={evidence} onEvidence={setEvidence} />}
    </>
  );
}

const urlStation = () => new URLSearchParams(location.search).get("st") ?? "harbor";

function Stage({ ev, onEvidence }: { ev: VerifiedEvidence; onEvidence: (e: VerifiedEvidence) => void }) {
  const [active, setActive] = useState<string>(urlStation());
  const [lastEventAt, setLastEventAt] = useState<number | null>(Date.now());
  const [connected, setConnected] = useState(true);
  const [gen, setGen] = useState(0);
  const [violated, setViolated] = useState(false);
  const [, setCodeGen] = useState(0);
  const sealed = getSealedInfo();
  const reverifying = useRef(false);

  /* navigation: the panel content cross-morphs in place through the View
     Transitions API (compositor-only opacity + scale on the stage panel).
     The earlier shared-element "forge" morph is gone: WebKit snapshots only
     the composited parts of a named element, so mid-morph the new station
     appeared torn, a canvas and a chip floating with the rest missing. */
  /* navigation, in one motion. Before anything changes on screen the
     destination is prepared: its code chunk and the bytes it declares are
     fetched (both memoised; a neighbour is already warm). Then one view
     transition runs: the commit swaps the station and, before the browser
     snapshots the new state, waits until the station reports itself ready
     (no loading note, no canvas still at opacity 0, the Harbor's field live).
     A cap keeps a slow network from ever stalling the press: after it, the
     transition proceeds and the content arrives as it can. The old panel and
     the new are blended additively (instrument.css), so the crossfade never
     dips through darkness. Reduced motion: a jump cut, after the same wait. */
  const navSeq = useRef(0);
  const settle = (panel: Element | null, cap: number) => new Promise<void>((res) => {
    const t0 = performance.now();
    const pending = () => !!panel && panel.querySelector('[data-loading="true"], [data-ready="false"], [data-live="false"]') !== null;
    /* polled with a timer, not requestAnimationFrame: inside a view
       transition's callback rendering is paused and animation frames do not
       fire, while scripts, fetches and React commits keep running */
    const tick = () => { if (!pending() || performance.now() - t0 > cap) res(); else setTimeout(tick, 12); };
    tick();
  });
  const [pending, setPending] = useState<string | null>(null);
  const go = async (id: string, push = true, before?: () => void) => {
    if (id === active) { before?.(); return; }
    const seq = ++navSeq.current;
    /* the press answers at once: the card lights while the destination
       prepares (code and bytes). Warm, this takes a few milliseconds; cold,
       on a phone network, up to the cap, and the lit card is the feedback */
    setPending(id);
    const t0 = performance.now();
    await Promise.race([
      Promise.all([ensureStation(id), prefetchStation(id).catch(() => null)]),
      new Promise((r) => setTimeout(r, 260)),
    ]);
    if (seq !== navSeq.current) return; // a later press superseded this one
    setPending(null);
    const commit = () => {
      flushSync(() => { before?.(); setActive(id); });
      if (push) history.pushState({ st: id }, "", id === "harbor" ? location.pathname : `?st=${id}`);
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const svt = (document as any).startViewTransition?.bind(document);
    const panel = () => document.querySelector(".panelcontent");
    if (reduced || !svt) { commit(); return; }
    /* the remaining budget: a warm station settles in a few milliseconds; a
       cold one is given at most what is left of 380 ms in total, then the
       transition runs and its content arrives as it can. The screen is never
       held long enough to read as a stall. */
    svt(async () => { commit(); await settle(panel(), Math.max(60, 380 - (performance.now() - t0))); });
  };

  useEffect(() => {
    const onPop = () => {
      const id = urlStation();
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const svt = (document as any).startViewTransition?.bind(document);
      const commit = () => flushSync(() => setActive(id));
      if (!reduced && svt) svt(async () => { commit(); await settle(document.querySelector(".panelcontent"), 300); }); else commit();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go("harbor");
      const idx = STATIONS.findIndex((s) => s.id === active);
      if (e.key === "ArrowRight") go(STATIONS[(idx + 1) % STATIONS.length].id);
      if (e.key === "ArrowLeft") go(STATIONS[(idx - 1 + STATIONS.length) % STATIONS.length].id);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* after boot, in idle time, warm every station's bytes. Sealed bytes are
     content-addressed and immutable within a snapshot, so this is honest
     caching: a station then renders at once, with no loading flash. */
  useEffect(() => { warmSealedSurfaces(); warmLane(); }, []);

  useEffect(() => {
    const off = subscribeEvents((kind, at) => {
      if (kind === "error") { setConnected(false); return; }
      if (kind === "sealed") return;
      setConnected(true);
      setLastEventAt(at);
      if (kind === "evidence" && !reverifying.current) {
        reverifying.current = true;
        verifyEvidenceOnce()
          .then((next) => { onEvidence(next); setGen((g) => g + 1); setViolated(false); })
          .catch(() => setViolated(true))
          .finally(() => { reverifying.current = false; });
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idn = ev.summary.identity;
  const render = (id: string) => {
    if (id === "harbor") return <Harbor ev={ev} go={go} pulse={gen} />;
    const C = stationModules.get(id);
    const props: Record<string, unknown> = id === "ledger" || id === "controls" || id === "system" ? { ev } : id === "lineage" ? { summary: ev.summary } : {};
    if (!C) {
      /* the chunk is still arriving (the prepare cap passed): carry the
         loading marker so the transition waits for it, then re-render */
      ensureStation(id).then(() => setCodeGen((g) => g + 1));
      return <div data-loading="true" aria-hidden="true" />;
    }
    return <C {...props} />;
  };

  /* after each station renders: warm its two dock neighbours in idle time */
  useEffect(() => { prefetchNeighbours(active); }, [active]);
  /* once, after the first screen: the rest of the field, one station at a time */
  useEffect(() => { warmFieldGently(active); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="viewport stage">
      {/* liquid-glass refraction filters — real, defined once, Chromium-only
          (graceful blur fallback elsewhere). harborGlass splits light per
          channel at the edge: true chromatic dispersion, Apple's technique. */}
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="harborLens" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.014" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="harborGlass" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.011" numOctaves="2" seed="11" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="17" xChannelSelector="R" yChannelSelector="G" result="dr" />
            <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G" result="db" />
            <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
            <feBlend in="r" in2="gb" mode="screen" />
          </filter>
        </defs>
      </svg>
      <div className="hud">
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <span style={{ color: "var(--ink)" }}><Mark /></span>
          <span style={{ whiteSpace: "nowrap" }}><b>REIYAH</b><span className="brandfull"> <span className="dot">//</span> HARBOR INSTRUMENT</span></span>
          <GroundToggle />
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          {idn.state === "observed" && (
            <span className="hudid" style={{ letterSpacing: "0.06em" }}>
              {idn.branch || "detached"} · {idn.head.slice(0, 10)} · {idn.worktree_clean ? "CLEAN" : "DIRTY"}
            </span>
          )}
          <TruthPill lastEventAt={lastEventAt} connected={connected} sealed={sealed} violated={violated} />
          <Palette ev={ev} go={go} />
          <ReceiptHost />
          {active !== "harbor" ? (
            <button className="hudbtn" onClick={() => go("harbor")}>⌂<span className="brandfull"> HARBOR · ESC</span></button>
          ) : (
            <span className="hudid" style={{ color: "var(--ink-ghost)" }}>⇄ ARROWS · ESC HOME</span>
          )}
        </div>
      </div>

      <main className="stagepanel" aria-live="polite">
        <div key={`${active}:${gen}`} className="panelcontent">
          {render(active)}
        </div>
        <div className="grain" aria-hidden="true" />
      </main>

      <Dock active={active} pending={pending} go={go} />
    </div>
  );
}
