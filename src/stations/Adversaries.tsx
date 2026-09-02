/* ADVERSARIES — the fixture wall: a corpus that exists mostly to prove the
   validator rejects things, each for its exact declared reason. */
import { fetchSurface } from "../lib/evidence";
import { Blocked, Digest, Station, useSurfaceState } from "../components/primitives";

export function Adversaries() {
  const state = useSurfaceState(() => fetchSurface<any>("fixtures"));
  if (state.phase === "loading") return <Station id="ST–06" name="Adversaries"><div className="note">reading fixture catalog…</div></Station>;
  if (state.phase === "blocked" || state.data.state !== "observed")
    return <Station id="ST–06" name="Adversaries"><Blocked reason={state.phase === "blocked" ? state.reason : (state.data as any).reason} /></Station>;

  const meta = state.data.meta;
  const fixtures: any[] = state.data.data.fixtures ?? [];
  const bad = fixtures.filter((f) => f.classification === "known_bad").length;
  const good = fixtures.filter((f) => f.classification === "known_good").length;

  const byFamily = new Map<string, number>();
  const byRule = new Map<string, number>();
  for (const f of fixtures) {
    byFamily.set(f.fixture_family, (byFamily.get(f.fixture_family) ?? 0) + 1);
    if (f.expected_primary_rule_id) byRule.set(f.expected_primary_rule_id, (byRule.get(f.expected_primary_rule_id) ?? 0) + 1);
  }
  const families = [...byFamily.entries()].sort((a, b) => b[1] - a[1]);
  const rules = [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxFam = families[0]?.[1] ?? 1;
  const maxRule = rules[0]?.[1] ?? 1;
  const distinctRules = byRule.size;
  const pct = fixtures.length ? Math.round((bad / fixtures.length) * 100) : 0;

  return (
    <Station id="ST–06" name="Adversaries" sub="every known-bad fails for its exact declared reason, through the production validator">
      <div className="ipanel" style={{ marginBottom: "0.8rem" }}>
        <div className="ilabel">the wall · {bad} known-bad : {good} known-good</div>
        <div className="ratiobar" role="img" aria-label={`${bad} known-bad fixtures versus ${good} known-good`}>
          <span className="rb" style={{ flex: bad }} />
          <span className="rg" style={{ flex: good }} />
        </div>
        <div className="ratiolegend">
          <span><b>{bad}</b> BUILT TO BE REJECTED</span>
          <span><b>{good}</b> BUILT TO PASS</span>
        </div>
        <div className="note" style={{ marginTop: "0.7rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <span><b>{pct}%</b> of the corpus exists to prove rejection · <b>{distinctRules}</b> distinct declared reasons, each a named rule a known-bad must fail against</span>
          <Digest id="fixtures" sha={meta.sha256} path={meta.path} />
        </div>
      </div>

      <div className="grid2">
        <div className="ipanel">
          <div className="ilabel">families</div>
          {families.map(([f, n]) => (
            <div key={f} className="bar">
              <span className="bk">{f}</span>
              <span className="bt"><span className="bf" style={{ width: `${(n / maxFam) * 100}%` }} /></span>
              <span className="bn">{n}</span>
            </div>
          ))}
        </div>
        <div className="ipanel">
          <div className="ilabel">most-exercised rejection rules</div>
          {rules.map(([r, n]) => (
            <div key={r} className="bar" style={{ gridTemplateColumns: "1fr 4rem 2.2rem" }}>
              <span className="bk" style={{ fontSize: "0.56rem" }}>{r}</span>
              <span className="bt"><span className="bf" style={{ width: `${(n / maxRule) * 100}%`, background: "var(--accent-soft)" }} /></span>
              <span className="bn">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </Station>
  );
}
