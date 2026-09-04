/* The palette: ⌘K over everything the instrument knows. Stations, every
   artifact in the index, every declared rejection rule, every schema, every
   estimand, every control. No dependency: a small subsequence scorer over an
   in-memory list built from the verified bytes. Selecting a station goes
   there; selecting a record goes to the station that shows it and, where the
   bytes are present, opens press-to-prove on its digest. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { STATIONS } from "../lib/camera";
import { fetchSchemaIndex, fetchSurface, getMode } from "../lib/evidence";
import { Digest } from "./primitives";

interface Item { kind: string; label: string; sub: string; station: string; sha?: string; path?: string; id?: string }

function score(q: string, text: string): number {
  if (!q) return 1;
  const t = text.toLowerCase(); const s = q.toLowerCase();
  let i = 0, run = 0, best = 0, last = -2;
  for (let k = 0; k < t.length && i < s.length; k++) {
    if (t[k] === s[i]) { run = last === k - 1 ? run + 1 : 1; best += run; last = k; i++; }
  }
  if (i < s.length) return 0;
  return best / (1 + t.length / 40);
}

export function Palette({ ev, go }: { ev: VerifiedEvidence; go: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [extra, setExtra] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  /* the corpus beyond the index is loaded once, on first open */
  useEffect(() => {
    if (!open || extra.length) return;
    (async () => {
      const out: Item[] = [];
      try {
        const fx = await fetchSurface<any>("fixtures");
        if (fx.state === "observed") {
          const rules = new Map<string, number>();
          for (const f of fx.data.fixtures ?? []) if (f.expected_primary_rule_id) rules.set(f.expected_primary_rule_id, (rules.get(f.expected_primary_rule_id) ?? 0) + 1);
          for (const [r, n] of rules) out.push({ kind: "rule", label: r, sub: `${n} known-bad must fail against it`, station: "adversaries" });
        }
      } catch { /* the wall will report it */ }
      try {
        for (const s of await fetchSchemaIndex()) out.push({ kind: "schema", label: s.path.replace(/^schemas\//, ""), sub: `${s.family} · ${s.property_count ?? "∅"} properties · ${s.additional_properties_closed ? "closed" : "open"}`, station: "contract", sha: s.sha256, path: s.path });
      } catch { /* the contract will report it */ }
      try {
        const pr = await fetchSurface<any>("protocol");
        if (pr.state === "observed") for (const e of pr.data.estimands ?? []) out.push({ kind: "estimand", label: String(e.symbol), sub: `${String(e.metric_class ?? e.estimand_id).replace(/_/g, " ")} · ${String(e.direction ?? "").replace(/_/g, " ")} · ${e.lifecycle_status}`, station: "estimands" });
      } catch { /* the dials will report it */ }
      setExtra(out);
    })();
  }, [open, extra.length]);

  const items = useMemo<Item[]>(() => {
    const r = ev.report ?? {};
    const controls = [...(r.required_replay_controls ?? []), ...(r.implementation_controls ?? [])] as any[];
    return [
      ...STATIONS.map((s) => ({ kind: "station", label: s.name, sub: `${s.num} · ${s.desc}`, station: s.id })),
      ...controls.map((c) => ({ kind: "control", label: c.control_id, sub: `${String(c.state).toUpperCase()} · ${c.observation_count} observations`, station: "controls", sha: c.evidence_sha256 })),
      ...extra,
      ...((ev.index?.artifacts ?? []) as any[]).map((a) => ({ kind: "artifact", label: a.artifact.path, sub: `${String(a.role).replace(/_/g, " ")} · ${Number(a.byte_size).toLocaleString()} B`, station: "ledger", sha: a.artifact.sha256, path: a.artifact.path, id: `p/${a.artifact.path}` })),
    ];
  }, [ev, extra]);

  const results = useMemo(() => {
    const qq = q.trim();
    const scored = items.map((it) => ({ it, s: score(qq, `${it.kind} ${it.label} ${it.sub}`) })).filter((x) => x.s > 0);
    scored.sort((a, b) => b.s - a.s || a.it.label.localeCompare(b.it.label));
    return scored.slice(0, 40).map((x) => x.it);
  }, [items, q]);
  useEffect(() => { setSel(0); }, [q]);

  const choose = (it: Item) => { setOpen(false); go(it.station); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter" && results[sel]) { e.preventDefault(); choose(results[sel]); }
    e.stopPropagation();
  };
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const it of items) c[it.kind] = (c[it.kind] ?? 0) + 1; return c; }, [items]);
  const sealed = getMode() === "sealed";

  return (
    <>
      <button className="hudbtn palbtn" onClick={() => setOpen(true)} aria-label="Open the palette" title="⌘K">⌘K</button>
      {open && createPortal(
        <div className="overlay palover" onClick={() => setOpen(false)}>
          <div className="palette glass" role="dialog" aria-label="Palette" onClick={(e) => e.stopPropagation()}>
            <input ref={inputRef} className="palin" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
              placeholder={`search ${items.length.toLocaleString()} things · stations, artifacts, rules, schemas, estimands, controls`} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
            <div className="palcounts">{Object.entries(counts).map(([k, n]) => <span key={k}>{n.toLocaleString()} {k}{n === 1 ? "" : "s"}</span>)}</div>
            <div className="pallist" role="listbox">
              {results.map((it, i) => (
                <div key={`${it.kind}:${it.label}`} className="palrow" role="option" aria-selected={i === sel} data-on={String(i === sel)}
                  onPointerEnter={() => setSel(i)} onClick={() => choose(it)}>
                  <span className="palk">{it.kind}</span>
                  <span className="pall">{it.label}</span>
                  <span className="pals">{it.sub}</span>
                  {it.sha && (it.kind !== "artifact" || !sealed) && it.path && it.id
                    ? <span className="pald" onClick={(e) => e.stopPropagation()}><Digest id={it.id} sha={it.sha} path={it.path} /></span>
                    : it.sha ? <span className="palsha">{it.sha.slice(7, 15)}</span> : null}
                </div>
              ))}
              {results.length === 0 && <div className="palrow dim"><span className="palk">none</span><span className="pall">nothing in the instrument matches</span></div>}
            </div>
            <div className="palfoot">↑↓ move · enter go · esc close{sealed ? " · sealed snapshot: artifact bytes beyond the bundled surfaces are not provable here" : " · live: any artifact can be proven"}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
