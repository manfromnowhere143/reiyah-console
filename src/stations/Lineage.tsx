/* ST-02 · LINEAGE — THE CUSTODY GRAPH. One spine, one node per canonical
   validation report, and under each node the RECOVERY record that says how
   that release's identity was recovered and whether custody was continuous.
   A break is drawn as a break. Decision-interface contract reports are a
   different kind of record and sit on their own lower rail, never counted
   as canonical validations. Enumerated live from the repository. */
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
  const observed = reports.filter((r: any) => r.state === "observed");
  const isCanonical = (r: any) => (r.meta.path as string).includes("gate-a-validation-");
  const canonical = observed.filter(isCanonical);
  const ifaceReports = observed.filter((r: any) => !isCanonical(r));

  const recBy = new Map<string, any>();
  for (const r of recoveries) if (r.state === "observed") recBy.set(String(r.meta.path).match(/gate-a-([\d.]+)\//)?.[1] ?? "", r);

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
    const rec = recBy.get(version);
    return {
      version, total, pass, diag, ok, status, arch, exit, meta: r.meta,
      recovery: rec ? {
        method: String(rec.data?.recovery_method ?? "recorded").replace(/_/g, " "),
        continuity: String(rec.data?.custody_continuity ?? "unrecorded").replace(/_/g, " "),
        broken: String(rec.data?.custody_continuity ?? "").startsWith("interrupted"),
        meta: rec.meta,
      } : null,
    };
  });
  const headCtrls = series.filter((s) => s.total > 0).at(-1)?.total ?? 0;
  const allPass = series.length > 0 && series.every((s) => s.ok);
  const totalDiag = series.reduce((a, s) => a + s.diag, 0);
  const unbroken = allPass && totalDiag === 0;
  const archs = [...new Set(series.map((s) => s.arch).filter(Boolean))];
  const sharedArch = archs.length === 1 ? archs[0] : null;
  const breaks = series.filter((s) => s.recovery?.broken).length;

  return (
    <Station id="ST–02" name="Lineage" sub="append-only history · nothing regenerated, nothing relabeled">
      <div className="onepage">
        <div className="statstrip">
          <div className="stat">
            <span className="sl">releases</span>
            <span className="sv">{series.filter((s) => s.ok).length}<em>/{series.length}</em></span>
            <span className="sd" style={{ color: unbroken ? "var(--ok)" : "var(--accent)" }}>{unbroken ? "every validation passing" : "attention"}</span>
          </div>
          <div className="stat"><span className="sl">diagnostics</span><span className="sv">{totalDiag}</span><span className="sd">across the entire chain</span></div>
          <div className="stat"><span className="sl">controls at head</span><span className="sv">{headCtrls}</span><span className="sd">replay + implementation</span></div>
          <div className="stat"><span className="sl">custody breaks</span><span className="sv">{breaks}</span><span className="sd">{breaks ? "disclosed, reconstructed from digests" : "none disclosed"}</span></div>
        </div>

        <div className="graph">
          <div className="ilabel">chain of custody · {canonical.length} canonical validations{sharedArch ? ` · every one ${sharedArch}` : ""} · {recoveries.length} recovery records</div>
          <div className="rail spine">
            {series.map((s, i) => (
              <div key={s.version} className="rnode" data-ok={String(s.ok)} data-broken={String(!!s.recovery?.broken)} data-first={String(i === 0)}
                title={`${s.version} · ${s.status} · ${s.diag} diagnostics · ${s.pass}/${s.total} controls`}>
                <span className="rv"><i className="rdot" />{s.version}</span>
                <span className="rs">{s.status} · exit {String(s.exit ?? "?")}{!sharedArch && s.arch ? ` · ${s.arch}` : ""}</span>
                <span className="rd"><Digest id={s.meta.id} sha={s.meta.sha256} path={s.meta.path} /></span>
                {s.recovery ? (
                  <span className="rrec" data-broken={String(s.recovery.broken)}>
                    <b>{s.recovery.continuity}</b>
                    <span>{s.recovery.method}</span>
                  </span>
                ) : (
                  <span className="rrec dim"><b>no recovery record</b><span>identity carried by the report itself</span></span>
                )}
              </div>
            ))}
          </div>
          {ifaceReports.length > 0 && (
            <div className="subrail">
              <span className="subrailk">decision-interface contract reports · {ifaceReports.length} · validated, not implemented · a different kind, never a canonical validation</span>
              <div className="subnodes">
                {ifaceReports.map((r: any) => (
                  <span key={r.meta.id} className="subnode">
                    <i />{String(r.meta.path).match(/1\.2\.\d+/)?.[0] ?? r.meta.id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="note railnote">
          The 1.0.0 record discloses an interrupted custody continuity and reconstructs identity from retained digests.
          The break is part of the history and is shown, not smoothed.
        </div>
      </div>
    </Station>
  );
}
