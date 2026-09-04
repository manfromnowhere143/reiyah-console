/* ST-10 · THE CONTRACT — the layer beneath every station. Every schema the
   engine enforces, digest-bound, as one lattice: filled = closed to unknown
   properties, hollow = open. The adversarial coverage of the application
   schemas: how many known-bad and known-good fixtures aim at each. The
   scientific contract profile's production rules and closure policy. And the
   wall of what is not claimed, read from the bytes that say so. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchSchemaIndex, fetchSurface, fetchSurfaceByPath, type SchemaRow } from "../lib/evidence";
import { getAt, setAt } from "../lib/urlstate";
import { Blocked, FitList, Stat, Station, useSurfaceState } from "../components/primitives";

const short = (s: unknown) => String(s ?? "").replace(/_/g, " ");

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

  const latRef = useRef<HTMLDivElement>(null);
  const [cs, setCs] = useState(10);
  const [cur, setCur] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [seeded, setSeeded] = useState(false);
  const rows: SchemaRow[] = state.phase === "ready" ? [...state.data.rows].sort((a, b) => a.family.localeCompare(b.family) || String(a.version).localeCompare(String(b.version), undefined, { numeric: true })) : [];

  useLayoutEffect(() => {
    const el = latRef.current;
    if (!el || rows.length === 0) return;
    const fit = () => {
      const W = el.clientWidth - 10, H = el.clientHeight - 10, gap = 3, n = rows.length;
      let s = 4;
      for (let t = 44; t >= 4; t--) {
        const cols = Math.floor((W + gap) / (t + gap)), r = Math.floor((H + gap) / (t + gap));
        if (cols * r >= n) { s = t; break; }
      }
      setCs(s);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length]);
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

  if (state.phase === "loading") return <Station id="ST–10" name="The Contract"><div className="note">reading the contract layer…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–10" name="The Contract"><Blocked reason={state.reason} /></Station>;

  const { fixtures, profile, register, mission, SRC } = state.data;
  const families = new Set(rows.map((r) => r.family)).size;
  const closed = rows.filter((r) => r.additional_properties_closed).length;
  const dialects = new Set(rows.map((r) => r.dialect).filter(Boolean)).size;
  const at = rows[hover ?? cur];

  /* adversarial coverage per application schema */
  const cov = new Map<string, { bad: number; good: number }>();
  for (const f of fixtures) {
    const t = f.target_schema_id; if (!t) continue;
    const k = String(t).split("/").pop()!.replace(".schema.json", "");
    const c = cov.get(k) ?? { bad: 0, good: 0 };
    if (f.classification === "known_bad") c.bad++; else c.good++;
    cov.set(k, c);
  }
  const coverage = [...cov.entries()].sort((a, b) => (b[1].bad + b[1].good) - (a[1].bad + a[1].good));
  const maxCov = coverage[0] ? coverage[0][1].bad + coverage[0][1].good : 1;
  const targeted = fixtures.filter((f: any) => f.target_schema_id).length;

  /* the wall of what is not claimed, from the register and the mission */
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
            <div className="ilabel">the schema lattice · {rows.length} schemas by family · filled = closed to unknown properties · hollow = open</div>
            <div className="lattice" ref={latRef} style={{ ["--cs" as any]: `${cs}px` }} onPointerLeave={() => setHover(null)}>
              {rows.map((r, i) => (
                <i key={r.path} className="lcell" data-closed={String(r.additional_properties_closed)} data-cur={String(i === (hover ?? cur))}
                  onPointerEnter={() => pick(i)} onPointerDown={() => pick(i)} title={r.path} />
              ))}
            </div>
            <div className="wallcap" aria-live="polite">
              <span className="wcidx">{(hover ?? cur) + 1} / {rows.length}</span>
              <span className="wcpath">{at?.path}</span>
              <span className="wcrule">{at ? `${at.property_count ?? "∅"} properties · ${at.required_count ?? "∅"} required · ${at.additional_properties_closed ? "closed" : "open"} · ${at.sha256.slice(7, 19)}` : ""}</span>
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
