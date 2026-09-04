/* ST-06 · ADVERSARIES — THE WALL. Every fixture in the catalog is one cell:
   filled = built to be rejected, hollow = built to pass, faded = retained
   history that is shown but never counted as current replay evidence (Reiyah
   law: historical rows are not current replay evidence). The wall sizes its
   cells to the screen it is on, so it always fits and never scrolls. A slow
   cursor interrogates one fixture at a time, reading its real path and the
   exact rule it must fail against; hovering takes the cursor. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchSurface } from "../lib/evidence";
import { Blocked, Digest, FitList, Stat, Station, useSurfaceState } from "../components/primitives";

interface Fixture {
  fixture_id: string;
  path: string;
  classification: "known_bad" | "known_good";
  fixture_family: string;
  replay_mode: string;
  expected_primary_rule_id: string | null;
}

export function Adversaries() {
  const state = useSurfaceState(() => fetchSurface<any>("fixtures"));
  if (state.phase === "loading") return <Station id="ST–06" name="Adversaries"><div className="note">reading fixture catalog…</div></Station>;
  if (state.phase === "blocked" || state.data.state !== "observed")
    return <Station id="ST–06" name="Adversaries"><Blocked reason={state.phase === "blocked" ? state.reason : (state.data as any).reason} /></Station>;
  return <Wall meta={state.data.meta} fixtures={state.data.data.fixtures ?? []} />;
}

function Wall({ meta, fixtures }: { meta: { sha256: string; path: string }; fixtures: Fixture[] }) {
  /* order: family by size, then current replay before retained, bad before good */
  const famCount = new Map<string, number>();
  for (const f of fixtures) famCount.set(f.fixture_family, (famCount.get(f.fixture_family) ?? 0) + 1);
  const families = [...famCount.entries()].sort((a, b) => b[1] - a[1]);
  const famRank = new Map(families.map(([f], i) => [f, i]));
  const isRetained = (f: Fixture) => f.replay_mode === "retained_not_replayed";
  const cells = [...fixtures].sort((a, b) =>
    (famRank.get(a.fixture_family)! - famRank.get(b.fixture_family)!) ||
    (Number(isRetained(a)) - Number(isRetained(b))) ||
    (Number(a.classification === "known_good") - Number(b.classification === "known_good")) ||
    a.path.localeCompare(b.path));

  const bad = fixtures.filter((f) => f.classification === "known_bad").length;
  const good = fixtures.length - bad;
  const retained = fixtures.filter(isRetained).length;
  const current = fixtures.length - retained;
  const pct = fixtures.length ? Math.round((bad / fixtures.length) * 100) : 0;
  const byRule = new Map<string, number>();
  for (const f of fixtures) if (f.expected_primary_rule_id) byRule.set(f.expected_primary_rule_id, (byRule.get(f.expected_primary_rule_id) ?? 0) + 1);
  const rules = [...byRule.entries()].sort((a, b) => b[1] - a[1]);
  const maxRule = rules[0]?.[1] ?? 1;
  const FX = [{ id: "fixtures", path: meta.path, sha256: meta.sha256 }];

  /* ---- the cell size is measured: the largest square such that every fixture fits ---- */
  const wallRef = useRef<HTMLDivElement>(null);
  const [cs, setCs] = useState(10);
  useLayoutEffect(() => {
    const el = wallRef.current;
    if (!el) return;
    const fit = () => {
      const W = el.clientWidth - 10, H = el.clientHeight - 10, n = cells.length;
      if (W <= 0 || H <= 0 || n === 0) return;
      const gap = 3, bandH = 17, bands = families.length;
      let s = 4;
      for (let t = 36; t >= 4; t--) {
        const cols = Math.floor((W + gap) / (t + gap));
        /* each family band starts a fresh row under its label */
        let rows = 0;
        for (const [f, k] of families) { void f; rows += Math.ceil(k / cols); }
        if (rows * (t + gap) + bands * (bandH + gap) <= H - 2) { s = t; break; }
      }
      setCs(s);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells.length, families.length]);

  /* ---- the interrogation cursor: one fixture at a time, hover takes over ---- */
  const [cur, setCur] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [hl, setHl] = useState<string | null>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (hover !== null) return;
    const t = setInterval(() => setCur((c) => (c + 1) % cells.length), 1100);
    return () => clearInterval(t);
  }, [hover, cells.length]);
  const at = cells[hover ?? cur];

  return (
    <Station id="ST–06" name="Adversaries" sub="every known-bad fails for its exact declared reason, through the production validator">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="built to be rejected" value={bad} sub={`${pct}% of the corpus exists to prove rejection`}
            rule="count of fixtures whose classification is known_bad; the percentage is that count over all fixtures" from={FX} />
          <Stat label="built to pass" value={good} sub="known-good, every one must pass"
            rule="count of fixtures whose classification is not known_bad" from={FX} />
          <Stat label="declared reasons" value={byRule.size} sub="distinct rules a known-bad must fail against"
            rule="count of distinct expected_primary_rule_id values across the fixtures" from={FX} />
          <Stat label="current replay" value={<>{current}<em>/{fixtures.length}</em></>} sub={`${retained} retained history, shown, never counted`}
            rule="fixtures whose replay_mode is not retained_not_replayed, over all fixtures; the catalog itself states that historical rows are not current replay evidence" from={FX} />
          <Stat label="catalog digest" wide rule="SHA-256 of the fixture catalog bytes as recorded in the evidence index; press the chip to recompute it here" from={FX}>
            <div style={{ marginTop: "0.28rem" }}><Digest id="fixtures" sha={meta.sha256} path={meta.path} /></div>
          </Stat>
        </div>

        <div className="grid2 fillgrid wallgrid">
          <div className="boardwrap wallwrap">
            <div className="ilabel wallhead">
              <span>the wall · {fixtures.length} fixtures · filled = must be rejected · hollow = must pass · faded = retained, not replayed</span>
            </div>
            <div className="wall" ref={wallRef} data-hl={hl ?? ""} style={{ ["--cs" as any]: `${cs}px` }}
              onPointerLeave={() => setHover(null)}>
              {cells.map((f, i) => (<>
                {(i === 0 || cells[i - 1].fixture_family !== f.fixture_family) && (
                  <span key={`band-${f.fixture_family}`} className="wband" data-on={String(hl === f.fixture_family)}>
                    {f.fixture_family.replace(/_/g, " ")} · {famCount.get(f.fixture_family)} · {cells.filter((x) => x.fixture_family === f.fixture_family && x.classification === "known_bad").length} reject / {cells.filter((x) => x.fixture_family === f.fixture_family && x.classification === "known_good").length} pass
                  </span>
                )}
                <i key={f.fixture_id} className="wcell"
                  data-c={f.classification === "known_bad" ? "bad" : "good"}
                  data-r={isRetained(f) ? "retained" : "current"}
                  data-f={f.fixture_family}
                  data-cur={String(i === (hover ?? cur))}
                  onPointerEnter={() => setHover(i)} />
              </>))}
            </div>
            <div className="wallcap" aria-live="polite">
              <span className="wcidx">{(hover ?? cur) + 1} / {cells.length}</span>
              <span className="wcpath">{at?.path}</span>
              <span className="wcrule" data-c={at?.classification === "known_bad" ? "bad" : "good"}>
                {at?.classification === "known_bad"
                  ? <>must fail · <b>{at.expected_primary_rule_id ?? "declared rule"}</b></>
                  : <>must pass</>}
                {at && isRetained(at) ? " · retained, not replayed" : ""}
              </span>
            </div>
            <div className="walllegend">
              {families.map(([f, n]) => (
                <button key={f} data-on={String(hl === f)} onPointerEnter={() => setHl(f)} onPointerLeave={() => setHl(null)}
                  onClick={() => setHl(hl === f ? null : f)}>
                  {f.replace(/_/g, " ")} <em>{n}</em>
                </button>
              ))}
            </div>
          </div>

          <div className="ipanel fillpanel">
            <div className="ilabel">most-exercised rejection rules · {rules.length} distinct</div>
            <FitList
              items={rules}
              render={([r, n]) => (
                <div key={r} className="bar rulebar">
                  <span className="bk">{r}</span>
                  <span className="bt"><span className="bf" style={{ width: `${(n / maxRule) * 100}%` }} /></span>
                  <span className="bn">{n}</span>
                </div>
              )}
              more={(k) => <>+ {k} more rules, each declared by name</>}
            />
          </div>
        </div>
      </div>
    </Station>
  );
}
