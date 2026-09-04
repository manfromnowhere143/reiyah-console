/* ST-08 · FRONTIER — THE HORIZON. Every discovery pointer in the register is
   a hollow ring standing on the horizon line, in the column of its source
   kind. Hollow because that is what it is: a pointer with no retained bytes.
   A filled ring would mean evidence-eligible; today there are none, and the
   zero is the discipline. A slow cursor reads each pointer; hover or touch
   takes it. The rings size themselves to the screen. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchCatalog, fetchSurface, fetchSurfaceByPath } from "../lib/evidence";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const ev = (x: any) => (x && typeof x === "object" && "state" in x ? (x.state === "observed" ? String(x.value) : `∅ ${x.state}`) : String(x ?? ""));

export function Frontier() {
  const state = useSurfaceState(() => fetchSurface<any>("frontier"));
  const xw = useSurfaceState(async () => {
    const cat = await fetchCatalog();
    const p = cat.map((c) => c.path).filter((x) => /standards-crosswalk-\d/.test(x)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
    if (!p) return null;
    const s = await fetchSurfaceByPath<any>(p);
    return s.state === "observed" ? { path: p, sha256: s.meta.sha256, d: s.data } : null;
  });
  const X = xw.phase === "ready" && xw.data ? xw.data : null;
  const xEntries: any[] = X?.d?.entries ?? [];
  const fieldRef = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState(10);
  const [cur, setCur] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const records: any[] = state.phase === "ready" && state.data.state === "observed" ? state.data.data.records ?? [] : [];
  const kinds = new Map<string, any[]>();
  for (const r of records) kinds.set(r.source_kind, [...(kinds.get(r.source_kind) ?? []), r]);
  const columns = [...kinds.entries()].sort((a, b) => b[1].length - a[1].length);
  const ordered = columns.flatMap(([, rs]) => rs);
  const index = new Map(ordered.map((r, i) => [r.discovery_id, i]));
  const maxCol = columns[0]?.[1].length ?? 1;

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el || columns.length === 0) return;
    const fit = () => {
      const H = el.clientHeight - 6, W = el.clientWidth - 12, labelH = 30, gap = 3;
      const byH = Math.floor((H - labelH) / maxCol) - gap;
      const byW = Math.floor(W / columns.length) - 8;
      setRing(Math.max(5, Math.min(14, byH, byW)));
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length, maxCol]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || hover !== null || ordered.length === 0) return;
    const t = setInterval(() => setCur((c) => (c + 1) % ordered.length), 1300);
    return () => clearInterval(t);
  }, [hover, ordered.length]);

  if (state.phase === "loading") return <Station id="ST–08" name="Frontier"><div className="note">reading discovery register…</div></Station>;
  if (state.phase === "blocked" || state.data.state !== "observed")
    return <Station id="ST–08" name="Frontier"><Blocked reason={state.phase === "blocked" ? state.reason : (state.data as any).reason} /></Station>;

  const meta = state.data.meta;
  const reg = state.data.data;
  const eligible = records.filter((r) => String(r.evidence_eligibility ?? "").startsWith("eligible")).length;
  const at = ordered[hover ?? cur];
  const FR = [{ id: "frontier", path: meta.path, sha256: meta.sha256 }];

  return (
    <Station id="ST–08" name="Frontier" sub={`register ${reg.version ?? ""} · ${records.length} pointers · ${eligible} evidence-eligible`}>
      <div className="onepage">
        <div className="statstrip">
          <Stat label="discovery pointers" value={records.length} sub={`${columns.length} source kinds · append-only`}
            rule="count of records in the frontier discovery register; source kinds are the distinct source_kind values" from={FR} />
          <Stat label="evidence-eligible" value={eligible} sub="a URL without retained bytes is not evidence · the zero is the discipline"
            rule="count of records whose evidence_eligibility begins with eligible; every record today is ineligible_pointer_only" from={FR} />
          <Stat label="claims admitted" value={reg.scientific_support_claimed ? "SUPPORT" : "NONE"} small sub={`safety ${String(!!reg.safety_claimed).toUpperCase()} · compliance ${String(!!reg.compliance_claimed).toUpperCase()} · superiority ${String(!!reg.comparative_superiority_claimed).toUpperCase()}`}
            rule="the register's own scientific_support_claimed, safety_claimed, compliance_claimed and comparative_superiority_claimed fields, read verbatim" from={FR} />
          <Stat label="register digest" wide rule="SHA-256 of the register bytes as recorded in the evidence index; press the chip to recompute it here" from={FR}>
            <div style={{ marginTop: "0.28rem" }}><Digest id="frontier" sha={meta.sha256} path={meta.path} /></div>
          </Stat>
        </div>

        <div className="horizonwrap">
          <div className="ilabel">the horizon · hollow = pointer only, no retained bytes · filled = evidence-eligible ({eligible})</div>
          <div className="horizon" ref={fieldRef} style={{ ["--ring" as any]: `${ring}px` }} onPointerLeave={() => setHover(null)}>
            {columns.map(([kind, rs]) => (
              <div key={kind} className="hcol">
                <div className="hstack">
                  {rs.map((r) => {
                    const i = index.get(r.discovery_id)!;
                    return (
                      <i key={r.discovery_id} className="hring"
                        data-filled={String(String(r.evidence_eligibility ?? "").startsWith("eligible"))}
                        data-cur={String(i === (hover ?? cur))}
                        onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} title={r.title} />
                    );
                  })}
                </div>
                <div className="hlabel"><b>{rs.length}</b><span>{kind.replace(/^official_/, "").replace(/_/g, " ")}</span></div>
              </div>
            ))}
          </div>
          {X && (
            <div className="xwalk">
              <span className="subrailk">standards crosswalk · {xEntries.length} mappings · evidence and gaps only · compliance claimed {String(!!X.d.compliance_claimed).toUpperCase()}</span>
              <div className="xrail">
                {xEntries.map((e) => (
                  <span key={e.mapping_id} className="xnode" data-state={String(e.mapping_state)} title={`${ev(e.external_reference?.title)} · ${String(e.mapping_state).replace(/_/g, " ")}`}>
                    <i /><b>{ev(e.external_reference?.document_identifier)}</b><span>{String(e.mapping_state).replace(/_/g, " ")}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="wallcap" aria-live="polite">
            <span className="wcidx">{(hover ?? cur) + 1} / {ordered.length}</span>
            <span className="wcpath">{at?.title} · {ev(at?.publisher)} · {ev(at?.publication_date)}</span>
            <span className="wcrule">{String(at?.source_kind ?? "").replace(/_/g, " ")} · {String(at?.custody_state ?? "").replace(/_/g, " ")} · {String(at?.evidence_eligibility ?? "").replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>
    </Station>
  );
}
