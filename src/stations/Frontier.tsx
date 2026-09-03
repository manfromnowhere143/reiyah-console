/* FRONTIER — 54 discovery pointers: Tesla, Mobileye, Waymo, NHTSA, primary
   research. Every one payload-free and evidence-ineligible, honestly. */
import { fetchSurface } from "../lib/evidence";
import { Blocked, Digest, Station, useSurfaceState } from "../components/primitives";

export function Frontier() {
  const state = useSurfaceState(() => fetchSurface<any>("frontier"));
  if (state.phase === "loading") return <Station id="ST–08" name="Frontier"><div className="note">reading discovery register…</div></Station>;
  if (state.phase === "blocked" || state.data.state !== "observed")
    return <Station id="ST–08" name="Frontier"><Blocked reason={state.phase === "blocked" ? state.reason : (state.data as any).reason} /></Station>;

  const meta = state.data.meta;
  const reg = state.data.data;
  const records: any[] = reg.records ?? [];
  const byKind = new Map<string, number>();
  for (const r of records) byKind.set(r.source_kind, (byKind.get(r.source_kind) ?? 0) + 1);
  const kinds = [...byKind.entries()].sort((a, b) => b[1] - a[1]);
  const maxK = kinds[0]?.[1] ?? 1;
  const eligible = records.filter((r) => r.evidence_eligibility === true || r.evidence_eligibility === "eligible").length;

  return (
    <Station id="ST–08" name="Frontier" sub={`register ${reg.version ?? ""} · ${records.length} pointers · ${eligible} evidence-eligible`}>
      <div className="onepage">
        <div className="statstrip">
          <div className="stat"><span className="sl">discovery pointers</span><span className="sv">{records.length}</span><span className="sd">38 inherited + 16 appended</span></div>
          <div className="stat"><span className="sl">evidence-eligible</span><span className="sv">{eligible}</span><span className="sd">the zero is the discipline</span></div>
          <div className="stat statwide"><span className="sl">register digest</span><div style={{ marginTop: "0.28rem" }}><Digest id="frontier" sha={meta.sha256} path={meta.path} /></div></div>
        </div>
        <div className="grid2" style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}>
          <div className="ipanel" style={{ minHeight: 0, overflow: "hidden" }}>
            <div className="ilabel">source kinds</div>
            {kinds.map(([k, n]) => (
              <div key={k} className="bar">
                <span className="bk">{k}</span>
                <span className="bt"><span className="bf" style={{ width: `${(n / maxK) * 100}%` }} /></span>
                <span className="bn">{n}</span>
              </div>
            ))}
          </div>
          <div className="ipanel" style={{ minHeight: 0, overflow: "hidden" }}>
            <div className="ilabel">latest pointers · a URL without retained bytes is not evidence</div>
            {records.slice(-8).reverse().map((r) => (
              <div key={r.discovery_id} className="bar" style={{ gridTemplateColumns: "1fr auto" }}>
                <span className="bk" style={{ fontSize: "0.62rem" }}>{r.title}</span>
                <span className="bn" style={{ textTransform: "uppercase", fontSize: "0.54rem" }}>{String(r.custody_state ?? "pointer_only").replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Station>
  );
}
