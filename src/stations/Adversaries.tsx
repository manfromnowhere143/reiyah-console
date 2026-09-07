/* ST-06 · ADVERSARIES — THE WALL, THE RULES, THE REPLAY.
   Every fixture in the catalog is one cell of the wall: red when built to be
   rejected, hollow ink when built to pass, faded when retained history that
   is shown but never counted as current replay evidence. Every declared
   rejection rule is one tile of the treemap, sized by how many fixtures aim
   at it, all 253 on screen at once. The two views are linked: rest on a
   cell and its rule lights; rest on a rule and every fixture that must fail
   against it lights on the wall. Beneath them, the replay ledger: each
   sealed validation report that replayed fixtures, with what was rejected,
   what passed, and the digest of the actuals. Canvas in measured pixels,
   redrawn only on change; every figure is a committed byte. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchCatalog, fetchSurface, fetchSurfaceByPath } from "../lib/evidence";
import { MONO, tones } from "../lib/roadScene";
import { useGround } from "../lib/ground";
import { getAt, setAt } from "../lib/urlstate";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

interface Fixture {
  fixture_id: string; path: string; classification: "known_bad" | "known_good"; fixture_family: string;
  replay_mode: string; expected_primary_rule_id: string | null; sha256?: string; byte_size?: number; target_schema_id?: string | null;
}
interface Replay { version: string; path: string; sha256: string; adv: number; advRejected: number; good: number; goodPassed: number; actuals: string | null; status: string; kind: "fixtures" | "mutations" }

function useBox(key: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const m = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSz({ w: Math.round(r.width), h: Math.round(r.height) }); };
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, [key]);
  return { ref, ...sz };
}

/* squarified treemap: rows of tiles whose aspect ratios stay near one */
interface Tile { key: string; n: number; x: number; y: number; w: number; h: number }
function squarify(items: Array<[string, number]>, x: number, y: number, w: number, h: number): Tile[] {
  const out: Tile[] = [];
  const total = items.reduce((a, [, n]) => a + n, 0); if (!total || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  let rest = items.slice(); let X = x, Y = y, W = w, H = h;
  const worst = (row: number[], side: number) => { const s = row.reduce((a, b) => a + b, 0); const mx = Math.max(...row), mn = Math.min(...row); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
  while (rest.length) {
    const side = Math.min(W, H); const row: Array<[string, number]> = []; const areas: number[] = [];
    while (rest.length) {
      const [k, n] = rest[0]; const a = n * scale;
      if (areas.length && worst([...areas, a], side) > worst(areas, side)) break;
      row.push([k, n]); areas.push(a); rest = rest.slice(1);
    }
    const sum = areas.reduce((a, b) => a + b, 0);
    if (W >= H) { const cw = sum / H; let cy = Y; for (let i = 0; i < row.length; i++) { const th = areas[i] / cw; out.push({ key: row[i][0], n: row[i][1], x: X, y: cy, w: cw, h: th }); cy += th; } X += cw; W -= cw; }
    else { const ch = sum / W; let cx = X; for (let i = 0; i < row.length; i++) { const tw = areas[i] / ch; out.push({ key: row[i][0], n: row[i][1], x: cx, y: Y, w: tw, h: ch }); cx += tw; } Y += ch; H -= ch; }
  }
  return out;
}

export function Adversaries() {
  const state = useSurfaceState(async () => {
    const fx = await fetchSurface<any>("fixtures");
    const cat = await fetchCatalog().catch(() => []);
    /* every sealed validation report that replayed fixtures, in version order */
    const replays: Replay[] = [];
    for (const c of cat.filter((c) => /^gate\/validation-reports\/.*\.json$/.test(c.path))) {
      const s = await fetchSurfaceByPath<any>(c.path).catch(() => null);
      if (!s || s.state !== "observed") continue;
      const j = s.data, fv = j.fixture_validation, fb = j.fixtures && !Array.isArray(j.fixtures) ? j.fixtures : null;
      if (fv && typeof fv.adversarial_count === "number") replays.push({ version: String(j.version ?? ""), path: c.path, sha256: s.meta.sha256, adv: fv.adversarial_count, advRejected: fv.adversarial_rejected_count, good: fv.known_good_count, goodPassed: fv.known_good_passed_count, actuals: fv.actuals_sha256 ?? null, status: String(fv.status ?? j.status ?? ""), kind: "fixtures" });
      else if (fb && typeof fb.fixture_count === "number") { const bad = fb.known_bad_rejected_for_declared_diagnostic ?? fb.known_bad_rejected_for_declared_rule ?? 0; replays.push({ version: String(j.version ?? ""), path: c.path, sha256: s.meta.sha256, adv: fb.fixture_count - (fb.known_good_passed ?? 0), advRejected: bad, good: fb.known_good_passed ?? 0, goodPassed: fb.known_good_passed ?? 0, actuals: null, status: String(j.status ?? ""), kind: "fixtures" }); }
      /* mutation campaigns: schema mutants and case mutants, every one required to be rejected */
      const sm = j.schema_mutation_results, mv = j.mutation_validation;
      if (sm && typeof sm.required_count === "number") replays.push({ version: String(j.version ?? ""), path: c.path, sha256: s.meta.sha256, adv: sm.required_count, advRejected: sm.rejected_count ?? 0, good: 0, goodPassed: 0, actuals: null, status: String(j.status ?? ""), kind: "mutations" });
      if (mv && typeof mv.case_count === "number") replays.push({ version: String(j.version ?? ""), path: c.path, sha256: s.meta.sha256, adv: mv.case_count, advRejected: mv.rejected_count ?? 0, good: 0, goodPassed: 0, actuals: mv.actuals_sha256 ?? null, status: String(mv.status ?? j.status ?? ""), kind: "mutations" });
    }
    replays.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
    return { fx, replays };
  });
  if (state.phase === "loading") return <Station id="ST–06" name="Adversaries"><div className="note" data-loading="true">reading fixture catalog…</div></Station>;
  if (state.phase === "blocked" || state.data.fx.state !== "observed")
    return <Station id="ST–06" name="Adversaries"><Blocked reason={state.phase === "blocked" ? state.reason : (state.data.fx as any).reason} /></Station>;
  return <Wall meta={state.data.fx.meta} fixtures={state.data.fx.data.fixtures ?? []} catalog={state.data.fx.data} replays={state.data.replays} />;
}

function Wall({ meta, fixtures, catalog, replays }: { meta: { sha256: string; path: string }; fixtures: Fixture[]; catalog: any; replays: Replay[] }) {
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
  const rules = [...byRule.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const FX = [{ id: "fixtures", path: meta.path, sha256: meta.sha256 }];
  let bmin = Infinity, bmax = 0; for (const f of fixtures) { const b = f.byte_size ?? 0; if (b > 0) { bmin = Math.min(bmin, b); bmax = Math.max(bmax, b); } }

  const [cur, setCur] = useState(() => { const a = getAt(); const i = a ? cells.findIndex((c) => c.fixture_id === a) : -1; return i >= 0 ? i : 0; });
  const [hover, setHover] = useState<number | null>(() => { const a = getAt(); const i = a ? cells.findIndex((c) => c.fixture_id === a) : -1; return i >= 0 ? i : null; });
  const [rule, setRule] = useState<string | null>(null);
  const pick = (i: number) => { setHover(i); setAt(cells[i]?.fixture_id ?? null); };
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || hover !== null || rule !== null) return;
    const t = setInterval(() => setCur((c) => (c + 1) % cells.length), 1100);
    return () => clearInterval(t);
  }, [hover, rule, cells.length]);
  const at = cells[hover ?? cur];
  const litRule = rule ?? at?.expected_primary_rule_id ?? null;

  /* ---- the wall ---- */
  const wbox = useBox(cells.length);
  const wref = useRef<HTMLCanvasElement>(null);
  const layout = useRef<Array<{ x: number; y: number; s: number }>>([]);
  const dark = useGround();
  useEffect(() => {
    const cv = wref.current; if (!cv || wbox.w === 0) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = wbox.w, H = wbox.h, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const { INK, RED, OK } = tones(dark);
    const mobile = W < 560, gap = mobile ? 2 : 3, bandH = mobile ? 12 : 17, pad = 4;
    /* the largest square such that every family band and every cell fits */
    let s = 2;
    for (let t = 34; t >= 2; t--) {
      const cols = Math.floor((W - pad * 2 + gap) / (t + gap)); let rows = 0;
      for (const [, k] of families) rows += Math.ceil(k / cols);
      if (rows * (t + gap) + families.length * (bandH + gap) <= H - pad * 2) { s = t; break; }
    }
    const cols = Math.floor((W - pad * 2 + gap) / (s + gap));
    const pos: Array<{ x: number; y: number; s: number }> = [];
    let y = pad, i = 0;
    ctx.font = `${mobile ? 7 : 8}px ${MONO}`; ctx.textBaseline = "alphabetic";
    for (const [fam, k] of families) {
      const famBad = cells.filter((c) => c.fixture_family === fam && c.classification === "known_bad").length;
      const lit = !rule || cells.some((c) => c.fixture_family === fam && c.expected_primary_rule_id === rule);
      ctx.textAlign = "left"; ctx.fillStyle = `rgba(${INK},${lit ? 0.7 : 0.25})`;
      ctx.fillText(`${fam.replace(/_/g, " ").toUpperCase()} · ${k} · ${famBad} reject / ${k - famBad} pass`, pad, y + bandH - 5);
      y += bandH + gap;
      let col = 0;
      for (let j = 0; j < k; j++, i++) {
        const c = cells[i];
        const x = pad + col * (s + gap);
        pos.push({ x, y, s });
        const isBad = c.classification === "known_bad", ret = isRetained(c);
        const mass = bmax > bmin && c.byte_size ? (Math.log(c.byte_size) - Math.log(bmin)) / (Math.log(bmax) - Math.log(bmin)) : 0.5;
        const on = !rule || c.expected_primary_rule_id === rule;
        const isCur = i === (hover ?? cur);
        const a = (on ? 1 : 0.12) * (ret ? 0.42 : 1);
        if (isBad) { ctx.fillStyle = `rgba(${RED},${(a * (0.5 + mass * 0.5)).toFixed(3)})`; ctx.fillRect(x, y, s, s); }
        else { ctx.strokeStyle = `rgba(${INK},${(a * 0.8).toFixed(3)})`; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1); }
        if (isCur) { ctx.strokeStyle = `rgba(${OK},1)`; ctx.lineWidth = 2; ctx.strokeRect(x - 1.5, y - 1.5, s + 3, s + 3); }
        col++; if (col >= cols) { col = 0; y += s + gap; }
      }
      if (col !== 0) y += s + gap;
    }
    layout.current = pos;
  }, [wbox.w, wbox.h, cells, families, hover, cur, rule, dark, bmin, bmax]);
  const hitCell = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect(); const x = e.clientX - r.left, yy = e.clientY - r.top;
    const pos = layout.current; for (let i = 0; i < pos.length; i++) { const p = pos[i]; if (x >= p.x - 1 && x <= p.x + p.s + 1 && yy >= p.y - 1 && yy <= p.y + p.s + 1) return i; }
    return -1;
  };

  /* ---- the rules: a treemap of every declared rejection rule ---- */
  const tbox = useBox(rules.length);
  const tref = useRef<HTMLCanvasElement>(null);
  const tiles = useRef<Tile[]>([]);
  useEffect(() => {
    const cv = tref.current; if (!cv || tbox.w === 0) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = tbox.w, H = tbox.h, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const { INK, OK, RED } = tones(dark);
    const ts = squarify(rules, 0, 0, W, H); tiles.current = ts;
    const maxN = rules[0]?.[1] ?? 1;
    ctx.font = `8px ${MONO}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    for (const t of ts) {
      const on = t.key === litRule;
      const a = 0.08 + 0.42 * Math.sqrt(t.n / maxN);
      ctx.fillStyle = on ? `rgba(${OK},0.9)` : `rgba(${RED},${a.toFixed(3)})`;
      ctx.fillRect(t.x + 0.5, t.y + 0.5, Math.max(0, t.w - 1), Math.max(0, t.h - 1));
      if (t.w > 54 && t.h > 14) {
        ctx.fillStyle = on ? "rgba(255,255,255,0.95)" : `rgba(${INK},0.85)`;
        const label = t.key.replace(/^GA(\d*)-/, ""); const maxc = Math.floor((t.w - 8) / 5);
        ctx.fillText(label.length > maxc ? label.slice(0, Math.max(3, maxc - 1)) + "…" : label, t.x + 4, t.y + Math.min(t.h / 2, 9));
        if (t.h > 26) { ctx.fillStyle = on ? "rgba(255,255,255,0.8)" : `rgba(${INK},0.6)`; ctx.fillText(String(t.n), t.x + 4, t.y + Math.min(t.h / 2, 9) + 11); }
      }
    }
  }, [tbox.w, tbox.h, rules, litRule, dark]);
  const hitTile = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect(); const x = e.clientX - r.left, yy = e.clientY - r.top;
    return tiles.current.find((t) => x >= t.x && x < t.x + t.w && yy >= t.y && yy < t.y + t.h) ?? null;
  };
  const ruleCount = litRule ? byRule.get(litRule) ?? 0 : 0;

  return (
    <Station id="ST–06" name="Adversaries" sub="every known-bad fails for its exact declared reason, through the production validator">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="built to be rejected" value={bad} sub={`${pct}% of the corpus exists to prove rejection`}
            rule="count of fixtures whose classification is known_bad; the percentage is that count over all fixtures" from={FX} />
          <Stat label="built to pass" value={good} sub="known-good, every one must pass"
            rule="count of fixtures whose classification is not known_bad" from={FX} />
          <Stat label="declared reasons" value={byRule.size} sub="distinct rules a known-bad must fail against · every one on the treemap"
            rule="count of distinct expected_primary_rule_id values across the fixtures" from={FX} />
          <Stat label="current replay" value={<>{current}<em>/{fixtures.length}</em></>} sub={`${retained} retained history, shown, never counted`}
            rule="fixtures whose replay_mode is not retained_not_replayed, over all fixtures; the catalog itself states that historical rows are not current replay evidence" from={FX} />
        </div>

        <div className="grid2 fillgrid wallgrid">
          <div className="boardwrap wallwrap">
            <div className="ilabel">the wall · {fixtures.length} fixtures · red = must be rejected, deeper for larger bytes · hollow = must pass · faded = retained, not replayed</div>
            <div className="mbox wallbox" ref={wbox.ref}>
              <canvas ref={wref} className="wallcv" style={{ width: wbox.w, height: wbox.h }}
                onPointerMove={(e) => { const i = hitCell(e); if (i >= 0) pick(i); }} onPointerDown={(e) => { const i = hitCell(e); if (i >= 0) pick(i); }} onPointerLeave={() => setHover(null)}
                aria-label="Every fixture as one cell, banded by family" />
            </div>
            <div className="wallcap" aria-live="polite">
              <span className="wcidx">{(hover ?? cur) + 1} / {cells.length}</span>
              <span className="wcpath">{at?.path}{at?.byte_size ? ` · ${at.byte_size.toLocaleString("en-US")} B` : ""}</span>
              <span className="wcrule" data-c={at?.classification === "known_bad" ? "bad" : "good"}>
                {at?.classification === "known_bad" ? <>must fail · <b>{at.expected_primary_rule_id ?? "declared rule"}</b></> : <>must pass</>}
                {at && isRetained(at) ? " · retained, not replayed" : ""}
              </span>
            </div>
          </div>

          <div className="ipanel wspanel">
            <div className="ilabel">the rules · {rules.length} declared reasons, every one a tile · area = fixtures aimed at it{litRule ? <> · <b className="ruleon">{litRule}</b> · {ruleCount}</> : ""}</div>
            <div className="mbox" ref={tbox.ref}>
              <canvas ref={tref} className="wallcv" style={{ width: tbox.w, height: tbox.h }}
                onPointerMove={(e) => { const t = hitTile(e); setRule(t ? t.key : null); }} onPointerDown={(e) => { const t = hitTile(e); setRule(t && rule === t.key ? null : t ? t.key : null); }} onPointerLeave={() => setRule(null)}
                aria-label="A treemap of every declared rejection rule" />
            </div>
          </div>
        </div>

        <div className="wsreg replayrow">
          <span className="cvl">the replay</span>
          <span className="wsregv">
            {replays.length ? replays.map((r) => (
              <span className="replay" data-ok={String(r.advRejected === r.adv && r.goodPassed === r.good)} key={r.path + r.kind}>
                <b>{r.version}</b> · {r.kind === "mutations" ? <>mutants rejected <b>{r.advRejected}/{r.adv}</b></> : <>rejected <b>{r.advRejected}/{r.adv}</b> · passed <b>{r.goodPassed}/{r.good}</b></>}{r.actuals ? " · actuals frozen" : ""} <Digest id={`p/${r.path}`} sha={r.sha256} path={r.path} />
              </span>
            )) : "no sealed validation report carries a fixture replay block"}
          </span>
          <span className="wsregv dim">{catalog.all_current_replay_known_bad_must_fail_for_declared_rule ? "the catalog binds: every current known-bad must fail for its declared rule, every known-good must pass" : ""}{catalog.historical_rows_are_current_replay_evidence === false ? " · historical rows are not current replay evidence" : ""} · <Digest id="fixtures" sha={meta.sha256} path={meta.path} /></span>
        </div>
      </div>
    </Station>
  );
}
