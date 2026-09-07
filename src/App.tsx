/* HARBOR INSTRUMENT — one permanent stage.
   Harbor's Living Engine is the home of the panel; pressing a dock card
   morphs the panel's content in place through the View Transitions API
   (compositor-speed cross-morph; jump cut under reduced motion). The dock
   and HUD never move. The URL is the panel state. Escape returns home. */
import { lazy, useCallback, useEffect, useRef, useState } from "react";
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
import { STATION_CODE, prefetchNeighbours } from "./lib/prefetch";
import { StationFrame, type Navigate, type NavigationOptions } from "./components/StationFrame";

/* every station but the Harbor is its own code chunk, fetched when first
   pressed (or a moment earlier, by the neighbour prefetch); the Harbor is the
   first screen and ships in the main bundle */
const lazyStation = (id: string) => lazy(() => STATION_CODE[id]().then((m: any) => ({ default: Object.values(m).find((v) => typeof v === "function") as React.ComponentType<any> })));
const LAZY: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = Object.fromEntries(Object.keys(STATION_CODE).map((id) => [id, lazyStation(id)]));

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

const urlStation = () => {
  const id = new URLSearchParams(location.search).get("st");
  return STATIONS.some((s) => s.id === id) ? id! : "harbor";
};
interface Frame { id: string; key: number }
interface NavigationRequest { frame: Frame; options: NavigationOptions }
interface PanelTransition { skipTransition(): void; ready: Promise<void>; finished: Promise<void> }

function Stage({ ev, onEvidence }: { ev: VerifiedEvidence; onEvidence: (e: VerifiedEvidence) => void }) {
  const [current, setCurrent] = useState<Frame>(() => ({ id: urlStation(), key: 0 }));
  const [pending, setPending] = useState<Frame | null>(null);
  const active = current.id;
  const currentRef = useRef(current);
  currentRef.current = current;
  const sequence = useRef(0);
  const request = useRef<NavigationRequest | null>(null);
  const transition = useRef<PanelTransition | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(Date.now());
  const [connected, setConnected] = useState(true);
  const [gen, setGen] = useState(0);
  const [violated, setViolated] = useState(false);
  const sealed = getSealedInfo();
  const reverifying = useRef(false);

  /* Keep the current DOM alive while one destination loads and lays out.
     Only the latest request may commit; a slow earlier request cannot take
     the user back. Menu dismissal, page selection and history are one act. */
  const go = useCallback<Navigate>((id, options = {}) => {
    if (!STATIONS.some((s) => s.id === id)) return;
    transition.current?.skipTransition();
    request.current = null;
    if (id === currentRef.current.id) {
      setPending(null);
      options.onCommit?.();
      return;
    }
    const frame = { id, key: ++sequence.current };
    request.current = { frame, options };
    setPending(frame);
  }, []);

  const reveal = useCallback((key: number) => {
    const next = request.current;
    if (!next || next.frame.key !== key) return;
    const commit = () => {
      if (request.current !== next) return;
      request.current = null;
      if (next.options.push !== false) {
        const url = new URL(location.href);
        url.searchParams.delete("at");
        if (next.frame.id === "harbor") url.searchParams.delete("st");
        else url.searchParams.set("st", next.frame.id);
        history.pushState({ st: next.frame.id }, "", url.pathname + url.search + url.hash);
      }
      currentRef.current = next.frame;
      flushSync(() => {
        setCurrent(next.frame);
        setPending(null);
        next.options.onCommit?.();
      });
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const svt = (document as any).startViewTransition?.bind(document);
    if (next.options.animate === false || reduced || !svt) { commit(); return; }
    try {
      const running: PanelTransition = svt(commit);
      transition.current = running;
      running.ready.catch(() => {}); // a newer gesture may skip the snapshot
      running.finished.catch(() => {}).then(() => {
        if (transition.current === running) transition.current = null;
      });
    } catch { commit(); } // a transition is optional; navigation is not
  }, []);

  useEffect(() => () => { request.current = null; transition.current?.skipTransition(); }, []);

  useEffect(() => {
    const onPop = () => go(urlStation(), { push: false });
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"))) return;
      if (!["Escape", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === "Escape") { go("harbor"); return; }
      const idx = STATIONS.findIndex((s) => s.id === (request.current?.frame.id ?? currentRef.current.id));
      if (e.key === "ArrowRight") go(STATIONS[(idx + 1) % STATIONS.length].id);
      if (e.key === "ArrowLeft") go(STATIONS[(idx - 1 + STATIONS.length) % STATIONS.length].id);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [go]);

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
    const C = LAZY[id];
    if (!C) return null;
    const props: Record<string, unknown> = id === "ledger" || id === "controls" || id === "system" ? { ev } : id === "lineage" ? { summary: ev.summary } : {};
    return <C {...props} />;
  };

  /* after each station renders: warm its two dock neighbours in idle time */
  useEffect(() => { prefetchNeighbours(active); }, [active]);

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

      <main className="stagepanel" aria-live="polite" aria-busy={!!pending}>
        {[current, ...(pending ? [pending] : [])].map((frame) => (
          <StationFrame key={`${frame.key}:${gen}`} id={frame.id} frameKey={frame.key}
            preparing={frame !== current} onReady={reveal}>
            {render(frame.id)}
          </StationFrame>
        ))}
        <div className="grain" aria-hidden="true" />
      </main>

      <Dock active={active} pending={pending?.id ?? null} go={go} />
    </div>
  );
}
