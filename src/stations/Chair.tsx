/* ST–07 · THE CHAIR — the engine that corrects itself, then the seat no
   tool may take. The correction saga is discovered live from the catalog:
   every DI version the engine ships appears here, contract → review →
   implementation → seal, append-only. Then the decision chamber: the empty
   seat, drawn, not boxed; the stage rail the decision must walk; and the
   empty form, every field null by design, said once. */
import { fetchCatalog, fetchSurfaceByPath, fetchSurface } from "../lib/evidence";
import { Blocked, Station, useSurfaceState } from "../components/primitives";

interface SagaFile { path: string; kind: string; sha256: string; result?: string; incident: boolean }
interface SagaVersion { version: string; files: SagaFile[]; incident: boolean }

const KIND_OF = (p: string): string => {
  if (p.includes("-corrections/")) return "correction";
  if (p.includes("-reviews/")) return "review";
  if (p.includes("validation-reports/")) return "canonical report";
  if (p.includes("operator-decision-interfaces/")) return "interface";
  if (p.includes("inventories/")) return "inventory";
  if (p.includes("incidents/")) return "incident";
  if (p.includes("plan")) return "plan";
  if (p.includes("toolchain-lock")) return "toolchain lock";
  return "record";
};

export function Chair() {
  const state = useSurfaceState(async () => {
    const catalog = await fetchCatalog();
    const sagaPaths = catalog
      .map((c) => c.path)
      .filter((p) =>
        (p.startsWith("gate/operator-decision-interface") ||
          p.startsWith("gate/operator-decision-interfaces") ||
          (p.startsWith("gate/validation-reports/") && p.includes("operator-decision")) ||
          (p.startsWith("validation/") && p.includes("operator-decision"))) &&
        p.endsWith(".json")
      );
    const byVersion = new Map<string, SagaFile[]>();
    const loaded = await Promise.all(
      sagaPaths.map(async (p) => {
        const s = await fetchSurfaceByPath<any>(p);
        const v = p.match(/1\.2\.\d+/)?.[0] ?? "1.2.4";
        const d = s.state === "observed" ? s.data : null;
        return {
          v,
          f: {
            path: p, kind: KIND_OF(p),
            sha256: s.state === "observed" ? s.meta.sha256 : "blocked",
            result: d?.result ?? d?.status ?? d?.activation_state ?? d?.record_kind,
            incident: !!(d && (d.incident_validation || d.defect_reproduction)) || p.includes("liveness") || p.includes("incidents/"),
          } as SagaFile,
        };
      })
    );
    for (const { v, f } of loaded) byVersion.set(v, [...(byVersion.get(v) ?? []), f]);
    const versions: SagaVersion[] = [...byVersion.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([version, files]) => ({ version, files: files.sort((x, y) => x.kind.localeCompare(y.kind)), incident: files.some((f) => f.incident) }));
    const tplPath = catalog
      .map((c) => c.path)
      .filter((p) => /gate\/decisions\/OPERATOR_DECISION-1\.2\.\d+\.template\.json/.test(p))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .at(-1);
    const tpl = tplPath ? await fetchSurfaceByPath<any>(tplPath) : null;
    const odi = await fetchSurface<any>("odi");
    return { versions, tpl, tplPath, odi };
  });

  if (state.phase === "loading") return <Station id="ST–07" name="The Chair"><div className="note">discovering the correction saga…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–07" name="The Chair"><Blocked reason={state.reason} /></Station>;

  const { versions, tpl, tplPath, odi } = state.data;
  const tplData = tpl && tpl.state === "observed" ? tpl.data : null;
  const odiData = odi.state === "observed" ? odi.data : null;
  const stages: string[] = odiData?.stage_contract?.ordered_stage_ids ?? [];
  const itemCount = odiData?.unresolved_inventory_contract?.item_count;
  const nulls = tplData ? collectNulls(tplData) : [];
  const latest = versions.at(-1)?.version;
  const totalRecords = versions.reduce((a, v) => a + v.files.length, 0);
  const incidents = versions.filter((v) => v.incident).length;
  const tplName = tplPath?.split("/").pop()?.replace(".template.json", "") ?? "";

  return (
    <Station id="ST–07" name="The Chair" sub="the engine that corrects itself, append-only · then the seat no tool may take">
      <div className="onepage">
        <div className="statstrip">
          <div className="stat"><span className="sl">corrections</span><span className="sv">{versions.length}</span><span className="sd">self-found defects, append-only</span></div>
          <div className="stat"><span className="sl">records</span><span className="sv">{totalRecords}</span><span className="sd">contract · review · implementation · seal</span></div>
          <div className="stat"><span className="sl">incidents</span><span className="sv">{incidents}</span><span className="sd">captured, never smoothed</span></div>
          <div className="stat"><span className="sl">acceptance</span><span className="sv sm">UNACCEPTED</span><span className="sd">{typeof itemCount === "number" ? `${itemCount} items await human disposition` : "awaiting a human"}</span></div>
        </div>

        {/* the correction engine as a rail of versions */}
        <div className="ctimeline">
          {versions.map((v) => (
            <div key={v.version} className="cnode" data-now={String(v.version === latest)} data-incident={String(v.incident)}
              title={v.files.map((f) => `${f.kind}: ${String(f.result ?? "retained").replace(/_/g, " ")}`).join("\n")}>
              <span className="cnv">{v.version}</span>
              <span className="cnc">{v.files.length} records</span>
              <span className="cnt">
                {v.incident && <span className="cninc">incident</span>}
                {v.version === latest && <span className="cnnow">● forging</span>}
              </span>
            </div>
          ))}
        </div>

        {/* the decision chamber */}
        <div className="chamber">
          <div className="seat">
            <div className="seatkick">no tool may sit here</div>
            <svg className="seatglyph" viewBox="0 0 64 64" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10 h28 a3 3 0 0 1 3 3 v20 a3 3 0 0 1 -3 3 h-28 a3 3 0 0 1 -3 -3 v-20 a3 3 0 0 1 3 -3 z" />
                <path d="M20 36 v14 M44 36 v14 M12 50 h40" />
                <path d="M26 50 v6 M38 50 v6" opacity="0.6" />
              </g>
              <circle cx="32" cy="23" r="2.2" fill="var(--accent)" />
            </svg>
            <div className="seatname">the operator seat</div>
            <div className="seatline">The decision record is deliberately invalid until an authorized human completes and verifies it.</div>
            {stages.length > 0 && (
              <ol className="stagerail" aria-label="decision interface stages">
                {stages.map((s, i) => (
                  <li key={s} data-now={String(i <= 3)} data-head={String(i === 3)}>
                    <i /><span>{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {tplData && (
            <div className="chairform">
              <div className="ilabel">the empty form · {tplName} · {nulls.length} fields</div>
              <div className="nullrule"><span className="nv">∅ NULL · AWAITING HUMAN</span> · every field, by design</div>
              <div className="nullcloud">
                {nulls.map((n) => <span key={n} className="nullchip">{n}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Station>
  );
}

function collectNulls(obj: unknown, prefix = "", out: string[] = [], depth = 0): string[] {
  if (depth > 4 || out.length > 60) return out;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v === null) out.push(p);
      else if (typeof v === "object") collectNulls(v, p, out, depth + 1);
    }
  }
  return out;
}
