/* ST–07 · THE CHAIR — THE CORRECTION ENGINE, then the seat no tool may take.
   Reiyah files incidents against itself: a named defect set, a root cause, a
   correction contract with obligations and required regressions, a
   role-separated review, a contract report, an implementation, a seal. Every
   version of that saga is discovered live from the catalog and drawn as its
   anatomy; a state that is absent is drawn as absent, never as done. Then the
   seat: the decision record is invalid until an authorized human completes it. */
import { useState } from "react";
import { fetchCatalog, fetchSurfaceByPath, fetchSurface } from "../lib/evidence";
import { getAt, setAt } from "../lib/urlstate";
import { Blocked, FitList, Stat, Station, useSurfaceState } from "../components/primitives";

type Kind = "incident" | "correction" | "review" | "report" | "plan" | "lock" | "fixtures" | "interface" | "inventory" | "template" | "record";
const ORDER: Kind[] = ["incident", "correction", "review", "report", "plan", "lock", "fixtures", "interface", "inventory", "template"];
const KIND_LABEL: Record<Kind, string> = {
  incident: "incident", correction: "contract", review: "review", report: "report", plan: "plan", lock: "toolchain lock",
  fixtures: "fixture catalog", interface: "interface", inventory: "inventory", template: "decision form", record: "record",
};
const kindOf = (p: string): Kind => {
  if (p.includes("-incidents/")) return "incident";
  if (p.includes("-corrections/")) return "correction";
  if (p.includes("-reviews/")) return "review";
  if (p.includes("validation-reports/")) return "report";
  if (p.includes("toolchain-lock")) return "lock";
  if (p.startsWith("fixtures/")) return "fixtures";
  if (p.includes("operator-decision-interfaces/")) return "interface";
  if (p.includes("inventories/")) return "inventory";
  if (p.includes("decisions/")) return "template";
  if (p.startsWith("validation/")) return "plan";
  return "record";
};

interface Rec { path: string; kind: Kind; sha256: string; bytes: number; data: any }
interface Version {
  version: string; recs: Rec[];
  defects: Array<{ id: string; status: string; claim: string; impact: string }>;
  rootCause: string | null;
  disposition: Array<[string, string]>;
  obligations: number | null; pos: number | null; neg: number | null;
  resultContract: Array<[string, string]>;
  stage: { now: string | null; stop: string | null };
  review: { verdict: string; roles: number; checks: string; blockers: number } | null;
  report: { result: string; status: string; exit: string; diag: number } | null;
  nonclaims: number;
  fixtures: number;
  futureSeq: string[];
  burned: string[];
}

const short = (s: unknown) => String(s ?? "").replace(/_/g, " ");

function anatomy(version: string, recs: Rec[]): Version {
  const inc = recs.find((r) => r.kind === "incident")?.data;
  const cor = recs.find((r) => r.kind === "correction")?.data;
  const rev = recs.filter((r) => r.kind === "review").map((r) => r.data).find((d) => d?.aggregate_review_result) ?? recs.find((r) => r.kind === "review")?.data;
  const rep = recs.find((r) => r.kind === "report")?.data;
  const defects = Array.isArray(inc?.defects)
    ? inc.defects.map((d: any) => ({ id: String(d.defect_id ?? d.id ?? "defect"), status: String(d.status ?? d.observed_state ?? ""), claim: String(d.false_or_unproven_claim ?? d.claim ?? ""), impact: String(d.impact ?? d.description ?? "") }))
    : [];
  const rootCause = inc?.root_cause?.category ?? inc?.causal_hypothesis?.status ?? null;
  const dispo = inc?.incident_disposition && typeof inc.incident_disposition === "object"
    ? Object.entries(inc.incident_disposition).filter(([k, v]) => typeof v === "string" || k.endsWith("_required") || k.endsWith("_confirmed") || k.endsWith("_closed")).map(([k, v]) => [short(k), short(v)] as [string, string]).slice(0, 8)
    : [];
  const obligations = cor?.correction_obligations ? (Array.isArray(cor.correction_obligations) ? cor.correction_obligations.length : Object.keys(cor.correction_obligations).length) : cor?.correction_contract ? Object.keys(cor.correction_contract).length : null;
  const pos = Array.isArray(cor?.required_positive_regressions) ? cor.required_positive_regressions.length : null;
  const neg = Array.isArray(cor?.required_negative_regressions) ? cor.required_negative_regressions.length : (Array.isArray(cor?.required_contract_adversaries) ? cor.required_contract_adversaries.length : null);
  const resultContract = cor?.result_contract && typeof cor.result_contract === "object"
    ? Object.entries(cor.result_contract).map(([k, v]) => [short(k), short(typeof v === "object" ? JSON.stringify(v) : v)] as [string, string])
    : [];
  const ftm = cor?.future_transition_model ?? {};
  const stage = { now: ftm.current_authorized_stage ?? null, stop: ftm.current_hard_stop_before ?? null };
  const agg = rev?.aggregate_review_result;
  const review = agg ? { verdict: String(agg.verdict ?? agg.state ?? ""), roles: Number(agg.distinct_role_count ?? agg.review_count ?? 0), checks: `${agg.passed_check_count ?? "?"}/${agg.required_check_count ?? "?"}`, blockers: Number(agg.blocker_count ?? (Array.isArray(rev?.blockers) ? rev.blockers.length : 0)) } : null;
  const report = rep ? { result: String(rep.result ?? ""), status: String(rep.status ?? ""), exit: String(rep.exit_code ?? "?"), diag: Array.isArray(rep.diagnostics) ? rep.diagnostics.length : 0 } : null;
  const nonclaims = [inc, cor, rev, rep].reduce((a, d) => a + (Array.isArray(d?.nonclaims) ? d.nonclaims.length : 0), 0);
  const fixtures = recs.filter((r) => r.kind === "fixtures").reduce((a, r) => a + (Array.isArray(r.data?.fixtures) ? r.data.fixtures.length : 0), 0);
  /* time as structure: the contracted future sequence, and the identities the
     engine declared it will never use again */
  const dispoObj = (inc?.incident_disposition && typeof inc.incident_disposition === "object") ? inc.incident_disposition : {};
  const futureSeq: string[] = Array.isArray(dispoObj.required_future_sequence) ? dispoObj.required_future_sequence.map(String) : [];
  const burnedSet = new Set<string>();
  for (const [k, v] of Object.entries(dispoObj)) {
    if (k.endsWith("_identity_reusable") && v === false) burnedSet.add(k.replace(/_identity_reusable$/, ""));
    if (k.endsWith("_state") && typeof v === "string" && v.includes("nonreusable")) burnedSet.add(k.replace(/_state$/, ""));
  }
  return { version, recs, defects, rootCause, disposition: dispo, obligations, pos, neg, resultContract, stage, review, report, nonclaims, fixtures, futureSeq, burned: [...burnedSet] };
}

export function Chair() {
  const state = useSurfaceState(async () => {
    const catalog = await fetchCatalog();
    const paths = catalog.map((c) => c.path).filter((p) => /operator-decision|OPERATOR_DECISION-1\.2\.\d/.test(p) && p.endsWith(".json"));
    const loaded = await Promise.all(paths.map(async (p) => {
      const s = await fetchSurfaceByPath<any>(p);
      const v = p.match(/1\.2\.\d+/)?.[0] ?? "?";
      return { v, rec: { path: p, kind: kindOf(p), sha256: s.state === "observed" ? s.meta.sha256 : "blocked", bytes: s.state === "observed" ? s.meta.bytes : 0, data: s.state === "observed" ? s.data : null } as Rec };
    }));
    const byV = new Map<string, Rec[]>();
    for (const { v, rec } of loaded) if (/^1\.2\.[4-9]|^1\.2\.\d\d/.test(v)) byV.set(v, [...(byV.get(v) ?? []), rec]);
    const versions = [...byV.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([v, recs]) => anatomy(v, recs));
    const odi = await fetchSurface<any>("odi");
    return { versions, odi };
  });
  const [sel, setSelRaw] = useState<string | null>(() => getAt());
  const setSel = (v: string | null) => { setSelRaw(v); setAt(v); };

  if (state.phase === "loading") return <Station id="ST–07" name="The Chair"><div className="note">discovering the correction saga…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–07" name="The Chair"><Blocked reason={state.reason} /></Station>;

  const { versions, odi } = state.data;
  const odiData = odi.state === "observed" ? odi.data : null;
  const itemCount = odiData?.unresolved_inventory_contract?.item_count;
  const acceptance = String(odiData?.authority?.operator_acceptance_state ?? "unaccepted").toUpperCase();
  const latest = versions.at(-1);
  const cur = versions.find((v) => v.version === sel) ?? latest;
  const totalDefects = versions.reduce((a, v) => a + v.defects.length, 0);
  const totalRegs = versions.reduce((a, v) => a + (v.pos ?? 0) + (v.neg ?? 0), 0);
  const totalRecs = versions.reduce((a, v) => a + v.recs.length, 0);
  const incidents = versions.filter((v) => v.recs.some((r) => r.kind === "incident")).length;
  const INC = versions.flatMap((v) => v.recs.filter((r) => r.kind === "incident").map((r) => ({ path: r.path, sha256: r.sha256 })));
  const COR = versions.flatMap((v) => v.recs.filter((r) => r.kind === "correction").map((r) => ({ path: r.path, sha256: r.sha256 })));
  const ALL = versions.flatMap((v) => v.recs.map((r) => ({ path: r.path, sha256: r.sha256 })));
  const ODI = odi.state === "observed" ? [{ id: "odi", path: odi.meta.path, sha256: odi.meta.sha256 }] : [];

  return (
    <Station id="ST–07" name="The Chair" sub="the engine that corrects itself, append-only · then the seat no tool may take">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="corrections" value={versions.length} sub={`${totalRecs} records · ${incidents} incidents filed against itself`}
            rule="distinct 1.2.x versions among every operator-decision record in the catalog; records are all such files; incidents are versions holding an incident record" from={ALL.slice(0, 12)} />
          <Stat label="named defects" value={totalDefects} sub="each with an id, a claim, an impact"
            rule="sum of the length of the defects array across every incident record" from={INC} />
          <Stat label="regressions required" value={totalRegs} sub="positive and negative, before any fix counts"
            rule="sum of required_positive_regressions and required_negative_regressions (or required_contract_adversaries) across every correction contract" from={COR} />
          <Stat label="acceptance" value={acceptance} small sub={typeof itemCount === "number" ? `${itemCount} items await human disposition` : "awaiting a human"}
            rule="authority.operator_acceptance_state and unresolved_inventory_contract.item_count of the operator decision interface record" from={ODI} />
        </div>

        {/* the spine: one column per version, one mark per record kind */}
        <div className="cspine" role="list">
          {versions.map((v) => {
            const kinds = new Set(v.recs.map((r) => r.kind));
            return (
              <button key={v.version} className="cver" role="listitem" data-on={String(v.version === cur?.version)} data-now={String(v.version === latest?.version)}
                onClick={() => setSel(v.version)} onPointerEnter={() => setSel(v.version)}>
                <span className="cvv">{v.version}</span>
                <span className="cvk">
                  {ORDER.map((k) => (
                    <i key={k} className="ck" data-k={k} data-on={String(kinds.has(k))} title={`${KIND_LABEL[k]}${kinds.has(k) ? "" : " · absent"}`} />
                  ))}
                </span>
                <span className="cvs">
                  {v.defects.length > 0 ? `${v.defects.length} defects` : kinds.has("incident") ? "incident" : "no incident"}
                  {v.review ? ` · ${v.review.verdict}` : ""}
                  {v.version === latest?.version ? " · forging" : ""}
                </span>
              </button>
            );
          })}
        </div>

        {/* the anatomy of the selected version */}
        {cur && (
          <div className="canat">
            <div className="cpane">
              <div className="ilabel">{cur.version} · incident{cur.rootCause ? ` · root cause` : ""}</div>
              {cur.rootCause ? <div className="ccause">{short(cur.rootCause)}</div> : <div className="ccause dim">no incident record in this version</div>}
              {cur.defects.length > 0 ? (
                <FitList items={cur.defects} render={(d) => (
                  <div key={d.id} className="cdef">
                    <span className="cdid">{d.id}</span>
                    <span className="cdst" data-s={d.status}>{short(d.status)}</span>
                    <span className="cdcl">{d.claim || d.impact}</span>
                  </div>
                )} more={(k) => <>+ {k} more defects, each named</>} />
              ) : cur.disposition.length > 0 ? (
                <FitList items={cur.disposition} render={([k, v]) => (
                  <div key={k} className="crow"><span className="crk">{k}</span><span className="crv">{v}</span></div>
                )} more={(k) => <>+ {k} more disposition states</>} />
              ) : <div className="note" style={{ fontSize: "0.62rem" }}>the incident of this version carries no defect list; its states are in its records</div>}
            </div>

            <div className="cpane">
              <div className="ilabel">correction contract{cur.obligations !== null ? ` · ${cur.obligations} obligations` : ""}</div>
              <div className="cregs">
                <span className="creg" data-side="pos"><b>{cur.pos ?? "∅"}</b> positive regressions required</span>
                <span className="creg" data-side="neg"><b>{cur.neg ?? "∅"}</b> negative regressions required</span>
              </div>
              {cur.resultContract.length > 0 ? (
                <FitList items={cur.resultContract} render={([k, v]) => (
                  <div key={k} className="crow"><span className="crk">{k}</span><span className="crv">{v}</span></div>
                )} more={(k) => <>+ {k} more result states, each kept distinct</>} />
              ) : <div className="note" style={{ fontSize: "0.62rem" }}>{cur.recs.some((r) => r.kind === "correction") ? "this contract records obligations without a result ledger" : "no correction contract in this version"}</div>}
            </div>

            <div className="cpane">
              <div className="ilabel">review · report · stage</div>
              <div className="cverdict">
                {cur.review ? (
                  <><span className="cvl">review</span><span className="cvv2" data-v={cur.review.verdict}>{cur.review.verdict.toUpperCase()}</span><span className="cvd">{cur.review.roles} roles · checks {cur.review.checks} · {cur.review.blockers} blockers · internal advisory, not authority</span></>
                ) : <><span className="cvl">review</span><span className="cvv2 dim">ABSENT</span><span className="cvd">no review record in this version</span></>}
              </div>
              <div className="cverdict">
                {cur.report ? (
                  <><span className="cvl">report</span><span className="cvv2" data-v={cur.report.status}>{cur.report.status.toUpperCase()}</span><span className="cvd">exit {cur.report.exit} · {cur.report.diag} diagnostics · {short(cur.report.result)}</span></>
                ) : <><span className="cvl">report</span><span className="cvv2 dim">ABSENT</span><span className="cvd">no contract report in this version</span></>}
              </div>
              {cur.futureSeq.length > 0 ? (
                <div className="timerail" aria-label="the contracted future">
                  <span className="cvl">time</span>
                  <div className="tsteps">
                    {cur.futureSeq.map((step) => {
                      const isStop = /^STOP/i.test(step) || (cur.stage.stop ? step === cur.stage.stop : false);
                      const isNow = cur.stage.now ? step === cur.stage.now : false;
                      const isHardStop = cur.stage.stop ? step === cur.stage.stop : false;
                      return (
                        <span key={step} className="tstep" data-s={isNow ? "now" : isStop ? "stop" : isHardStop ? "hardstop" : "future"} title={step}>
                          <i />{step.replace(/-/g, " ").replace(/^STOP before separately authorized /i, "STOP · before ")}
                        </span>
                      );
                    })}
                  </div>
                  {cur.burned.length > 0 && (
                    <div className="burned">
                      <span className="cvl">burned</span>
                      {cur.burned.map((b) => <span key={b} className="bname" title="absent · not attempted · blocked · unretained · nonreusable"><s>{b}</s> never again</span>)}
                    </div>
                  )}
                  <span className="cvd">{cur.stage.stop ? `hard stop before ${short(cur.stage.stop)}` : ""}{cur.nonclaims ? ` · ${cur.nonclaims} non-claims` : ""}{cur.fixtures ? ` · ${cur.fixtures} fixtures` : ""}</span>
                </div>
              ) : (
                <div className="cverdict">
                  <span className="cvl">stage</span>
                  <span className="cvv2">{cur.stage.now ? short(cur.stage.now) : "—"}</span>
                  <span className="cvd">{cur.stage.stop ? `hard stop before ${short(cur.stage.stop)}` : "no future transition recorded"}{cur.nonclaims ? ` · ${cur.nonclaims} non-claims` : ""}{cur.fixtures ? ` · ${cur.fixtures} fixtures` : ""}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* the seat */}
        <div className="seatline2">
          <svg className="seatglyph2" viewBox="0 0 64 64" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10 h28 a3 3 0 0 1 3 3 v20 a3 3 0 0 1 -3 3 h-28 a3 3 0 0 1 -3 -3 v-20 a3 3 0 0 1 3 -3 z" />
              <path d="M20 36 v14 M44 36 v14 M12 50 h40" />
            </g>
            <circle cx="32" cy="23" r="2.4" fill="var(--accent)" />
          </svg>
          <span className="seatkick">no tool may sit here</span>
          <span className="seatmeta">the decision record is invalid until an authorized human completes and verifies it · acceptance {acceptance}</span>
        </div>
      </div>
    </Station>
  );
}
