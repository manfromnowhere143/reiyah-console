/* ST-04 · CONTROLS — THE TWIN SEAM. The gate ran twice, in two fresh
   isolated worker processes, and the two complete payloads are byte-identical.
   That is the flagship honesty of the release, so it is the picture: every
   control is a column, its height the observations it replayed (log scale),
   mirrored above and below the seam where the twins met. Hover or touch a
   column to read the exact control and its evidence digest. State truth snaps;
   nothing tweens. */
import { useState } from "react";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { Digest, FitList, Station } from "../components/primitives";

interface Ctl { control_id: string; state: string; observation_count: number; evidence_sha256?: string }

export function Controls({ ev }: { ev: VerifiedEvidence }) {
  const r = ev.report ?? {};
  const replay: Ctl[] = r.required_replay_controls ?? [];
  const impl: Ctl[] = r.implementation_controls ?? [];
  const caps: any[] = r.capability_evidence?.capability_rows ?? [];
  const dual = r.dual_evaluation ?? {};
  const allC = [...replay, ...impl];
  const totalObs = allC.reduce((a, c) => a + (c.observation_count || 0), 0);
  const deepest = allC.reduce<Ctl | null>((m, c) => ((c.observation_count || 0) > (m?.observation_count || 0) ? c : m), null);
  const deepObs = deepest?.observation_count || 1;
  const lmax = Math.log(deepObs + 1);
  const height = (n: number) => 0.14 + 0.86 * (Math.log((n || 0) + 1) / (lmax || 1));
  const capTrue = caps.filter((c) => c.claimed_value).length;
  const replayPass = replay.filter((c) => c.state === "pass").length;
  const implPass = impl.filter((c) => c.state === "pass").length;
  const equal = !!dual.complete_payloads_equal;
  const workers: string[] = dual.logical_worker_ids ?? ["worker-1", "worker-2"];
  const diag = r.diagnostics?.length ?? 0;

  const [hover, setHover] = useState<number | null>(null);
  const cur = hover !== null ? allC[hover] : deepest;

  const column = (c: Ctl, i: number, side: "a" | "b") => (
    <span key={`${side}-${c.control_id}`} className="tcol"
      data-state={c.state} data-deep={String(c === deepest)} data-hot={String(hover === i)}
      style={{ ["--h" as any]: height(c.observation_count).toFixed(3) }}
      onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}
      title={`${c.control_id} · ${String(c.state).toUpperCase()} · ${c.observation_count} obs`} />
  );

  return (
    <Station id="ST–04" name="Controls" sub={`report ${r.version} · status ${String(r.status).toUpperCase()} · exit ${r.exit_code}`}>
      <div className="onepage">
        <div className="statstrip">
          <div className="stat"><span className="sl">replay</span><span className="sv">{replayPass}<em>/{replay.length}</em></span><span className="sd">GA-01 … GA122</span></div>
          <div className="stat"><span className="sl">implementation</span><span className="sv">{implPass}<em>/{impl.length}</em></span><span className="sd">GA123 production checks</span></div>
          <div className="stat"><span className="sl">observations</span><span className="sv">{totalObs.toLocaleString()}</span><span className="sd">every control replayed</span></div>
          <div className="stat"><span className="sl">diagnostics</span><span className="sv">{diag}</span><span className="sd">status {String(r.status).toUpperCase()} · exit {String(r.exit_code)}</span></div>
          {ev.reportMeta && (
            <div className="stat statwide"><span className="sl">report digest</span><div style={{ marginTop: "0.28rem" }}><Digest id={`report-${r.version}`} sha={ev.reportMeta.sha256} path={ev.reportMeta.path} /></div></div>
          )}
        </div>

        <div className="twin" onPointerLeave={() => setHover(null)} data-equal={String(equal)}>
          <div className="twinlabel"><span>evaluation A · {workers[0]}</span><span>{dual.fresh_processes_observed ? "fresh isolated process" : "process state unrecorded"}</span></div>
          <div className="spectrum" data-side="a">{allC.map((c, i) => column(c, i, "a"))}</div>
          <div className="seam">
            <span className="seamline" />
            <span className="seamtext">
              {equal ? "BYTE-IDENTICAL" : "PAYLOADS DIFFER"} · {Number(dual.comparable_payload_byte_size ?? 0).toLocaleString()} B
              <em> · {String(dual.comparable_payload_sha256 ?? "").slice(0, 23)}…</em>
            </span>
            <span className="seamline" />
          </div>
          <div className="spectrum" data-side="b">{allC.map((c, i) => column(c, i, "b"))}</div>
          <div className="twinlabel"><span>evaluation B · {workers[1]}</span><span>{dual.operating_system_process_ids_distinct ? "distinct OS process" : "process identity unrecorded"}</span></div>
          <div className="twincap">
            <span className="tcid">{cur?.control_id}</span>
            <span className="tcst" data-state={cur?.state}>{String(cur?.state ?? "").toUpperCase()}</span>
            <span className="tcobs">{Number(cur?.observation_count ?? 0).toLocaleString()} observations{cur === deepest ? " · the deepest check" : ""}</span>
            <span className="tcsha">{String(cur?.evidence_sha256 ?? "").slice(0, 23)}…</span>
          </div>
        </div>

        <div className="captable">
          <div className="ilabel">capability truth · {capTrue}/{caps.length} implemented · {caps.length - capTrue} honestly declared unimplemented</div>
          <FitList
            className="capgrid"
            items={caps}
            render={(c) => (
              <div key={c.capability_id} className="caprow" data-true={String(!!c.claimed_value)}>
                <span className="capname">{c.capability_id.replace(/_implemented$/, "").replace(/_/g, " ")}</span>
                <span className="capval">{c.claimed_value ? `${c.negative_adversary_count} adversaries rejected` : c.nonimplementation_reason}</span>
                <span className="capmark">{c.claimed_value ? "◆" : "∅"}</span>
              </div>
            )}
            more={(k) => <>+ {k} more capabilities, all in the report</>}
          />
        </div>
      </div>
    </Station>
  );
}
