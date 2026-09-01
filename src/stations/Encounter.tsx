/* ENCOUNTER — the six-kind ontology chain rendered as a wireframe
   driver-vehicle-automation encounter, driven by Reiyah's real object-chain
   records. Reiyah records encounters; it does not watch drivers. */
import { fetchSurface } from "../lib/evidence";
import { Blocked, Ev, Station, useSurfaceState } from "../components/primitives";

const CHAIN = ["observation", "belief", "decision", "intervention", "outcome", "evidence"] as const;

export function Encounter() {
  const state = useSurfaceState(async () => {
    const all = await Promise.all(CHAIN.map((k) => fetchSurface<any>(`chain-${k}`)));
    const out: Record<string, any> = {};
    CHAIN.forEach((k, i) => {
      const s = all[i];
      out[k] = s.state === "observed" ? s.data : { __blocked: (s as any).reason };
    });
    return out;
  });

  if (state.phase === "loading") return <Station id="ST–03" name="Encounter"><div className="note">reading object chain…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–03" name="Encounter"><Blocked reason={state.reason} /></Station>;
  const c = state.data;

  const speed = c.observation?.measurements?.find((m: any) => m.measurement_id?.includes("relative-speed"))
    ?? c.observation?.measurements?.[0];
  const color = c.observation?.measurements?.find((m: any) => m.value?.state !== "observed");
  const beliefComponents: Array<{ state_id: string; probability: number }> = c.belief?.belief?.components ?? [];
  const p1 = beliefComponents[0]?.probability ?? 0;

  return (
    <Station id="ST–03" name="Encounter" sub="synthetic research encounter 001 · Reiyah records encounters; it does not watch drivers">
      <div className="encounter">
        <div className="dioramawrap">
          <svg viewBox="0 0 900 420" preserveAspectRatio="xMidYMid meet" aria-label="Wireframe diorama of the driver-vehicle-automation encounter">
            {/* road perspective */}
            <g stroke="var(--wire)" strokeWidth="1" fill="none">
              <path d="M 300 420 L 430 120 M 600 420 L 470 120" />
              <path d="M 150 420 L 400 120 M 750 420 L 500 120" />
              <line x1="0" y1="120" x2="900" y2="120" />
            </g>
            <g stroke="var(--wire-soft)" strokeWidth="1">
              {[180, 240, 300, 360].map((y) => <line key={y} x1="0" y1={y} x2="900" y2={y} />)}
            </g>
            {/* the vehicle: driver + automation nodes inside one wireframe body */}
            <g transform="translate(450, 330)">
              <rect x="-70" y="-38" width="140" height="76" rx="14" fill="none" stroke="var(--wire-strong)" strokeWidth="1.5" />
              <circle cx="-32" cy="0" r="11" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
              <text x="-32" y="52" textAnchor="middle" fill="var(--ink-faint)" fontSize="8" fontFamily="B612 Mono, monospace" letterSpacing="1">DRIVER</text>
              <rect x="18" y="-11" width="26" height="22" rx="4" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
              <text x="31" y="66" textAnchor="middle" fill="var(--ink-faint)" fontSize="8" fontFamily="B612 Mono, monospace" letterSpacing="1">AUTOMATION</text>
            </g>
            {/* the object of the encounter */}
            <g transform="translate(452, 170)">
              <path d="M 0 -16 L 16 0 L 0 16 L -16 0 Z" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
              <text x="0" y="-26" textAnchor="middle" fill="var(--ink-faint)" fontSize="9" fontFamily="B612 Mono, monospace" letterSpacing="1">OBJECT-001</text>
            </g>
            {/* belief sightlines */}
            <g stroke="var(--wire)" strokeWidth="1" strokeDasharray="3 5">
              <line x1="420" y1="300" x2="448" y2="190" />
              <line x1="478" y1="304" x2="458" y2="190" />
            </g>
            {/* belief annotation from the real record */}
            <text x="530" y="235" fill="var(--ink-soft)" fontSize="10" fontFamily="B612 Mono, monospace">
              belief(relevant) = {p1.toFixed(2)}
            </text>
            <text x="530" y="252" fill="var(--ink-ghost)" fontSize="9" fontFamily="B612 Mono, monospace">
              Σ = 1 ± 1e-6 · state space bound
            </text>
          </svg>
        </div>

        <div className="chainrow">
          <div className="kindchip">
            <div className="kk">1 · observation</div>
            <Ev label="relative speed" ev={speed?.value} unit="m/s" />
            {color && <div className="sub" style={{ marginTop: "0.3rem" }}>{color.measurement_id?.split(".").pop()}: {color.value?.state} · never coerced to a value</div>}
          </div>
          <div className="kindchip">
            <div className="kk">2 · latent belief</div>
            <div className="beliefbar" role="img" aria-label={`belief ${p1} relevant`}>
              <span className="b1" style={{ width: `${p1 * 100}%` }} />
              <span className="b2" style={{ width: `${(1 - p1) * 100}%` }} />
            </div>
            <div className="sub">{beliefComponents.map((b) => `${b.state_id.split(".").pop()} ${b.probability}`).join(" · ") || "non-observed envelope"}</div>
          </div>
          <div className="kindchip">
            <div className="kk">3 · decision</div>
            <Ev label="selected action" ev={c.decision?.selected_action} />
            <div className="sub" style={{ marginTop: "0.3rem" }}>research record only · research_only: {String(c.decision?.research_only ?? true)}</div>
          </div>
          <div className="kindchip">
            <div className="kk">4 · intervention</div>
            <Ev label="assigned level" ev={c.intervention?.assigned_level} />
            <Ev label="delivered level" ev={c.intervention?.delivered_level} />
          </div>
          <div className="kindchip">
            <div className="kk">5 · outcome</div>
            <div className="sub">window {c.outcome?.measurement_window?.start?.offset?.value ?? "?"}s → {c.outcome?.measurement_window?.end?.offset?.value ?? "?"}s · censoring: {c.outcome?.censoring?.state ?? "unknown"}</div>
          </div>
          <div className="kindchip">
            <div className="kk">6 · evidence</div>
            <div className="sub"><b style={{ color: "var(--ink-soft)" }}>basis: {c.evidence?.basis?.state ?? "unknown"}</b> · an evidence gap stays a gap; retention is identity, not truth</div>
          </div>
        </div>
      </div>
    </Station>
  );
}
