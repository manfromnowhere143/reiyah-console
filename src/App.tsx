/* HARBOR INSTRUMENT — one scene, one camera.
   The world is a 3×3 grid of stations; the camera forges to whichever the
   operator presses. The URL is the camera position. Escape returns home. */
import { useEffect, useRef, useState } from "react";
import { ProofBoot, verifyEvidenceOnce, type VerifiedEvidence } from "./boot/ProofBoot";
import { STATIONS, useCamera } from "./lib/camera";
import { getSealedInfo, subscribeEvents } from "./lib/evidence";
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

export default function App() {
  const [evidence, setEvidence] = useState<VerifiedEvidence | null>(null);
  return (
    <>
      <GroundToggle />
      {!evidence
        ? <ProofBoot onReady={setEvidence} />
        : <Stage ev={evidence} onEvidence={setEvidence} />}
    </>
  );
}

function Stage({ ev, onEvidence }: { ev: VerifiedEvidence; onEvidence: (e: VerifiedEvidence) => void }) {
  const worldRef = useRef<HTMLDivElement>(null);
  const { active, go } = useCamera(worldRef);
  const [lastEventAt, setLastEventAt] = useState<number | null>(Date.now());
  const [connected, setConnected] = useState(true);
  const [gen, setGen] = useState(0);
  const [violated, setViolated] = useState(false);
  const sealed = getSealedInfo();
  const reverifying = useRef(false);

  useEffect(() => {
    const off = subscribeEvents((kind, at) => {
      if (kind === "error") { setConnected(false); return; }
      if (kind === "sealed") return;
      setConnected(true);
      setLastEventAt(at);
      if (kind === "evidence" && !reverifying.current) {
        /* the repository changed: re-run the full digest gate, then let
           every station re-read. No pixel survives on stale evidence. */
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
      default: return null;
    }
  };

  return (
    <div className="viewport">
      {/* rung-1 liquid glass: static displacement lens, defined once */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="harborLens" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.013" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="hud">
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <span style={{ color: "var(--ink)" }}><Mark /></span>
          <span><b>REIYAH</b> <span className="dot">//</span> HARBOR INSTRUMENT</span>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          {idn.state === "observed" && (
            <span className="hudid" style={{ letterSpacing: "0.06em" }}>
              {idn.branch || "detached"} · {idn.head.slice(0, 10)} · {idn.worktree_clean ? "CLEAN" : "DIRTY"}
            </span>
          )}
          <TruthPill lastEventAt={lastEventAt} connected={connected} sealed={sealed} violated={violated} />
          {active !== "harbor" ? (
            <button className="hudbtn" onClick={() => go("harbor")}>⌂ HARBOR · ESC</button>
          ) : (
            <span className="hudid" style={{ color: "var(--ink-ghost)" }}>ARROWS FLY · ESC HOME</span>
          )}
        </div>
      </div>
      <div className="world" ref={worldRef}>
        {STATIONS.map((s) => (
          <div
            key={s.id}
            className="cell"
            data-active={String(s.id === active)}
            style={{ gridRow: s.row + 1, gridColumn: s.col + 1 }}
            aria-hidden={s.id !== active}
          >
            <div key={gen} style={{ display: "contents" }}>{render(s.id)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
