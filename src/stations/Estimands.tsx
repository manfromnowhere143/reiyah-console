/* ESTIMANDS — ten instruments awaiting first light. All proposed, none
   measured; the dark dials are the roadmap, rendered honestly. */
import { fetchSurface } from "../lib/evidence";
import { Blocked, Station, useSurfaceState } from "../components/primitives";

const PRETTY: Record<string, string> = {
  "theta_R(P,r,h)": "θ_R(P,r,h)",
  "theta_rec(P,h)": "θ_rec(P,h)",
  "theta_JSM(P)": "θ_JSM(P)",
  "theta_WG(P)": "θ_WG(P)",
  "tau(P;pi_1,pi_0)": "τ(P;π₁,π₀)",
  "V_pi(P)": "V_π(P)",
  "C_alpha(P)": "C_α(P)",
  "Delta_tr(s,t)": "Δ_tr(s,t)",
  "Omega(P)=(TPR,FPR,R_acc,Cov)": "Ω(P)",
};

export function Estimands() {
  const state = useSurfaceState(() => fetchSurface<any>("protocol"));
  if (state.phase === "loading") return <Station id="ST–05" name="Estimands"><div className="note">reading protocol registry…</div></Station>;
  if (state.phase === "blocked" || state.data.state !== "observed")
    return <Station id="ST–05" name="Estimands"><Blocked reason={state.phase === "blocked" ? state.reason : (state.data as any).reason} /></Station>;

  const proto = state.data.data;
  const estimands: any[] = proto.estimands ?? [];
  const measured = estimands.filter((e) => e.lifecycle_status !== "proposed").length;

  return (
    <Station id="ST–05" name="Estimands" sub={`${estimands.length} defined · ${measured} measured · protocol ${proto.release_id ?? ""}`}>
      <div className="onepage" style={{ justifyContent: "center", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.1rem", flexWrap: "wrap", flex: "none" }}>
          <div className="big" style={{ fontSize: "2rem" }}>{measured}<em>/{estimands.length}</em></div>
          <div className="note" style={{ margin: 0, maxWidth: "40rem" }}>
            measured. Every dial is <b>defined, frozen, and honestly dark</b> — no result exists until its gate
            accepts it. The day one estimand earns retained evidence, its instrument ignites. That ignition is
            the roadmap, not a promise.
          </div>
        </div>
        <div className="estgrid estgridfill">
          {estimands.map((e) => (
            <div key={e.estimand_id} className="estcard">
              <span className="sym">{PRETTY[e.symbol] ?? e.symbol}</span>
              <span className="enm">{e.estimand_id.replace("reiyah.estimand.", "").replace(/-/g, " ")}</span>
              <span className="edir">{String(e.direction ?? "").replace(/_/g, " ")}</span>
              <span className="elc">{String(e.lifecycle_status).toUpperCase()} · AWAITING FIRST LIGHT</span>
            </div>
          ))}
        </div>
      </div>
    </Station>
  );
}
