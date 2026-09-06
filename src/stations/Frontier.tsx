/* ST-08 · FRONTIER — THE HORIZON. The sealed field ends at the horizon.
   Beyond it, every discovery pointer in the register is a distant light:
   a hollow ring standing on the horizon line, in the column of its source
   kind, reflected on the wet road. Hollow because that is what it is: a
   pointer with no retained bytes. A filled ring would mean evidence
   eligible; today there are none, and the zero is the discipline. A slow
   cursor reads each pointer; hover or touch takes it. Canvas in measured
   pixels, redrawn only when the cursor or the size or the ground changes. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchCatalog, fetchSurface, fetchSurfaceByPath } from "../lib/evidence";
import { MONO, drawCabin, drawWorld, tones } from "../lib/roadScene";
import { useGround } from "../lib/ground";
import { getAt, setAt } from "../lib/urlstate";
import { Blocked, Digest, Stat, Station, useSurfaceState } from "../components/primitives";

const ev = (x: any) => (x && typeof x === "object" && "state" in x ? (x.state === "observed" ? String(x.value) : `∅ ${x.state}`) : String(x ?? ""));

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

interface Light { i: number; x: number; y: number; r: number; filled: boolean; kind: string }

function HorizonScene({ w, h, columns, current, onPick, onLeave }: { w: number; h: number; columns: Array<[string, any[]]>; current: number; onPick: (i: number) => void; onLeave: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lights = useRef<Light[]>([]);
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
      const { INK, OK } = tones(dark);
      const mobile = w < 560;
      const pillarW = mobile ? w * 0.035 : w * 0.05;
      const labelH = mobile ? 16 : 30;
      const horizon = Math.round(h * 0.6) + 0.5;
      drawWorld(ctx, { w, h, dark, horizon, headlight: false, dashes: 6 });
      /* the columns: one per source kind, largest first; rings stack upward */
      const n = columns.length, inner = w - pillarW * 2 - 12, colW = inner / n;
      const maxCol = Math.max(1, ...columns.map(([, rs]) => rs.length));
      const gap = 3;
      const r = Math.max(3, Math.min(11, Math.floor((horizon - 14 - maxCol * gap) / maxCol / 2), Math.floor((colW - 6) / 2)));
      const out: Light[] = []; let idx = 0;
      columns.forEach(([kind, rs], c) => {
        const x = pillarW + 6 + colW * (c + 0.5);
        rs.forEach((rec, k) => {
          const y = horizon - 2 - r - k * (2 * r + gap);
          out.push({ i: idx++, x, y, r, filled: String(rec.evidence_eligibility ?? "").startsWith("eligible"), kind });
        });
      });
      lights.current = out;
      /* reflections first, then the lights */
      for (const l of out) {
        const rh = Math.min(h - horizon - labelH - 4, (horizon - l.y) * 0.5 + 10);
        const g = ctx.createLinearGradient(0, horizon, 0, horizon + rh);
        g.addColorStop(0, `rgba(${OK},${l.i === current ? 0.35 : 0.1})`); g.addColorStop(1, `rgba(${OK},0)`);
        ctx.fillStyle = g; ctx.fillRect(l.x - r * 0.5, horizon, r, rh);
      }
      for (const l of out) {
        const cur = l.i === current;
        if (cur) { const halo = ctx.createRadialGradient(l.x, l.y, r, l.x, l.y, r * 4); halo.addColorStop(0, `rgba(${OK},0.35)`); halo.addColorStop(1, `rgba(${OK},0)`); ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(l.x, l.y, r * 4, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.arc(l.x, l.y, cur ? r + 1 : r, 0, Math.PI * 2);
        if (l.filled) { ctx.fillStyle = `rgba(${OK},1)`; ctx.fill(); }
        else { ctx.strokeStyle = cur ? `rgba(${INK},1)` : `rgba(${OK},0.85)`; ctx.lineWidth = cur ? 1.6 : 1.1; ctx.stroke(); }
      }
      /* the edge of the sealed field */
      ctx.font = `${mobile ? 7 : 8}px ${MONO}`; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = `rgba(${INK},0.6)`;
      if (!mobile) ctx.fillText("the sealed field ends here · beyond: pointers, no retained bytes", w - pillarW - 10, horizon + 14);
      /* the kind labels on the road, under each column */
      ctx.textAlign = "center";
      columns.forEach(([kind, rs], c) => {
        const x = pillarW + 6 + colW * (c + 0.5);
        ctx.fillStyle = `rgba(${INK},0.95)`; ctx.font = `600 ${mobile ? 8 : 9}px ${MONO}`;
        ctx.fillText(String(rs.length), x, h - labelH + (mobile ? 10 : 9));
        if (!mobile) {
          ctx.font = `6.5px ${MONO}`; ctx.fillStyle = `rgba(${INK},0.6)`;
          const words = kind.replace(/^official_/, "").split("_");
          const lines: string[] = []; let line = "";
          for (const wd of words) { const t = line ? `${line} ${wd}` : wd; if (ctx.measureText(t).width > colW - 4 && line) { lines.push(line); line = wd; } else line = t; }
          if (line) lines.push(line);
          lines.slice(0, 2).forEach((ln, k) => ctx.fillText(ln.toUpperCase(), x, h - labelH + 18 + k * 8));
        }
      });
      drawCabin(ctx, w, h, dark, pillarW, 0);
      setReady(true);
    });
    return () => { alive = false; };
  }, [w, h, columns, current, dark]);
  const near = (e: React.PointerEvent) => {
    const rct = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect(); const x = e.clientX - rct.left, y = e.clientY - rct.top;
    let best: Light | null = null, bd = 144;
    for (const l of lights.current) { const d = (l.x - x) ** 2 + (l.y - y) ** 2; if (d < bd) { bd = d; best = l; } }
    return best;
  };
  return <canvas ref={ref} className="wscene" data-ready={String(ready)} style={{ width: w, height: h }}
    onPointerMove={(e) => { const l = near(e); if (l) onPick(l.i); }} onPointerDown={(e) => { const l = near(e); if (l) onPick(l.i); }} onPointerLeave={onLeave}
    aria-label="Discovery pointers as hollow lights on the horizon, one column per source kind" />;
}

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
  const box = useBox(state.phase);
  const [cur, setCur] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [seeded, setSeeded] = useState(false);

  const records: any[] = state.phase === "ready" && state.data.state === "observed" ? state.data.data.records ?? [] : [];
  const kinds = new Map<string, any[]>();
  for (const r of records) kinds.set(r.source_kind, [...(kinds.get(r.source_kind) ?? []), r]);
  const columns = [...kinds.entries()].sort((a, b) => b[1].length - a[1].length);
  const ordered = columns.flatMap(([, rs]) => rs);

  useEffect(() => {
    if (seeded || ordered.length === 0) return;
    setSeeded(true);
    const a = getAt(); const i = a ? ordered.findIndex((r) => r.discovery_id === a) : -1;
    if (i >= 0) { setCur(i); setHover(i); }
  }, [ordered.length, seeded]);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || hover !== null || ordered.length === 0) return;
    const t = setInterval(() => setCur((c) => (c + 1) % ordered.length), 1300);
    return () => clearInterval(t);
  }, [hover, ordered.length]);
  const pick = (i: number) => { setHover(i); setAt(ordered[i]?.discovery_id ?? null); };

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
          <div className="ipanel wspanel wshero frhero">
            <div className="mbox" ref={box.ref}>
              {box.w > 0 && columns.length > 0 && <HorizonScene w={box.w} h={box.h} columns={columns} current={hover ?? cur} onPick={pick} onLeave={() => setHover(null)} />}
            </div>
          </div>
          <div className="wallcap" aria-live="polite">
            <span className="wcidx">{(hover ?? cur) + 1} / {ordered.length}</span>
            <span className="wcpath">{at?.title} · {ev(at?.publisher)} · {ev(at?.publication_date)}</span>
            <span className="wcrule">{String(at?.source_kind ?? "").replace(/_/g, " ")} · {String(at?.custody_state ?? "").replace(/_/g, " ")} · {String(at?.evidence_eligibility ?? "").replace(/_/g, " ")}</span>
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
        </div>
      </div>
    </Station>
  );
}
