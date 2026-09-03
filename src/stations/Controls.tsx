/* CONTROLS — one screen: a compact stat strip, a control-health board (every
   control a cell, brightness = observations, the deepest check aglow, hover for
   its id), and the capability truth table. State truth snaps; nothing tweens. */
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { Digest, Station } from "../components/primitives";

export function Controls({ ev }: { ev: VerifiedEvidence }) {
  const r = ev.report;
  if (!r) {
    return <Station id="ST–04" name="Controls"><div className="note">canonical report unavailable · nothing is rendered in its place</div></Station>;
  }
  const replay: any[] = r.required_replay_controls ?? [];
  const impl: any[] = r.implementation_controls ?? [];
  const caps: any[] = r.capability_evidence?.capability_rows ?? [];
  const dual = r.dual_evaluation ?? {};

  const allC = [...replay, ...impl];
  const totalObs = allC.reduce((a, c) => a + (c.observation_count || 0), 0);
  const deepest = allC.reduce((m: any, c) => ((c.observation_count || 0) > (m?.observation_count || 0) ? c : m), null);
  const deepObs = deepest?.observation_count || 1;
  const lmax = Math.log(deepObs + 1);
  const bright = (n: number) => 0.16 + 0.84 * (Math.log((n || 0) + 1) / (lmax || 1));
  const capTrue = caps.filter((c) => c.claimed_value).length;
  const replayPass = replay.filter((c) => c.state === "pass").length;
  const implPass = impl.filter((c) => c.state === "pass").length;

  return (
    <Station id="ST–04" name="Controls" sub={`report ${r.version} · status ${String(r.status).toUpperCase()} · exit ${r.exit_code} · diagnostics ${r.diagnostics?.length ?? "?"}`}>
      <div className="onepage">
        <div className="statstrip">
          <div className="stat"><span className="sl">replay</span><span className="sv">{replayPass}<em>/{replay.length}</em></span><span className="sd">GA-01 … GA122</span></div>
          <div className="stat"><span className="sl">implementation</span><span className="sv">{implPass}<em>/{impl.length}</em></span><span className="sd">GA123 checks</span></div>
          <div className="stat"><span className="sl">dual evaluation</span><span className="sv sm">{dual.complete_payloads_equal ? "TWINS EQUAL" : "NOT EQUAL"}</span><span className="sd">{Number(dual.comparable_payload_byte_size ?? 0).toLocaleString()} B · isolated</span></div>
          <div className="stat"><span className="sl">observations</span><span className="sv">{totalObs.toLocaleString()}</span><span className="sd">every control replayed</span></div>
          {ev.reportMeta && (
            <div className="stat statwide"><span className="sl">report digest</span><div style={{ marginTop: "0.28rem" }}><Digest id={`report-${r.version}`} sha={ev.reportMeta.sha256} path={ev.reportMeta.path} /></div></div>
          )}
        </div>

        <div className="boardwrap">
          <div className="ilabel" style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <span>control health · {allC.length} controls · brightness = observations</span>
            {deepest && <span style={{ color: "var(--ink-faint)" }}>deepest · <span style={{ color: "var(--ink)" }}>{deepest.control_id}</span> at {Number(deepObs).toLocaleString()} obs</span>}
          </div>
          <div className="cboard">
            {allC.map((c) => (
              <span key={c.control_id} className="ccell"
                data-state={c.state} data-deep={String(c === deepest)}
                style={{ ["--o" as any]: bright(c.observation_count).toFixed(3) }}
                title={`${c.control_id} · ${String(c.state).toUpperCase()} · ${c.observation_count} obs`} />
            ))}
          </div>
        </div>

        <div className="captable">
          <div className="ilabel">capability truth · {capTrue}/{caps.length} implemented · {caps.length - capTrue} honestly declared unimplemented</div>
          <div className="capgrid">
            {caps.map((c) => (
              <div key={c.capability_id} className="caprow" data-true={String(!!c.claimed_value)}>
                <span className="capname">{c.capability_id.replace(/_implemented$/, "").replace(/_/g, " ")}</span>
                <span className="capval">{c.claimed_value ? `${c.negative_adversary_count} adversaries rejected` : c.nonimplementation_reason}</span>
                <span className="capmark">{c.claimed_value ? "◆" : "∅"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Station>
  );
}
