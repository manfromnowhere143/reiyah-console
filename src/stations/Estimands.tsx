/* ST-05 · ESTIMANDS — a bank of dark dials. Every estimand the protocol
   defines is an instrument on this panel: its face is drawn, its scale is
   marked by the direction it will read in, and its needle does not exist yet.
   Nothing lights until a gate accepts retained evidence. The bank sizes its
   dials to the screen it is on, so it always fits and never scrolls. Touch a
   dial to read its contract. */
import { useLayoutEffect, useRef, useState } from "react";
import { fetchSurface } from "../lib/evidence";
import { Blocked, Stat, Station, useSurfaceState } from "../components/primitives";

const pretty = (sym: string) => sym
  .replace(/theta/g, "θ").replace(/tau/g, "τ").replace(/pi_1/g, "π₁").replace(/pi_0/g, "π₀").replace(/pi/g, "π")
  .replace(/alpha/g, "α").replace(/Omega/g, "Ω").replace(/Delta/g, "Δ");
const face = (sym: string) => pretty(sym).replace(/=.*$/, "");
const DIR: Record<string, [string, string]> = {
  lower_is_better: ["↓", "lower is better"],
  higher_is_better: ["↑", "higher is better"],
  signed_contrast: ["±", "signed contrast"],
  target_constraint: ["⊙", "target constraint"],
  vector_tradeoff: ["⬚", "vector trade-off"],
};
const TAU = Math.PI * 2;
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export function Estimands() {
  const state = useSurfaceState(() => fetchSurface<any>("protocol"));
  const bankRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState({ cols: 5, s: 120 });
  const [cur, setCur] = useState<number | null>(null);
  const estimands: any[] = state.phase === "ready" && state.data.state === "observed" ? state.data.data.estimands ?? [] : [];
  const n = estimands.length;

  useLayoutEffect(() => {
    const el = bankRef.current;
    if (!el || n === 0) return;
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight, gap = 10, labelH = 34;
      let best = { cols: 2, s: 40 };
      for (let cols = Math.min(n, 5); cols >= 2; cols--) {
        const rows = Math.ceil(n / cols);
        const s = Math.floor(Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows - labelH));
        if (s > best.s) best = { cols, s };
      }
      setGeo(best);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);

  if (state.phase === "loading") return <Station id="ST–05" name="Estimands"><div className="note">reading protocol…</div></Station>;
  if (state.phase === "blocked" || state.data.state !== "observed")
    return <Station id="ST–05" name="Estimands"><Blocked reason={state.phase === "blocked" ? state.reason : (state.data as any).reason} /></Station>;

  const proto = state.data.data;
  const PR = [{ id: "protocol", path: state.data.meta.path, sha256: state.data.meta.sha256 }];
  const measured = estimands.filter((e) => ["supported", "replicated", "corrected"].includes(e.lifecycle_status)).length;
  const lifecycles = [...new Set(estimands.map((e) => String(e.lifecycle_status)))];
  const at = cur !== null ? estimands[cur] : null;
  const s = Math.max(40, geo.s);

  return (
    <Station id="ST–05" name="Estimands" sub={`${n} defined · ${measured} measured · protocol ${proto.release_id ?? ""}`}>
      <div className="onepage">
        <div className="statstrip">
          <Stat label="measured" value={<>{measured}<em>/{n}</em></>} sub="no result exists until its gate accepts it"
            rule="count of protocol estimands whose lifecycle_status is supported, replicated or corrected, over the count of estimands defined" from={PR} />
          <Stat label="lifecycle" value={lifecycles.map((l) => l.toUpperCase()).join(" · ")} small sub="every dial defined, frozen, honestly dark"
            rule="the distinct lifecycle_status values across the protocol's estimands" from={PR} />
          <Stat label="protocol" value={String(proto.release_id ?? "").replace("reiyah.protocol.", "")} small sub="the ignition is the roadmap, not a promise"
            rule="release_id of the protocol manifest these estimands are defined in" from={PR} />
        </div>

        <div className="bank" ref={bankRef} style={{ ["--cols" as any]: geo.cols, ["--s" as any]: `${s}px` }} onPointerLeave={() => setCur(null)}>
          {estimands.map((e, i) => {
            const [glyph, dirName] = DIR[e.direction] ?? ["·", String(e.direction ?? "").replace(/_/g, " ")];
            const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
            return (
              <button key={e.estimand_id} className="dial" data-on={String(cur === i)}
                onPointerEnter={() => setCur(i)} onFocus={() => setCur(i)} onClick={() => setCur(i)}
                aria-label={`${e.estimand_id} · ${dirName} · ${e.lifecycle_status}`}>
                <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden="true">
                  <path d={arc(50, 50, 42, a0, a1)} className="dtrack" />
                  {Array.from({ length: 11 }, (_, k) => {
                    const a = a0 + (a1 - a0) * (k / 10);
                    const r0 = k % 5 === 0 ? 35 : 38, r1 = 42;
                    return <line key={k} className="dtick" x1={50 + r0 * Math.cos(a)} y1={50 + r0 * Math.sin(a)} x2={50 + r1 * Math.cos(a)} y2={50 + r1 * Math.sin(a)} />;
                  })}
                  <circle cx="50" cy="50" r="2.2" className="dpivot" />
                  <text x="50" y="47" className="dsym" textAnchor="middle">{face(e.symbol)}</text>
                  <text x="50" y="64" className="ddir" textAnchor="middle">{glyph}</text>
                  <text x="50" y="86" className="dlc" textAnchor="middle">{String(e.lifecycle_status).toUpperCase()}</text>
                </svg>
                <span className="dname">{String(e.metric_class ?? e.estimand_id).replace(/_/g, " ")}</span>
              </button>
            );
          })}
        </div>

        <div className="dialcap">
          {at ? (
            <>
              <span className="dcsym">{pretty(at.symbol)}</span>
              <span className="dcline">{(DIR[at.direction] ?? ["", String(at.direction)])[1]} · unit of analysis {String(at.unit_of_analysis ?? "").replace(/_/g, " ")} · uncertainty {String(at.uncertainty_method ?? "").replace(/_/g, " ")}</span>
              <span className="dcline">abstention · {String(at.abstention_rule ?? "∅ not stated")}</span>
              <span className="dcline dim">{Array.isArray(at.identification_assumptions) ? `${at.identification_assumptions.length} identification assumptions` : "∅ assumptions"} · {Array.isArray(at.validity_conditions) ? `${at.validity_conditions.length} validity conditions` : "∅ conditions"} · reports {Array.isArray(at.required_reporting) ? at.required_reporting.join(", ") : "∅"} · {String(at.lifecycle_status).toUpperCase()}</span>
            </>
          ) : (
            <span className="dcline dim">touch a dial to read its contract · no dial has a needle until retained evidence is accepted</span>
          )}
        </div>
      </div>
    </Station>
  );
}
void TAU;
