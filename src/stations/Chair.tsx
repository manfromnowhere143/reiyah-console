/* THE CHAIR — the operator decision template exactly as it exists: every
   human field null, deliberately invalid, awaiting the one act no tool may
   perform. The only standing red in the instrument. */
import { fetchSurface } from "../lib/evidence";
import { Blocked, Digest, Station, useSurfaceState } from "../components/primitives";

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

export function Chair() {
  const state = useSurfaceState(async () => {
    const [tpl, odi] = await Promise.all([fetchSurface<any>("decision-template"), fetchSurface<any>("odi")]);
    return { tpl, odi };
  });
  if (state.phase === "loading") return <Station id="ST–07" name="The Chair"><div className="note">reading decision interface…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–07" name="The Chair"><Blocked reason={state.reason} /></Station>;

  const { tpl, odi } = state.data;
  const tplData = tpl.state === "observed" ? tpl.data : null;
  const odiData = odi.state === "observed" ? odi.data : null;
  const nulls = tplData ? collectNulls(tplData) : [];
  const stages: string[] = odiData?.stage_contract?.ordered_stage_ids ?? [];
  const itemCount = odiData?.unresolved_inventory_contract?.item_count;

  return (
    <Station id="ST–07" name="The Chair" sub="operator acceptance is an external human act · no software path can fill these fields">
      <div className="chair">
        <div className="chairseat">
          <div className="cap">No tool may sit here.</div>
          <div className="capsub">
            The decision record below is deliberately invalid until an authorized human completes and
            verifies it. {typeof itemCount === "number" ? `${itemCount} inventory items await individual human disposition.` : ""}
          </div>
        </div>

        {stages.length > 0 && (
          <div className="ipanel" style={{ marginBottom: "0.8rem" }}>
            <div className="ilabel">decision interface stages · append-only</div>
            <div className="stageflow">
              {stages.map((s, i) => (
                <span key={s} className="stagechip" data-now={String(i <= 1)}>{s}</span>
              ))}
            </div>
            <div className="note">Identity verification and authority verification are separate series; neither may substitute for the other.</div>
          </div>
        )}

        {tplData && (
          <div className="ipanel">
            <div className="ilabel" style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span>the empty form · {nulls.length} fields awaiting a human</span>
              {tpl.state === "observed" && <Digest id="decision-template" sha={tpl.meta.sha256} path={tpl.meta.path} />}
            </div>
            {nulls.slice(0, 16).map((n) => (
              <div key={n} className="nullfield"><span>{n}</span><span className="nv">NULL · AWAITING HUMAN</span></div>
            ))}
            {nulls.length > 16 && <div className="note" style={{ marginTop: "0.5rem" }}>… and {nulls.length - 16} more, all null by design.</div>}
          </div>
        )}
      </div>
    </Station>
  );
}
