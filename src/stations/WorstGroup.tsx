/* ST-12 · THE WORST GROUP — where redundancy is weakest, as a field. Every
   group in the lane's worst-group records is a disc: placed by class and
   range, sized by the objects it holds, deepened by its coincident-miss
   ratio; the worst eligible group is ringed. A group whose membership is not
   observed is drawn hollow and dashed, and when that makes the extremum
   unidentifiable the record says "missing" and so does this page. Every
   number is a field of a typed record with its digest; the finest strata
   come from Result I's transcript with simultaneous intervals. */
import { useEffect, useState } from "react";
import { fetchLane, fetchLaneText, parseStrata, parseWorstGroups, type Group, type LaneFile, type WorstGroupEval } from "../lib/gateb";
import { getAt, setAt } from "../lib/urlstate";
import { Blocked, Digest, FitList, Stat, Station, useSurfaceState } from "../components/primitives";

const WG = "evidence/measurement/worst-group-records.jsonl";
const RI = "evidence/measurement/result_i.txt";
const src = (f: LaneFile) => ({ id: `gateb/${f.id}`, path: `gate-b · ${f.path}`, sha256: f.sha256 ?? "" });
const fmt = (x: number | undefined) => (x === undefined ? "∅" : x.toFixed(3));
const name = (id: string) => id.replace(/^reiyah\.group\./, "").replace(/^cls-/, "").replace(/^class-/, "").replace(/^motion-/, "");
const parseId = (id: string) => { const m = /cls-(.+)-r(\d+-\d+)$/.exec(id); return m ? { cls: m[1], range: m[2] } : null; };

export function WorstGroup() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, wg: null, strata: null };
    const [W, I] = await Promise.all([fetchLaneText(WG).catch(() => null), fetchLaneText(RI).catch(() => null)]);
    return { lane, wg: W ? { evals: parseWorstGroups(W.text), file: W.file } : null, strata: I ? { rows: parseStrata(I.text), file: I.file } : null };
  });
  const [hover, setHover] = useState<string | null>(() => getAt());
  const [cur, setCur] = useState(0);
  const evals = state.phase === "ready" ? state.data.wg?.evals ?? [] : [];
  const field = evals.find((e) => e.evaluation_id.endsWith("class-and-range")) ?? null;
  const byClass = evals.find((e) => e.evaluation_id.endsWith("by-class")) ?? null;
  const motion = evals.find((e) => e.evaluation_id.endsWith("motion-state")) ?? null;
  const allGroups = [...(field?.groups ?? []), ...(byClass?.groups ?? []), ...(motion?.groups ?? [])];
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || hover !== null || allGroups.length === 0) return;
    const t = setInterval(() => setCur((c) => (c + 1) % allGroups.length), 1400);
    return () => clearInterval(t);
  }, [hover, allGroups.length]);

  if (state.phase === "loading") return <Station id="ST–12" name="The Worst Group"><div className="note">reading the worst-group records…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–12" name="The Worst Group"><Blocked reason={state.reason} /></Station>;
  const { lane, wg, strata } = state.data;
  if (!lane.present || !wg) return <Station id="ST–12" name="The Worst Group"><Blocked reason={`the Gate B lane's worst-group records are not present in this source: ${lane.reason ?? "unknown"}`} /></Station>;

  const at = allGroups.find((g) => g.group_id === hover) ?? allGroups[cur % Math.max(1, allGroups.length)];
  const pick = (id: string) => { setHover(id); setAt(id); };
  const WGS = [src(wg.file)];

  /* the field: classes as rows, range bands as columns */
  const cells = (field?.groups ?? []).map((g) => ({ g, ...parseId(g.group_id)! })).filter((c) => c.cls);
  const classes = [...new Set(cells.map((c) => c.cls))].sort();
  const ranges = [...new Set(cells.map((c) => c.range))].sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const maxN = Math.max(1, ...cells.map((c) => c.g.sample_count.value ?? 0));
  const maxP = Math.max(1, ...cells.map((c) => c.g.performance.value ?? 0));
  const worstField = field?.worst_group_ids?.[0];
  const disc = (g: Group, worst: boolean, key: string) => {
    const n = g.sample_count.value ?? 0, p = g.performance.value;
    const r = 0.28 + 0.72 * Math.sqrt(n / maxN);
    const depth = p === undefined ? 0 : Math.min(1, (p - 1) / Math.max(0.01, maxP - 1));
    const observed = g.membership_state === "observed" && g.performance.state === "observed";
    return (
      <button key={key} className="wgdisc" data-worst={String(worst)} data-observed={String(observed)} data-on={String(at?.group_id === g.group_id)}
        style={{ ["--r" as any]: r.toFixed(3), ["--d" as any]: depth.toFixed(3) }}
        onPointerEnter={() => pick(g.group_id)} onClick={() => pick(g.group_id)} onFocus={() => pick(g.group_id)}
        aria-label={`${name(g.group_id)} · ratio ${fmt(p)} · ${n.toLocaleString()} objects`} title={`${name(g.group_id)} · ${fmt(p)} · ${n.toLocaleString()} objects`}>
        <i /><b>{observed ? fmt(p).replace(/0+$/, "").replace(/\.$/, "") : "∅"}</b>
      </button>
    );
  };

  const coverage = allGroups.reduce((acc, g) => { for (const [k, v] of Object.entries(g.coverage_counts ?? {})) if (k !== "total") acc[k] = (acc[k] ?? 0) + v; return acc; }, {} as Record<string, number>);
  const finest = strata && strata.rows.length ? strata : null;

  return (
    <Station id="ST–12" name="The Worst Group" sub="gate b · where redundancy is weakest · proposed · not externally audited">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="worst group · class × range" value={field && field.worst_value.state === "observed" ? fmt(field.worst_value.value) : "∅"} sub={field ? `${field.worst_group_ids.map(name).join(", ")} · ${field.disposition}` : "record absent"}
            rule="worst_value and worst_group_ids of the class-and-range worst-group evaluation; the ratio is coincident misses over what independence predicts inside that group; direction lower is better" from={WGS} />
          <Stat label="worst class" value={byClass && byClass.worst_value.state === "observed" ? fmt(byClass.worst_value.value) : "∅"} sub={byClass ? `${byClass.worst_group_ids.map(name).join(", ")} · ${byClass.groups.length} classes` : "record absent"}
            rule="worst_value of the by-class worst-group evaluation over its declared group universe" from={WGS} />
          <Stat label="by motion state" value={motion ? (motion.worst_value.state === "observed" ? fmt(motion.worst_value.value) : motion.worst_value.state.toUpperCase()) : "∅"} small sub={motion ? `${motion.disposition} · ${motion.unknown_group_ids.length} group with non-observed membership` : "record absent"}
            rule="the motion-state evaluation's worst_value: when any group's membership is not observed, the extremum over the universe is not identified and the record says so; this page repeats it rather than picking the best of the rest" from={WGS} />
          <Stat label="groups evaluated" value={allGroups.length} sub={Object.entries(coverage).filter(([, v]) => v > 0).map(([k, v]) => `${v.toLocaleString()} ${k.replace(/_/g, " ")}`).join(" · ") || "no coverage counts"}
            rule="count of group_results across the three evaluations; the coverage counts are summed per epistemic state exactly as each record declares them" from={WGS} />
          <Stat label="finest stratum" value={finest ? fmt(finest.rows[0].lift) : "∅"} sub={finest ? `${finest.rows[0].cls} · ${finest.rows[0].range} m · ${finest.rows[0].vis} · simultaneous 95% [${finest.rows[0].lo}, ${finest.rows[0].hi}]` : "transcript absent"}
            rule="the top row of Result I's most-dependent eligible strata table (class × range × visibility) with its simultaneous 95% interval from a bootstrap max-t band" from={finest ? [src(finest.file)] : []} />
        </div>

        <div className="wggrid">
          <div className="ipanel wgpanel">
            <div className="ilabel">the field · every group a disc · size = objects · depth = coincident-miss ratio · ring = the worst eligible group</div>
            <div className="wgfield" style={{ ["--cols" as any]: ranges.length }} onPointerLeave={() => setHover(null)}>
              <div className="wgcorner" />
              {ranges.map((r) => <div key={r} className="wgcol">{r} m</div>)}
              {classes.map((cls) => (
                <div key={cls} className="wgrow" style={{ display: "contents" }}>
                  <div className="wgcls">{cls.replace(/-/g, " ")}</div>
                  {ranges.map((r) => {
                    const c = cells.find((x) => x.cls === cls && x.range === r);
                    return c ? disc(c.g, c.g.group_id === worstField, c.g.group_id) : <div key={r} className="wgabsent" title="not in the declared group universe" />;
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="wgside">
            <div className="ipanel wgpanel">
              <div className="ilabel">by class · {byClass?.groups.length ?? 0} groups · by motion state · {motion?.groups.length ?? 0} groups</div>
              <div className="wgrowfree">{(byClass?.groups ?? []).map((g) => disc(g, byClass?.worst_group_ids.includes(g.group_id) ?? false, `c-${g.group_id}`))}</div>
              <div className="wgrowfree">{(motion?.groups ?? []).map((g) => disc(g, false, `m-${g.group_id}`))}</div>
              {motion && motion.worst_value.state !== "observed" && <div className="wgmissing">extremum {motion.worst_value.state}: {String(motion.worst_value.reason ?? "")}</div>}
            </div>
            <div className="ipanel wgpanel fillpanel">
              <div className="ilabel">the finest strata · class × range × visibility · Result I · simultaneous 95% intervals</div>
              {finest ? (
                <FitList items={finest.rows} render={(s) => (
                  <div key={`${s.cls}${s.range}${s.vis}`} className="wgstr" data-sec={s.section}>
                    <span className="wgsn">{s.cls} · {s.range} m · {s.vis.replace("v", "vis ")}</span>
                    <span className="wgsv">{s.lift.toFixed(3)}</span>
                    <span className="wgsi">[{s.lo}, {s.hi}] · n {s.n.toLocaleString()}</span>
                  </div>
                )} more={(k) => <>+ {k} more strata in the transcript</>} />
              ) : <div className="note">Result I transcript not present or not in its known shape</div>}
            </div>
          </div>
        </div>

        <div className="wallcap wgcap" aria-live="polite">
          <span className="wcidx">{at ? name(at.group_id) : ""}</span>
          <span className="wcpath">{at ? `ratio ${fmt(at.performance.value)} · ${(at.sample_count.value ?? 0).toLocaleString()} objects · effective n ${(at.effective_sample_size.value ?? 0).toLocaleString()} · interval width ${fmt(at.interval_width.value)} · ${at.information_disposition} · membership ${at.membership_state}` : ""}</span>
          <span className="wcrule">{at ? Object.entries(at.coverage_counts ?? {}).filter(([k, v]) => k !== "total" && v > 0).map(([k, v]) => `${k.replace(/_/g, " ")} ${v.toLocaleString()}`).join(" · ") : ""}</span>
        </div>
        <div className="mnon">coincident-miss ratio inside each group, lower is better · association after declared conditioning, not causation · one public split · proposed · not externally audited · <Digest id={src(wg.file).id} sha={src(wg.file).sha256} path={src(wg.file).path} /></div>
      </div>
    </Station>
  );
}
