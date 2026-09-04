/* ST-04 · CONTROLS — THE TWIN SEAM. The gate ran twice, in two fresh
   isolated worker processes, and the two complete payloads are byte-identical.
   That is the flagship honesty of the release, so it is the picture: every
   control is a column, its height the observations it replayed (log scale),
   mirrored above and below the seam where the twins met. Hover or touch a
   column to read the exact control and its evidence digest. State truth snaps;
   nothing tweens. */
import { useState } from "react";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { fetchCatalog, fetchSurfaceByPath } from "../lib/evidence";
import { getAt, setAt } from "../lib/urlstate";
import { Digest, FitList, Stat, Station, useSurfaceState } from "../components/primitives";

/* the toolchain lock: the newest one in the catalog, read live. It pins the
   exact interpreter, every module origin, the stdlib and third-party
   aggregates, the launcher policy and the deadline the gate ran under. */
function useToolchainLock() {
  return useSurfaceState(async () => {
    const cat = await fetchCatalog();
    const all = cat.map((c) => c.path).filter((x) => /toolchain-lock-\d/.test(x));
    const odi = all.filter((x) => x.includes("operator-decision-interface-toolchain-lock-"));
    const p = (odi.length ? odi : all).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
    if (!p) return null;
    const s = await fetchSurfaceByPath<any>(p);
    return s.state === "observed" ? { path: p, sha256: s.meta.sha256, d: s.data } : null;
  });
}

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
  const REP = ev.reportMeta ? [{ id: `report-${r.version}`, path: ev.reportMeta.path, sha256: ev.reportMeta.sha256 }] : [];

  const [hover, setHover] = useState<number | null>(() => { const a = getAt(); const i = a ? allC.findIndex((c) => c.control_id === a) : -1; return i >= 0 ? i : null; });
  const cur = hover !== null ? allC[hover] : deepest;
  const pick = (i: number) => { setHover(i); setAt(allC[i]?.control_id ?? null); };
  const lock = useToolchainLock();
  const L = lock.phase === "ready" && lock.data ? lock.data : null;
  const pol = L?.d?.launcher_policy ?? {};
  const polOn = Object.entries(pol).filter(([, v]) => v === true).map(([k]) => k.replace(/_/g, " "));

  const column = (c: Ctl, i: number, side: "a" | "b") => (
    <span key={`${side}-${c.control_id}`} className="tcol"
      data-state={c.state} data-deep={String(c === deepest)} data-hot={String(hover === i)}
      style={{ ["--h" as any]: height(c.observation_count).toFixed(3) }}
      onPointerEnter={() => pick(i)} onPointerDown={() => pick(i)}
      title={`${c.control_id} · ${String(c.state).toUpperCase()} · ${c.observation_count} obs`} />
  );

  return (
    <Station id="ST–04" name="Controls" sub={`report ${r.version} · status ${String(r.status).toUpperCase()} · exit ${r.exit_code}`}>
      <div className="onepage">
        <div className="statstrip">
          <Stat label="replay" value={<>{replayPass}<em>/{replay.length}</em></>} sub="GA-01 … GA122"
            rule="count of required_replay_controls whose state is pass, over the count of required_replay_controls, in the canonical validation report" from={REP} />
          <Stat label="implementation" value={<>{implPass}<em>/{impl.length}</em></>} sub="GA123 production checks"
            rule="count of implementation_controls whose state is pass, over the count of implementation_controls" from={REP} />
          <Stat label="observations" value={totalObs.toLocaleString()} sub="every control replayed"
            rule="sum of observation_count over every replay and implementation control in the report" from={REP} />
          <Stat label="diagnostics" value={diag} sub={`status ${String(r.status).toUpperCase()} · exit ${String(r.exit_code)}`}
            rule="length of the report's diagnostics array; status and exit_code are the report's own fields" from={REP} />
          {ev.reportMeta && (
            <Stat label="report digest" wide rule="SHA-256 of the canonical report bytes as recorded in the evidence index; press the chip to recompute it in this browser" from={REP}>
              <div style={{ marginTop: "0.28rem" }}><Digest id={`report-${r.version}`} sha={ev.reportMeta.sha256} path={ev.reportMeta.path} /></div>
            </Stat>
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

        {L && (
          <div className="lockrow" title={L.path}>
            <span className="lk">toolchain lock</span>
            <span className="lc"><b>python {String(L.d.python_version ?? "?")}</b> · {String(L.d.python_executable?.sha256 ?? "").slice(7, 19)}</span>
            <span className="lc"><b>{Number(Array.isArray(L.d.module_origins) ? L.d.module_origins.length : 0)}</b> module origins</span>
            <span className="lc"><b>{Number(L.d.stdlib_aggregate?.file_count ?? 0).toLocaleString()}</b> stdlib files · <b>{Number(L.d.third_party_aggregate?.file_count ?? 0)}</b> third-party</span>
            <span className="lc"><b>{Number(L.d.deadline_contract?.absolute_outer_seconds ?? 0)} s</b> deadline</span>
            <span className="lc lpol">{polOn.slice(0, 6).join(" · ")}</span>
            <span className="lc"><Digest id={`p/${L.path}`} sha={L.sha256} path={L.path} /></span>
          </div>
        )}
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
