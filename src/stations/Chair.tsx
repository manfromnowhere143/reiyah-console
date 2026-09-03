/* ST–07 · THE CHAIR — the correction engine, then the seat.
   Reiyah files defects against itself and proves the fixes: contract →
   review → implementation → seal, append-only, version after version.
   This station discovers the whole saga from the live catalog — any DI
   version the engine ships appears here automatically — and ends, as it
   must, at the seat no tool may take. */
import { fetchCatalog, fetchSurfaceByPath, fetchSurface } from "../lib/evidence";
import { Blocked, Station, useSurfaceState } from "../components/primitives";

interface SagaFile {
  path: string;
  kind: string;
  sha256: string;
  result?: string;
  incident: boolean;
}
interface SagaVersion { version: string; files: SagaFile[]; incident: boolean }

const KIND_OF = (p: string): string => {
  if (p.includes("-corrections/")) return "correction";
  if (p.includes("-reviews/")) return "review";
  if (p.includes("validation-reports/")) return "canonical report";
  if (p.includes("operator-decision-interfaces/")) return "interface";
  if (p.includes("inventories/")) return "inventory";
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
            path: p,
            kind: KIND_OF(p),
            sha256: s.state === "observed" ? s.meta.sha256 : "blocked",
            result: d?.result ?? d?.status ?? d?.activation_state ?? d?.record_kind,
            incident: !!(d && (d.incident_validation || d.defect_reproduction)) || p.includes("liveness"),
          } as SagaFile,
        };
      })
    );
    for (const { v, f } of loaded) {
      byVersion.set(v, [...(byVersion.get(v) ?? []), f]);
    }
    const versions: SagaVersion[] = [...byVersion.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([version, files]) => ({
        version,
        files: files.sort((x, y) => x.kind.localeCompare(y.kind)),
        incident: files.some((f) => f.incident),
      }));

    /* the seat: the newest deliberately-invalid decision template */
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

  return (
    <Station id="ST–07" name="The Chair" sub="the engine that corrects itself, append-only · then the seat no tool may take">
      <div className="onepage">
        {/* ---- the correction engine, as a horizontal timeline ---- */}
        <div className="boardwrap" style={{ flex: "none" }}>
          <div className="ilabel">the correction engine · {versions.length} versions · self-found defects, contract → review → seal, append-only</div>
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
        </div>

        {/* ---- the seat, stages, and the empty form ---- */}
        <div className="chairbottom">
          <div className="chairleft">
            <div className="chairseat">
              <div className="cap">No tool may sit here.</div>
              <div className="capsub">
                The decision record is deliberately invalid until an authorized human completes and verifies it.
                {typeof itemCount === "number" ? ` ${itemCount} inventory items await individual human disposition.` : ""}
              </div>
            </div>
            {stages.length > 0 && (
              <div className="ipanel">
                <div className="ilabel">decision interface stages · append-only</div>
                <div className="stageflow">
                  {stages.map((s, i) => (
                    <span key={s} className="stagechip" data-now={String(i <= 3)}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {tplData && (
            <div className="ipanel chairform">
              <div className="ilabel">the empty form · {tplPath?.split("/").pop()?.replace(".template.json", "")} · {nulls.length} fields</div>
              {/* every field is NULL by design; the dashed ring is this
                  instrument's mark for "missing", and it is said once, not
                  once per field */}
              <div className="nullrule"><span className="nv">∅ NULL · AWAITING HUMAN</span> · every field, by design · no tool may fill one</div>
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
