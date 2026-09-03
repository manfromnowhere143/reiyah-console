/* LINEAGE — releases as a chain of custody, on one screen: every canonical
   validation report is a node on the rail, every RECOVERY record a link that
   says exactly how a predecessor's identity was recovered. Enumerated live from
   the repository; nothing regenerated, nothing relabeled. */
import { fetchSurface, type Summary } from "../lib/evidence";
import { Blocked, Digest, FitList, Station, useSurfaceState } from "../components/primitives";

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
    const status = String(r.data?.status ?? r.data?.result ?? "recorded").toUpperCase();
    const arch = String(r.data?.architecture_status ?? "").replace(/_/g, " ");
    const exit = r.data?.exit_code;
    const ok = (r.data?.status ?? r.data?.result) === "pass" && diag === 0 && (total === 0 || pass === total);
    return { version, total, pass, diag, ok, status, arch, exit, meta: r.meta };
  });
  const headCtrls = series.filter((s) => s.total > 0).at(-1)?.total ?? 0;
  const allPass = series.length > 0 && series.every((s) => s.ok);
  const totalDiag = series.reduce((a, s) => a + s.diag, 0);
  const unbroken = allPass && totalDiag === 0;
  /* the architecture status is said once when every report agrees, per node otherwise */
  const archs = [...new Set(series.map((s) => s.arch).filter(Boolean))];
  const sharedArch = archs.length === 1 ? archs[0] : null;

  const recRows = recoveries.map((r: any, i: number) => ({
    key: i,
    name: r.state === "observed" ? String(r.meta.path.split("/")[1]) : "blocked",
    method: r.state === "observed" ? String(r.data?.recovery_method ?? "recorded").replace(/_/g, " ") : String(r.reason),
    meta: r.state === "observed" ? r.meta : null,
  }));

  return (
    <Station id="ST–02" name="Lineage" sub="append-only history · nothing regenerated, nothing relabeled">
      <div className="onepage">
        <div className="statstrip">
          <div className="stat">
            <span className="sl">releases</span>
            <span className="sv">{series.filter((s) => s.ok).length}<em>/{series.length}</em></span>
            <span className="sd" style={{ color: unbroken ? "var(--ok)" : "var(--accent)" }}>{unbroken ? "unbroken chain" : "attention"}</span>
          </div>
          <div className="stat"><span className="sl">diagnostics</span><span className="sv">{totalDiag}</span><span className="sd">across the entire chain</span></div>
          <div className="stat"><span className="sl">controls at head</span><span className="sv">{headCtrls}</span><span className="sd">replay + implementation</span></div>
          <div className="stat"><span className="sl">interface reports</span><span className="sv">{ifaceReports.length}</span><span className="sd">validated, not implemented · a different kind</span></div>
        </div>

        <div style={{ flex: "none" }}>
          <div className="ilabel">chain of custody · {canonical.length} canonical validations{sharedArch ? ` · every one ${sharedArch}` : ""} · rigor derived live from each report</div>
          <div className="rail">
            {series.map((s) => (
              <div key={s.version} className="rnode" data-ok={String(s.ok)} title={`${s.version} · ${s.status} · ${s.diag} diagnostics · ${s.pass}/${s.total} controls`}>
                <span className="rv"><i className="rdot" />{s.version}</span>
                <span className="rs">{s.status} · exit {String(s.exit ?? "?")}{!sharedArch && s.arch ? ` · ${s.arch}` : ""}</span>
                <span className="rd"><Digest id={s.meta.id} sha={s.meta.sha256} path={s.meta.path} /></span>
              </div>
            ))}
          </div>
        </div>

        <div className="ipanel fillpanel">
          <div className="ilabel">recovery chain · {recoveries.length} immutable predecessors · how each identity was recovered</div>
          <FitList
            items={recRows}
            render={(r) => (
              <div key={r.key} className="bar linerow">
                <span className="bk">{r.name}</span>
                <span className="linemid">{r.method}</span>
                {r.meta ? <Digest id={r.meta.id} sha={r.meta.sha256} path={r.meta.path} /> : <span className="bn">BLOCKED</span>}
              </div>
            )}
            more={(k) => <>+ {k} more predecessors, all retained</>}
          />
          <div className="note railnote">
            The 1.0.0 record discloses an interrupted custody continuity and reconstructs identity from retained digests.
            The break is part of the history and is shown, not smoothed.
          </div>
        </div>
      </div>
    </Station>
  );
}
