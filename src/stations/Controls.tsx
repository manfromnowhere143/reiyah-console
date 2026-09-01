/* CONTROLS — the canonical report's control grid, capability truth table,
   and the dual-evaluation twins. State truth snaps; nothing here tweens. */
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

  return (
    <Station id="ST–04" name="Controls" sub={`report ${r.version} · status ${String(r.status).toUpperCase()} · exit ${r.exit_code} · diagnostics ${r.diagnostics?.length ?? "?"}`}>
      <div className="grid3" style={{ marginBottom: "0.8rem" }}>
        <div className="ipanel"><div className="ilabel">replay controls</div><div className="big">{replay.filter((c) => c.state === "pass").length}<em>/</em>{replay.length}</div><div className="sub">GA-01 … GA122, all digest-evidenced</div></div>
        <div className="ipanel"><div className="ilabel">implementation</div><div className="big">{impl.filter((c) => c.state === "pass").length}<em>/</em>{impl.length}</div><div className="sub">GA123 production checks</div></div>
        <div className="ipanel"><div className="ilabel">dual evaluation</div><div className="big" style={{ fontSize: "1.1rem" }}>{dual.complete_payloads_equal ? "TWINS EQUAL" : "NOT EQUAL"}</div><div className="sub">{Number(dual.comparable_payload_byte_size ?? 0).toLocaleString()} bytes · fresh isolated workers</div></div>
        {ev.reportMeta && (
          <div className="ipanel"><div className="ilabel">report digest</div><div style={{ marginTop: "0.2rem" }}><Digest id={`report-${r.version}`} sha={ev.reportMeta.sha256} path={ev.reportMeta.path} /></div><div className="sub">press to reprove</div></div>
        )}
      </div>

      <div className="ipanel" style={{ marginBottom: "0.8rem" }}>
        <div className="ilabel">control grid · observation counts shown</div>
        <div className="ctrlgrid">
          {[...replay, ...impl].map((c) => (
            <div key={c.control_id} className="ctrl" data-state={c.state}>
              <span className="cid">{c.control_id}</span>
              <span className="cst">{String(c.state).toUpperCase()}</span>
              <span className="cobs">{c.observation_count} obs</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ipanel">
        <div className="ilabel">capability truth table · honesty is enforced: three are FALSE with stated reasons</div>
        {caps.map((c) => (
          <div key={c.capability_id} className="bar" style={{ gridTemplateColumns: "16rem 1fr auto" }}>
            <span className="bk">{c.capability_id.replace(/_implemented$/, "")}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: c.claimed_value ? "var(--ink-soft)" : "var(--ink-ghost)" }}>
              {c.claimed_value ? `TRUE · ${c.negative_adversary_count} adversaries rejected` : `FALSE · ${c.nonimplementation_reason}`}
            </span>
            <span className="bn">{c.claimed_value ? "◆" : "∅"}</span>
          </div>
        ))}
      </div>
    </Station>
  );
}
