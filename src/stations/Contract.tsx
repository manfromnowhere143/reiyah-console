/* ST-10 · THE CONTRACT — THE VAULT. Every schema the engine enforces is one
   segment of a single ring, digest-bound, family beside family: filled when
   closed to unknown properties, hollow when open. Around the rim, the
   adversarial fixtures aimed at each schema: red ticks for known-bad,
   ink for known-good, stacked outward at the segment they target, so the
   ring shows where the contract is under fire and where nothing has been
   thrown at it yet. The wall of what is not claimed is read from the bytes
   that say so. Canvas in measured pixels; redrawn only on change. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchSchemaIndex, fetchSurface, fetchSurfaceByPath, type SchemaRow } from "../lib/evidence";
import { MONO, tones } from "../lib/roadScene";
import { useGround } from "../lib/ground";
import { getAt, setAt } from "../lib/urlstate";
import { Blocked, FitList, Stat, Station, useSurfaceState } from "../components/primitives";

const short = (s: unknown) => String(s ?? "").replace(/_/g, " ");
const TAU = Math.PI * 2;

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

interface Geo { cx: number; cy: number; r0: number; r1: number; a0: number[]; a1: number[] }

function VaultScene({ w, h, rows, cov, current, families, onPick, onLeave }: { w: number; h: number; rows: SchemaRow[]; cov: Map<string, { bad: number; good: number }>; current: number; families: number; onPick: (i: number) => void; onLeave: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const geo = useRef<Geo | null>(null);
  const dark = useGround();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const cv = ref.current; if (!cv || w === 0 || h === 0 || !rows.length) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const { INK, OK, RED } = tones(dark);
      const mobile = w < 560;
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) / 2 - (mobile ? 10 : 16);
      const r1 = R * 0.72, r0 = R * 0.56;           /* the ring of schemas */
      const n = rows.length, famGap = 0.0035, segGap = 0.0012;
      /* angles: families contiguous, a hair of space between families */
      const a0: number[] = [], a1: number[] = [];
      let fams = 0; for (let i = 1; i < n; i++) if (rows[i].family !== rows[i - 1].family) fams++;
      const span = TAU - fams * famGap - n * segGap;
      let a = -Math.PI / 2;
      for (let i = 0; i < n; i++) {
        if (i > 0 && rows[i].family !== rows[i - 1].family) a += famGap;
        a0.push(a); a += span / n; a1.push(a); a += segGap;
      }
      geo.current = { cx, cy, r0, r1, a0, a1 };
      /* the vault's glow */
      const g = ctx.createRadialGradient(cx, cy, r0 * 0.6, cx, cy, R * 1.05);
      g.addColorStop(0, `rgba(${OK},0)`); g.addColorStop(0.55, `rgba(${OK},${dark ? 0.07 : 0.05})`); g.addColorStop(1, `rgba(${OK},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, TAU); ctx.fill();
      /* the segments */
      rows.forEach((row, i) => {
        const cur = i === current;
        ctx.beginPath(); ctx.arc(cx, cy, r1, a0[i], a1[i]); ctx.arc(cx, cy, r0, a1[i], a0[i], true); ctx.closePath();
        if (row.additional_properties_closed) { ctx.fillStyle = cur ? `rgba(${INK},1)` : `rgba(${INK},0.62)`; ctx.fill(); }
        else { ctx.strokeStyle = cur ? `rgba(${INK},1)` : `rgba(${INK},0.5)`; ctx.lineWidth = cur ? 1.6 : 0.8; ctx.stroke(); }
        if (cur) { ctx.strokeStyle = `rgba(${OK},1)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r1 + 3, a0[i], a1[i]); ctx.stroke(); }
      });
      /* the fixtures thrown at each family: ticks stacked outward */
      const tick = 2.6, step = 3.2, cap = Math.floor((R - r1 - 8) / step);
      const byFam = new Map<string, number[]>();
      rows.forEach((row, i) => byFam.set(row.family, [...(byFam.get(row.family) ?? []), i]));
      for (const [fam, idxs] of byFam) {
        const c = cov.get(fam); if (!c) continue;
        const mid = (a0[idxs[0]] + a1[idxs[idxs.length - 1]]) / 2;
        const total = c.bad + c.good, shown = Math.min(total, cap);
        for (let k = 0; k < shown; k++) {
          const bad = k < Math.round((c.bad / total) * shown);
          const rr = r1 + 8 + k * step;
          ctx.strokeStyle = bad ? `rgba(${RED},0.9)` : `rgba(${INK},0.7)`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(mid) * rr, cy + Math.sin(mid) * rr); ctx.lineTo(cx + Math.cos(mid) * (rr + tick), cy + Math.sin(mid) * (rr + tick)); ctx.stroke();
        }
        const rr = r1 + 8 + shown * step + 6;
        ctx.font = `${mobile ? 7 : 8}px ${MONO}`; ctx.fillStyle = `rgba(${INK},0.85)`;
        ctx.textAlign = Math.cos(mid) >= 0 ? "left" : "right"; ctx.textBaseline = "middle";
        ctx.fillText(`${c.bad}+${c.good}`, cx + Math.cos(mid) * rr, cy + Math.sin(mid) * rr);
      }
      /* the centre: the count, and the closure it holds */
      const closed = rows.filter((r) => r.additional_properties_closed).length;
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = `rgba(${INK},1)`; ctx.font = `600 ${mobile ? 22 : 30}px ${MONO}`; ctx.fillText(String(n), cx, cy + (mobile ? 4 : 6));
      ctx.font = `${mobile ? 7 : 8}px ${MONO}`; ctx.fillStyle = `rgba(${INK},0.7)`;
      ctx.fillText(`SCHEMAS · ${families} FAMILIES`, cx, cy + (mobile ? 16 : 22));
      ctx.fillText(`${closed} CLOSED · ${n - closed} OPEN`, cx, cy + (mobile ? 26 : 34));
      setReady(true);
    });
    return () => { alive = false; };
  }, [w, h, rows, cov, current, families, dark]);
  const hit = (e: React.PointerEvent) => {
    const gg = geo.current; if (!gg) return -1;
    const rct = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect(); const x = e.clientX - rct.left - gg.cx, y = e.clientY - rct.top - gg.cy;
    const d = Math.hypot(x, y); if (d < gg.r0 * 0.85 || d > gg.r1 * 1.6) return -1;
    let a = Math.atan2(y, x); if (a < -Math.PI / 2) a += TAU;
    for (let i = 0; i < gg.a0.length; i++) if (a >= gg.a0[i] - 0.001 && a <= gg.a1[i] + 0.001) return i;
    return -1;
  };
  return <canvas ref={ref} className="wscene" data-ready={String(ready)} style={{ width: w, height: h }}
    onPointerMove={(e) => { const i = hit(e); if (i >= 0) onPick(i); }} onPointerDown={(e) => { const i = hit(e); if (i >= 0) onPick(i); }} onPointerLeave={onLeave}
    aria-label="Every schema as one segment of a ring, filled when closed to unknown properties; adversarial fixtures as ticks around the rim" />;
}

export function Contract() {
  const state = useSurfaceState(async () => {
    const [rows, fixtures, profile, register, mission] = await Promise.all([
      fetchSchemaIndex(),
      fetchSurface<any>("fixtures"),
      fetchSurfaceByPath<any>("manifests/scientific/harbor-scientific-contract-profile-1.2.0.json"),
      fetchSurface<any>("frontier"),
      fetchSurface<any>("mission"),
    ]);
    const src = (s: any, id?: string) => (s.state === "observed" ? [{ id: id ?? s.meta.id, path: s.meta.path, sha256: s.meta.sha256 }] : []);
    return {
      rows,
      fixtures: fixtures.state === "observed" ? (fixtures.data.fixtures ?? []) : [],
      profile: profile.state === "observed" ? profile.data : null,
      register: register.state === "observed" ? register.data : null,
      mission: mission.state === "observed" ? mission.data : null,
      SRC: { fixtures: src(fixtures, "fixtures"), profile: src(profile), register: src(register, "frontier") },
    };
  });

  const box = useBox(state.phase);
  const [cur, setCur] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [seeded, setSeeded] = useState(false);
  const rows: SchemaRow[] = state.phase === "ready" ? [...state.data.rows].sort((a, b) => a.family.localeCompare(b.family) || String(a.version).localeCompare(String(b.version), undefined, { numeric: true })) : [];

  useEffect(() => {
    if (seeded || rows.length === 0) return;
    setSeeded(true);
    const a = getAt(); const i = a ? rows.findIndex((r) => r.path === a) : -1;
    if (i >= 0) { setCur(i); setHover(i); }
  }, [rows.length, seeded]);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || hover !== null || rows.length === 0) return;
    const t = setInterval(() => setCur((c) => (c + 1) % rows.length), 1000);
    return () => clearInterval(t);
  }, [hover, rows.length]);
  const pick = (i: number) => { setHover(i); setAt(rows[i]?.path ?? null); };

  if (state.phase === "loading") return <Station id="ST–10" name="The Contract"><div className="note" data-loading="true">reading the contract layer…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–10" name="The Contract"><Blocked reason={state.reason} /></Station>;

  const { fixtures, profile, register, mission, SRC } = state.data;
  const families = new Set(rows.map((r) => r.family)).size;
  const closed = rows.filter((r) => r.additional_properties_closed).length;
  const dialects = new Set(rows.map((r) => r.dialect).filter(Boolean)).size;
  const at = rows[hover ?? cur];

  /* adversarial coverage per application schema family */
  const cov = new Map<string, { bad: number; good: number }>();
  const byId = new Map(rows.filter((r) => r.id).map((r) => [String(r.id), r]));
  for (const f of fixtures) {
    const t = f.target_schema_id; if (!t) continue;
    /* the fixture names its target by $id; the family is the join when the id is the same schema at any version */
    const hit = byId.get(String(t));
    const k = hit ? hit.family : String(t).split("/").pop()!.replace(".schema.json", "");
    const c = cov.get(k) ?? { bad: 0, good: 0 };
    if (f.classification === "known_bad") c.bad++; else c.good++;
    cov.set(k, c);
  }
  const coverage = [...cov.entries()].sort((a, b) => (b[1].bad + b[1].good) - (a[1].bad + a[1].good));
  const maxCov = coverage[0] ? coverage[0][1].bad + coverage[0][1].good : 1;
  const targeted = fixtures.filter((f: any) => f.target_schema_id).length;

  const claims: Array<[string, boolean | null]> = register ? [
    ["scientific support", !!register.scientific_support_claimed],
    ["safety", !!register.safety_claimed],
    ["compliance", !!register.compliance_claimed],
    ["comparative superiority", !!register.comparative_superiority_claimed],
    ["claims admitted", !!register.claims_admitted],
    ["runtime execution", !!register.runtime_execution_authorized],
    ["gate B", !!register.gate_b_authorized],
    ["operator acceptance conferred", !!register.operator_acceptance_conferred],
    ["payload distribution", !!register.payload_distribution_authorized],
    ["pointer metadata distribution", !!register.pointer_metadata_distribution_authorized],
  ] : [];
  const rules: string[] = profile?.production_rule_ids ?? [];
  const closure: Array<[string, string]> = profile?.closure_policy ? Object.entries(profile.closure_policy).map(([k, v]) => [short(k), short(typeof v === "boolean" ? (v ? "required" : "not required") : v)]) : [];
  const atCov = at ? cov.get(at.family) : undefined;

  return (
    <Station id="ST–10" name="The Contract" sub="every schema digest-bound · coverage · what is not claimed">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="schemas" value={rows.length} sub={`${families} families · ${dialects} dialect${dialects === 1 ? "" : "s"} pinned`}
            rule="count of *.schema.json files under schemas/, each read and digested at seal or read time; families are the file names without version; dialects are the distinct $schema values" from={[]} />
          <Stat label="closed to unknowns" value={<>{closed}<em>/{rows.length}</em></>} sub="additionalProperties false"
            rule="count of schemas whose top-level additionalProperties is false, over all schemas" from={[]} />
          <Stat label="production rules" value={rules.length} sub="named rule ids a record can fail against"
            rule="length of production_rule_ids in the scientific contract profile" from={SRC.profile} />
          <Stat label="claims admitted" value={register ? (register.claims_admitted ? "YES" : "NONE") : "∅"} small sub="read from the register, not from prose"
            rule="the frontier register's claims_admitted field, read verbatim" from={SRC.register} />
        </div>

        <div className="grid2 fillgrid congrid">
          <div className="boardwrap conwrap">
            <div className="ipanel wspanel wshero vaulthero">
              <div className="mbox" ref={box.ref} onPointerLeave={() => setHover(null)}>
                {box.w > 0 && rows.length > 0 && <VaultScene w={box.w} h={box.h} rows={rows} cov={cov} current={hover ?? cur} families={families} onPick={pick} onLeave={() => setHover(null)} />}
              </div>
            </div>
            <div className="wallcap" aria-live="polite">
              <span className="wcidx">{(hover ?? cur) + 1} / {rows.length}</span>
              <span className="wcpath">{at?.path}</span>
              <span className="wcrule" data-c={atCov?.bad ? "bad" : undefined}>{at ? `${at.property_count ?? "∅"} properties · ${at.required_count ?? "∅"} required · ${at.additional_properties_closed ? "closed" : "open"} · ${atCov ? `${atCov.bad} known-bad + ${atCov.good} known-good aimed` : "nothing aimed at it yet"} · ${at.sha256.slice(7, 19)}` : ""}</span>
            </div>
            {mission && (
              <div className="thesis">
                <span className="thk">is</span><span className="thv">{String(mission.thesis?.is ?? "")}</span>
                <span className="thk">is not</span><span className="thv">{String(mission.thesis?.is_not ?? "")}</span>
              </div>
            )}
          </div>

          <div className="concol">
            <div className="ipanel fillpanel">
              <div className="ilabel">adversarial coverage · {targeted} fixtures aim at {coverage.length} application schemas</div>
              <FitList items={coverage} render={([k, c]) => (
                <div key={k} className="bar covbar">
                  <span className="bk">{k}</span>
                  <span className="bt covt">
                    <span className="bf covbad" style={{ width: `${(c.bad / maxCov) * 100}%` }} />
                    <span className="bf covgood" style={{ width: `${(c.good / maxCov) * 100}%` }} />
                  </span>
                  <span className="bn">{c.bad}<em>+{c.good}</em></span>
                </div>
              )} more={(k) => <>+ {k} more schemas under adversarial test</>} />
            </div>
            <div className="ipanel claimwall">
              <div className="ilabel">what is not claimed · every line from the register</div>
              <div className="claims">
                {claims.map(([k, v]) => (
                  <span key={k} className="claim" data-v={String(v)}><i>{v ? "◆" : "∅"}</i>{k}<b>{v ? "TRUE" : "FALSE"}</b></span>
                ))}
              </div>
              {closure.length > 0 && (
                <div className="closure">
                  <span className="clk">closure policy</span>
                  {closure.slice(0, 6).map(([k, v]) => <span key={k} className="clc" title={v}>{k}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Station>
  );
}
