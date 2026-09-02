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

  /* Separate record kinds — a canonical validation report and a decision-
     interface contract report are different in kind and must not be conflated
     (Reiyah law). The pass-streak is over canonical validations only. */
  const observed = reports.filter((r: any) => r.state === "observed");
  const isCanonical = (r: any) => (r.meta.path as string).includes("gate-a-validation-");
  const canonical = observed.filter(isCanonical);
  const ifaceReports = observed.filter((r: any) => !isCanonical(r));

  const series = canonical.map((r: any) => {
    const ctrls = [...(r.data?.required_replay_controls ?? []), ...(r.data?.implementation_controls ?? [])];
    const total = ctrls.length;
    const pass = ctrls.filter((c: any) => c.state === "pass").length;
    const diag = (r.data?.diagnostics ?? []).length;
    const version = r.meta.path.split("/").pop()?.replace("gate-a-validation-", "").replace(".json", "") ?? "?";
    const ok = (r.data?.status ?? r.data?.result) === "pass" && diag === 0 && (total === 0 || pass === total);
    return { version, total, pass, diag, ok };
  });
  const headCtrls = series.filter((s) => s.total > 0).at(-1)?.total ?? 0;
  const allPass = series.length > 0 && series.every((s) => s.ok);
  const totalDiag = series.reduce((a, s) => a + s.diag, 0);

  return (
    <Station id="ST–02" name="Lineage" sub="append-only history · nothing regenerated, nothing relabeled">
      <div className="ipanel" style={{ marginBottom: "0.8rem" }}>
        <div className="ilabel" style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <span>rigor across the chain · derived live from each report</span>
          <span style={{ color: allPass && totalDiag === 0 ? "var(--ok)" : "var(--accent)" }}>
            {allPass && totalDiag === 0 ? "unbroken" : "attention"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1.4rem", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {series.map((s, i) => (
              <div key={i} title={`${s.version}: ${s.ok ? "pass" : "check"} · ${s.diag} diagnostics`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
                <span style={{
                  width: "0.7rem", height: "0.7rem", borderRadius: "50%",
                  background: s.ok ? "var(--ok)" : "transparent",
                  border: s.ok ? "none" : "1px solid var(--accent)",
                }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.5rem", color: "var(--ink-faint)" }}>{s.version.replace(/^operator-decision.*/, "DI")}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="big">{series.length}<em>/{series.length}</em></div>
            <div className="sub">passing releases · {totalDiag} diagnostics across the entire chain · {headCtrls} controls at the head</div>
          </div>
        </div>
      </div>

      <div className="ipanel" style={{ marginBottom: "0.8rem" }}>
        <div className="ilabel">canonical validation reports · {canonical.length}</div>
        {canonical.map((r: any, i: number) => (
          <div key={i} className="bar" style={{ gridTemplateColumns: "8rem 1fr auto" }}>
            <span className="bk">{r.meta.path.split("/").pop()?.replace("gate-a-validation-", "").replace(".json", "")}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--ink-faint)" }}>
              {String(r.data?.status ?? r.data?.result ?? "recorded").toUpperCase()}
              {" · "}{String(r.data?.architecture_status ?? "")}
              {" · exit "}{String(r.data?.exit_code ?? "?")}
            </span>
            <Digest id={r.meta.id} sha={r.meta.sha256} path={r.meta.path} />
          </div>
        ))}
        {ifaceReports.length > 0 && (
          <div className="note" style={{ marginTop: "0.6rem" }}>
            {ifaceReports.length} decision-interface contract report{ifaceReports.length > 1 ? "s" : ""} also present
            (1.2.6–1.2.8, <b>validated, not implemented</b>) — a different kind of record, attributed to the
            correction engine in <b>The Chair</b>, never counted as a canonical validation.
          </div>
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
