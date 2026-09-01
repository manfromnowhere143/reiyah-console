/* LINEAGE — releases as a chain of custody: every RECOVERY record and every
   canonical validation report, enumerated live from the repository. */
import { fetchSurface, type Summary } from "../lib/evidence";
import { Blocked, Digest, Station, useSurfaceState } from "../components/primitives";

export function Lineage({ summary }: { summary: Summary }) {
  const reportIds = summary.surfaces.filter((s) => s.id.startsWith("report-")).map((s) => s.id).sort();
  const recoveryIds = summary.surfaces.filter((s) => s.id.startsWith("recovery-")).map((s) => s.id).sort();

  const state = useSurfaceState(async () => {
    const reports = await Promise.all(reportIds.map((id) => fetchSurface<any>(id)));
    const recoveries = await Promise.all(recoveryIds.map((id) => fetchSurface<any>(id)));
    return { reports, recoveries };
  }, [reportIds.join(","), recoveryIds.join(",")]);

  if (state.phase === "loading") return <Station id="ST–02" name="Lineage"><div className="note">reading custody chain…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–02" name="Lineage"><Blocked reason={state.reason} /></Station>;

  const { reports, recoveries } = state.data;

  return (
    <Station id="ST–02" name="Lineage" sub="append-only history · nothing regenerated, nothing relabeled">
      <div className="ipanel" style={{ marginBottom: "0.8rem" }}>
        <div className="ilabel">canonical validation reports · {reports.length}</div>
        {reports.map((r, i) =>
          r.state === "observed" ? (
            <div key={i} className="bar" style={{ gridTemplateColumns: "8rem 1fr auto" }}>
              <span className="bk">{r.meta.path.split("/").pop()?.replace("gate-a-validation-", "").replace(".json", "")}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--ink-faint)" }}>
                {String(r.data?.status ?? r.data?.result ?? "recorded").toUpperCase()}
                {" · "}{String(r.data?.architecture_status ?? "")}
                {" · exit "}{String(r.data?.exit_code ?? "?")}
              </span>
              <Digest id={r.meta.id} sha={r.meta.sha256} path={r.meta.path} />
            </div>
          ) : (
            <div key={i} className="note">a report surface is blocked: {(r as any).reason}</div>
          )
        )}
      </div>

      <div className="ipanel">
        <div className="ilabel">recovery chain · {recoveries.length} immutable predecessors</div>
        {recoveries.map((r, i) =>
          r.state === "observed" ? (
            <div key={i} className="bar" style={{ gridTemplateColumns: "8rem 1fr auto" }}>
              <span className="bk">{r.meta.path.split("/")[1]}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {String(r.data?.recovery_method ?? "recorded")}
              </span>
              <Digest id={r.meta.id} sha={r.meta.sha256} path={r.meta.path} />
            </div>
          ) : (
            <div key={i} className="note">a recovery surface is blocked: {(r as any).reason}</div>
          )
        )}
        <div className="note" style={{ marginTop: "0.6rem" }}>
          The 1.0.0 record discloses an interrupted custody continuity and reconstructs identity from
          retained digests. The break is part of the history and is shown, not smoothed.
        </div>
      </div>
    </Station>
  );
}
