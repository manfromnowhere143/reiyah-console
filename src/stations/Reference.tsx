/* ST-17 · THE REFERENCE — the two horizons.
   Result AO asked what the word "ghost" had been measuring. The historical
   label meant: no annotation within two metres in a class-and-range filtered
   cache. Against the complete annotation table, 3,151 camera flags and 5,728
   lidar flags stand within two metres of an annotation the cache had left out.
   Drawn as the road: the near horizon is the filtered cache, the far horizon
   the complete table; the reclassified flags are the lights that come inside
   when the horizon moves out; what is still unmatched beyond the far horizon
   stays hollow, because no reference here certifies physical nonexistence.
   Below the horizons, the prepared study: four reference strata, sixty cases
   each, and the number of independent judgments so far, drawn as the width of
   each bracket. Every figure is a field of a committed record with its digest;
   the register's states are shown beside the numbers and neither is upgraded. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MONO, drawCabin, drawWorld, tones } from "../lib/roadScene";
import { useGround } from "../lib/ground";
import { fetchLane, fetchLaneJson, fetchLaneText, parseRegister, registerPath, type LaneFile } from "../lib/gateb";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const F = {
  AO: "evidence/measurement/result_ao.json",
  SEL: "evidence/reference-study/selection-aggregate-0.2.0.json",
  RDY: "evidence/reference-study/readiness-aggregate-0.2.0.json",
  FRZ: "research/reference-study/0.2.0/freeze.json",
};
const src = (f: LaneFile) => ({ id: `gateb/${f.id}`, path: `gate-b · ${f.path}`, sha256: f.sha256 ?? "" });
const fmt = (x: number | undefined | null, d = 3) => (x === undefined || x === null || !Number.isFinite(x) ? "∅" : x.toFixed(d));
const pct = (x: number | undefined | null) => (x === undefined || x === null ? "∅" : `${(x * 100).toFixed(1)}%`);
const int = (x: number | undefined | null) => (x === undefined || x === null ? "∅" : x.toLocaleString("en-US"));

interface Channel { detections_at_0_30: number; flagged_as_ghost_by_cache: number; within_2m_of_excluded_annotation: number; fraction_of_original_ghost_flags_reclassified: number }
interface Null { camera_candidate_opportunities: number; observed_coincidence_count: number; ego_relative_ratio: number; ego_relative_scene_bootstrap_percentile_95: [number, number]; world_fixed_ratio: number; world_fixed_scene_bootstrap_percentile_95: [number, number] }
interface AO {
  artifact_id: string; lifecycle_status: string; nonclaims: string[];
  ghost_reference_population: { camera: Channel; lidar: Channel };
  scene_clustering: { conditional_ratio: number; scene_bootstrap_percentile_95: [number, number]; scenes: number; replicates: number; support_rows: number; total_rows: number; tracked_instances: number };
  temporal_null_sensitivity: { filtered_cache: { fixed_heading_support: Null }; full_annotations: { fixed_heading_support: Null } };
}
interface Sel { groups: Record<string, { population_n: number; selected_n: number; scenes_represented: number }>; independent_judgments: number; selected_cases: number; sampled_scenes: number; population_scenes: number; protocol_sha256: string }
interface Rdy { cases: number; estimates: Record<string, { population_n: number; sampled_n: number; resolved_n: number; unresolved_or_unreviewed_n: number; confidence_set: [number, number]; state: string; sampling_margin: number }> }
interface Frz { frozen_at_utc: string; protocol_sha256: string; independent_judgments_collected: number }

const STRATA: Array<[string, string]> = [
  ["cache_near_control", "near a cached annotation · control"],
  ["excluded_annotation_near", "near an annotation the cache excluded"],
  ["full_unmatched_coincident", "unmatched · a lidar detection coincides"],
  ["full_unmatched_unpaired", "unmatched · alone"],
];

function isAO(j: unknown): j is AO {
  const a = j as AO;
  return !!a && typeof a === "object" && !!a.ghost_reference_population?.camera && !!a.ghost_reference_population?.lidar && !!a.scene_clustering && Array.isArray(a.scene_clustering.scene_bootstrap_percentile_95) && !!a.temporal_null_sensitivity?.filtered_cache?.fixed_heading_support && !!a.temporal_null_sensitivity?.full_annotations?.fixed_heading_support;
}

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

/* ---- the two horizons, drawn once per size, data and ground ---- */
function HorizonScene({ w, h, ao }: { w: number; h: number; ao: AO }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useGround();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const cv = ref.current; if (!cv || w === 0 || h === 0) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const { INK, OK, RED } = tones(dark);
      const mobile = w < 560;
      const dash = mobile ? 22 : 40, pillarW = mobile ? w * 0.05 : w * 0.075;
      const near = Math.round(h * (mobile ? 0.52 : 0.52)) + 0.5;      /* the filtered cache */
      const far = Math.round(h * (mobile ? 0.24 : 0.34)) + 0.5;        /* the complete annotation table */
      drawWorld(ctx, { w, h, dark, horizon: near, headlight: true, dashes: 6 });
      /* the far horizon: a second, fainter line where the fuller reference ends */
      ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = `rgba(${INK},0.35)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pillarW, far); ctx.lineTo(w - pillarW, far); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = `rgba(${RED},0.85)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pillarW, near); ctx.lineTo(w - pillarW, near); ctx.stroke(); ctx.restore();

      /* two lanes: camera left of the road's centre, lidar right */
      const lanes: Array<[string, Channel, number, number]> = [
        ["CAMERA", ao.ghost_reference_population.camera, pillarW + 12, w / 2 - 16],
        ["LIDAR", ao.ghost_reference_population.lidar, w / 2 + 16, w - pillarW - 12],
      ];
      let seed = 11;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const fs = mobile ? 8 : 9;
      /* one light per sixty flags, so the two populations keep their true
         proportion: reclassified lights stand between the horizons (steel
         blue, filled); still-unmatched lights stand beyond the far horizon
         (hollow); the exact counts are the labels */
      const per = mobile ? 120 : 60;
      for (const [, ch, x0, x1] of lanes) {
        const inside = ch.within_2m_of_excluded_annotation, beyond = ch.flagged_as_ghost_by_cache - inside;
        const nIn = Math.round(inside / per), nOut = Math.round(beyond / per);
        const skyTop = mobile ? 12 : 72; /* the legend owns the top of the desktop sky */
        for (let i = 0; i < nOut; i++) {
          const x = x0 + rnd() * (x1 - x0), y = skyTop + rnd() * (far - skyTop - 4);
          ctx.strokeStyle = `rgba(${INK},${(0.16 + 0.26 * (y / far)).toFixed(3)})`; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.stroke();
        }
        for (let i = 0; i < nIn; i++) {
          const x = x0 + rnd() * (x1 - x0), y = far + 4 + rnd() * (near - far - 8);
          const g = ctx.createRadialGradient(x, y, 0, x, y, 4.5);
          g.addColorStop(0, `rgba(${OK},0.8)`); g.addColorStop(1, `rgba(${OK},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(${OK},1)`; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill();
          const ry = near + (near - y) * 0.35;
          ctx.fillStyle = `rgba(${OK},0.14)`; ctx.beginPath(); ctx.arc(x, ry, 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      /* the figures, one column per lane, on the road below the near horizon
         where nothing else is drawn: the reclassified count large, its share,
         the still-unmatched count, the lane's detections */
      ctx.textAlign = "center";
      for (const [name, ch, x0, x1] of lanes) {
        const inside = ch.within_2m_of_excluded_annotation, beyond = ch.flagged_as_ghost_by_cache - inside;
        const cx = (x0 + x1) / 2;
        let y = near + (mobile ? 16 : 24);
        ctx.fillStyle = `rgba(${OK},1)`; ctx.font = `600 ${mobile ? 15 : 21}px ${MONO}`;
        ctx.fillText(int(inside), cx, y); y += mobile ? 11 : 13;
        ctx.fillStyle = `rgba(${OK},0.9)`; ctx.font = `${fs}px ${MONO}`;
        ctx.fillText(mobile ? `${name} · ${pct(ch.fraction_of_original_ghost_flags_reclassified)}` : `of ${int(ch.flagged_as_ghost_by_cache)} flags · ${pct(ch.fraction_of_original_ghost_flags_reclassified)} came inside`, cx, y); y += fs + 4;
        if (!mobile) {
          ctx.fillStyle = `rgba(${INK},0.72)`;
          ctx.fillText(`${int(beyond)} still unmatched`, cx, y); y += fs + 4;
          ctx.fillStyle = `rgba(${INK},0.5)`;
          ctx.fillText(`${name} · ${int(ch.detections_at_0_30)} detections`, cx, y);
        }
      }
      drawCabin(ctx, w, h, dark, pillarW, dash);
      /* the legend, on the glass, stacked at the left above the ring field */
      if (!mobile) {
        ctx.textAlign = "left"; ctx.font = `${fs}px ${MONO}`;
        const lx = pillarW + 10;
        const line = (y: number, dashPattern: number[], stroke: string, text: string, ink: string) => {
          ctx.strokeStyle = stroke; ctx.setLineDash(dashPattern); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, y - 3.5); ctx.lineTo(lx + 16, y - 3.5); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = ink; ctx.fillText(text, lx + 22, y);
        };
        line(19, [4, 3], `rgba(${RED},0.9)`, "near · the filtered cache the ghost label was measured against", `rgba(${RED},0.9)`);
        line(33, [3, 5], `rgba(${INK},0.45)`, "far · the complete annotation table · still not physical truth", `rgba(${INK},0.7)`);
        ctx.fillStyle = `rgba(${OK},0.85)`; ctx.beginPath(); ctx.arc(lx + 8, 43.5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${OK},0.85)`; ctx.fillText("between the horizons · within 2 m of an annotation the cache excluded · came inside", lx + 22, 47);
        ctx.strokeStyle = `rgba(${INK},0.5)`; ctx.beginPath(); ctx.arc(lx + 8, 57.5, 2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(${INK},0.5)`; ctx.fillText("beyond the far horizon · still unmatched · no reference here certifies nonexistence", lx + 22, 61);
      }
      setReady(true);
    });
    return () => { alive = false; };
  }, [w, h, ao, dark]);
  return <canvas ref={ref} className="wscene" data-ready={String(ready)} style={{ width: w, height: h }} aria-label="Two horizons: the filtered reference cache near, the complete annotation table far; reclassified detections as lights between them, unmatched detections hollow beyond" />;
}

export function Reference() {
  const state = useSurfaceState(async () => {
    const lane = await fetchLane();
    if (!lane.present) return { lane, d: null };
    const [ao, sel, rdy, frz, R] = await Promise.all([
      fetchLaneJson<unknown>(F.AO).catch(() => null),
      fetchLaneJson<Sel>(F.SEL).catch(() => null),
      fetchLaneJson<Rdy>(F.RDY).catch(() => null),
      fetchLaneJson<Frz>(F.FRZ).catch(() => null),
      registerPath().then((p) => fetchLaneText(p)).catch(() => null),
    ]);
    return {
      lane,
      d: {
        ao: ao && isAO(ao.data) ? { data: ao.data, file: ao.file } : null,
        sel: sel && sel.data?.groups ? sel : null,
        rdy: rdy && rdy.data?.estimates ? rdy : null,
        frz: frz && typeof frz.data?.independent_judgments_collected === "number" ? frz : null,
        reg: R ? { ...parseRegister(R.text), file: R.file } : null,
      },
    };
  });
  const box = useBox(state.phase);
  if (state.phase === "loading") return <Station id="ST–17" name="The Reference"><div className="note" data-loading="true">reading the reference audit…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–17" name="The Reference"><Blocked reason={state.reason} /></Station>;
  const { lane, d } = state.data;
  if (!lane.present || !d) return <Station id="ST–17" name="The Reference"><Blocked reason={`the Gate B lane is not present in this source: ${lane.reason ?? "unknown"}`} /></Station>;
  if (!d.ao) return <Station id="ST–17" name="The Reference"><Blocked reason="Result AO (evidence/measurement/result_ao.json) is not present in the sealed lane or not in its known shape; the sealed lane may predate the reference audit" /></Station>;

  const ao = d.ao.data;
  const cam = ao.ghost_reference_population.camera, lid = ao.ghost_reference_population.lidar;
  const sc = ao.scene_clustering;
  const tf = ao.temporal_null_sensitivity.filtered_cache.fixed_heading_support, ta = ao.temporal_null_sensitivity.full_annotations.fixed_heading_support;
  const judgments = d.frz?.data.independent_judgments_collected ?? d.sel?.data.independent_judgments ?? null;
  const claim = (re: RegExp) => d.reg?.claims.find((c) => re.test(c.claim_id)) ?? null;
  const cRef = claim(/reference-error-identification/), cGhost = claim(/ghost-coincidence$/), cAO = claim(/reference-population-audit/);
  const AOS = [src(d.ao.file)];

  return (
    <Station id="ST–17" name="The Reference" sub="the audit of the reference itself · exploratory · physical truth unresolved">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="camera flags reclassified" value={pct(cam.fraction_of_original_ghost_flags_reclassified)} sub={`${int(cam.within_2m_of_excluded_annotation)} of ${int(cam.flagged_as_ghost_by_cache)} · within 2 m of an annotation the cache excluded`}
            rule="Result AO: camera detections at score 0.30 flagged as ghosts against the class-and-range filtered cache, and how many of those stand within two metres of an annotation present in the complete table but excluded from the cache; a label change under the same distance rule, not a verified correct detection" from={AOS} />
          <Stat label="lidar flags reclassified" value={pct(lid.fraction_of_original_ghost_flags_reclassified)} sub={`${int(lid.within_2m_of_excluded_annotation)} of ${int(lid.flagged_as_ghost_by_cache)} · same rule, lidar channel`}
            rule="Result AO: the lidar channel's historical ghost flags against the filtered cache, and how many stand within two metres of an excluded annotation" from={AOS} />
          <Stat label="conditional c · scene-clustered" value={fmt(sc.conditional_ratio)} sub={`[${fmt(sc.scene_bootstrap_percentile_95[0])}, ${fmt(sc.scene_bootstrap_percentile_95[1])}] · ${int(sc.scenes)} scenes as units · ${int(sc.replicates)} replicates`}
            rule="Result AO re-estimates the conditional camera-lidar coincident-miss ratio on the fixed deepest-stratum support (131,722 rows), resampling whole scenes rather than tracked instances; the descriptive association survives, its interval widens" from={AOS} />
          <Stat label="temporal null · complete annotations" value={<>{fmt(ta.ego_relative_ratio, 2)}<em> ego-relative</em></>} small sub={`world-fixed ${fmt(ta.world_fixed_ratio, 2)} [${fmt(ta.world_fixed_scene_bootstrap_percentile_95[0], 2)}, ${fmt(ta.world_fixed_scene_bootstrap_percentile_95[1], 2)}] · filtered cache gave ${fmt(tf.ego_relative_ratio, 2)} and ${fmt(tf.world_fixed_ratio, 2)} · two nulls, two questions`}
            rule="Result AO's coincidence of unmatched camera and lidar detections against two temporal nulls on the complete annotation reference: relocating donor detections ego-relatively, and comparing world-fixed positions; the filtered-cache values are shown beside them; more reference annotations reduced both numerator and denominator, so a contaminated ratio is not automatically an upper bound" from={AOS} />
          <Stat label="independent judgments" value={judgments === null ? "∅" : int(judgments)} sub={d.sel ? `${int(d.sel.data.selected_cases)} cases prepared across ${int(d.sel.data.sampled_scenes)} of ${int(d.sel.data.population_scenes)} scenes · every stratum's support [0, 1]` : "study aggregate absent"}
            rule="the frozen reference-adjudication study (protocol 0.2.0): a probability sample of 60 detections in each of four reference strata; the count of independent blinded human judgments collected so far, read from the freeze record; until it is nonzero every physical-performance estimate is null and every confidence set is [0, 1]" from={[...(d.frz ? [src(d.frz.file)] : []), ...(d.sel ? [src(d.sel.file)] : [])]} />
        </div>

        <div className="refgrid">
          <div className="ipanel wgpanel">
            <div className="ilabel">the two horizons · near: the filtered cache the ghost label was measured against · far: the complete annotation table · filled lights came inside when the horizon moved · hollow stays unresolved</div>
            <div className="mbox" ref={box.ref}>{box.w > 0 && <HorizonScene w={box.w} h={box.h} ao={ao} />}</div>
          </div>
          <div className="ipanel wgpanel">
            <div className="ilabel">the prepared study · four reference strata · sixty cases each · the bracket is the confidence set, full width until judgments arrive</div>
            <div className="refstrata">
              {STRATA.map(([k, label]) => {
                const g = d.sel?.data.groups[k], e = d.rdy?.data.estimates[k];
                const lo = e?.confidence_set?.[0] ?? 0, hi = e?.confidence_set?.[1] ?? 1;
                return (
                  <div key={k} className="refrow">
                    <span className="refk">{label}</span>
                    <span className="refn">{g ? <>{int(g.population_n)}<em> in the population · {int(g.selected_n)} sampled · {int(g.scenes_represented)} scenes</em></> : "∅"}</span>
                    <span className="refband" aria-label={`support confidence set ${lo} to ${hi}`}>
                      <i className="refset" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} data-full={String(hi - lo >= 0.999)} />
                      <b className="reftick" style={{ left: "0%" }}>0</b><b className="reftick" style={{ left: "100%" }}>1</b>
                    </span>
                    <span className="refj">{e ? `${int(e.resolved_n)} resolved · ${int(e.unresolved_or_unreviewed_n)} awaiting · ${e.state.replace(/_/g, " ")}` : "∅"}</span>
                  </div>
                );
              })}
            </div>
            <div className="refreg">
              {[["reference error identification", cRef], ["ghost coincidence", cGhost], ["reference population audit", cAO]].map(([k, c]) => (
                <span key={String(k)} className="regchip" data-status={(c as any)?.status ?? "absent"} data-use={(c as any)?.current_scientific_use ?? ""}>{String(k)} <b>{(c as any)?.status ?? "no entry"}</b>{(c as any)?.current_scientific_use ? <i>{(c as any).current_scientific_use}</i> : null}</span>
              ))}
              {d.reg && <span className="regchip" data-status="register">register <b>{d.reg.version}</b><i>{d.reg.createdOn}</i></span>}
            </div>
          </div>
        </div>

        <div className="mnon">
          {ao.nonclaims.join(" · ")} · a nearby annotation can be another object · centre distance is not object extent · the physical ghost interpretation is withdrawn as stated · {ao.lifecycle_status} · <Digest id={AOS[0].id} sha={AOS[0].sha256} path={AOS[0].path} />
          {d.rdy && <> · <Digest id={src(d.rdy.file).id} sha={src(d.rdy.file).sha256} path={src(d.rdy.file).path} /></>}
        </div>
      </div>
    </Station>
  );
}
