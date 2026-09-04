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
import { Mark, TruthPill } from "./components/primitives";
import { GroundToggle } from "./components/GroundToggle";
import { Harbor } from "./stations/Harbor";
import { Ledger } from "./stations/Ledger";
import { Lineage } from "./stations/Lineage";
import { Encounter } from "./stations/Encounter";
import { Controls } from "./stations/Controls";
import { Estimands } from "./stations/Estimands";
import { Adversaries } from "./stations/Adversaries";
import { Chair } from "./stations/Chair";
import { Frontier } from "./stations/Frontier";
import { SystemAtlas } from "./stations/SystemAtlas";

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
  const sealed = getSealedInfo();
  const reverifying = useRef(false);

  /* navigation: the panel content cross-morphs in place through the View
     Transitions API (compositor-only opacity + scale on the stage panel).
     The earlier shared-element "forge" morph is gone: WebKit snapshots only
     the composited parts of a named element, so mid-morph the new station
     appeared torn, a canvas and a chip floating with the rest missing. */
  const go = (id: string, push = true) => {
    if (id === active) return;
    const commit = () => {
      flushSync(() => setActive(id));
      if (push) history.pushState({ st: id }, "", id === "harbor" ? location.pathname : `?st=${id}`);
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const svt = (document as any).startViewTransition?.bind(document);
    if (reduced || !svt) { commit(); return; }
    svt(commit);
  };

  useEffect(() => {
    const onPop = () => {
      const id = urlStation();
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const svt = (document as any).startViewTransition?.bind(document);
      const commit = () => flushSync(() => setActive(id));
      if (!reduced && svt) svt(commit); else commit();
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
  useEffect(() => { warmSealedSurfaces(); }, []);

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
    switch (id) {
      case "harbor": return <Harbor ev={ev} go={go} pulse={gen} />;
      case "ledger": return <Ledger ev={ev} />;
      case "lineage": return <Lineage summary={ev.summary} />;
      case "encounter": return <Encounter />;
      case "controls": return <Controls ev={ev} />;
      case "estimands": return <Estimands />;
      case "adversaries": return <Adversaries />;
      case "chair": return <Chair />;
      case "frontier": return <Frontier />;
      case "system": return <SystemAtlas ev={ev} />;
      default: return null;
    }
  };

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

      <nav className="dock" aria-label="Stations">
        {STATIONS.map((s) => (
          <button
            key={s.id}
            className="navcard glass"
            data-station={s.id}
            data-red={String(!!s.red)}
            data-active={String(s.id === active)}
            aria-current={s.id === active ? "page" : undefined}
            onClick={() => go(s.id)}
          >
            <span className="nid">{s.num}</span>
            <span className="nnm">{s.name}</span>
            <span className="nds">{s.desc}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
