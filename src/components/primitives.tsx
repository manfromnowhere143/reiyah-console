/* Primitives: EpistemicValue, Digest (press-to-prove), TruthPill, StationShell.
   The EpistemicValue is the atomic component of the whole instrument —
   six states, never merged, never coerced to zero or false. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { prove, proveInclusion, type Proof, type LiveState, type InclusionProof } from "../lib/evidence";

/* ---------- FitList: a list that is measured, not hoped ----------
   One page, one screen, no scrolling is a law here. A list that might not
   fit its container renders exactly as many rows as the container can hold
   (measured with a ResizeObserver, re-measured on every resize) and says
   how many it withheld. Nothing is ever clipped mid-row, and nothing scrolls. */
export function FitList<T>({ items, render, row = 24, more, className, style }: {
  items: T[];
  render: (item: T, i: number) => React.ReactNode;
  row?: number;                              // fallback row height in px before the first measurement
  more?: (hidden: number) => React.ReactNode; // footer for the withheld rows
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(items.length);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      const first = el.firstElementChild as HTMLElement | null;
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.rowGap) || 0;
      const rowH = Math.max(1, (first?.offsetHeight || row) + gap);
      const reserve = more ? rowH : 0;
      /* a grid list holds several items per row */
      const cols = cs.display === "grid" ? Math.max(1, cs.gridTemplateColumns.split(" ").filter(Boolean).length) : 1;
      const overflowing = el.scrollHeight > h + 1;
      const fits = Math.max(1, Math.min(items.length, cols * Math.floor((h - reserve) / rowH)));
      /* shrink only when rows actually overflow; otherwise only grow. In a box
         whose height is its own content this keeps the list stable instead of
         eating itself one row per measurement. */
      setN((cur) => (overflowing ? Math.min(cur, fits) : Math.max(cur, fits)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, row, !!more]);
  const shown = items.slice(0, n);
  return (
    <div ref={ref} className={`fitlist${className ? ` ${className}` : ""}`} style={style}>
      {shown.map(render)}
      {n < items.length && more && <div className="fitmore">{more(items.length - n)}</div>}
    </div>
  );
}

/* ---------- The mark: the aware iris ---------- */
export function Mark({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden="true" style={{ display: "block", flex: "none" }}>
      <circle cx="120" cy="120" r="84" fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeDasharray="454.5 73.3" transform="rotate(-20 120 120)" />
      <circle cx="133" cy="107" r="27" fill="var(--accent)" />
    </svg>
  );
}

/* ---------- EpistemicValue ---------- */
export interface EvLike {
  state?: string;
  value?: unknown;
  reason?: string;
}

const EV_GLYPH: Record<string, string> = {
  missing: "—",
  unmeasured: "∅",
  out_of_distribution: "?",
  sensor_invalid: "×",
  abstained: "···",
};

export function Ev({ label, ev, unit }: { label: string; ev: EvLike | undefined; unit?: string }) {
  const state = ev?.state ?? "missing";
  const observed = state === "observed";
  const display = observed
    ? `${String(ev?.value)}${unit ? ` ${unit}` : ""}`
    : EV_GLYPH[state] ?? "—";
  const long = display.length > 10;
  return (
    <span className="ev" data-state={state}>
      <span className="evk">{state}</span>
      <span className="evv" style={long ? { fontSize: "0.64rem", wordBreak: "break-all", lineHeight: 1.4 } : undefined}>{display}</span>
      <span className="evr">{observed ? label : ev?.reason ? `${label} · ${ev.reason}` : label}</span>
    </span>
  );
}

/* ---------- Digest chip: press to prove ---------- */
export function Digest({ id, sha, path }: { id: string; sha: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<Proof | { state: "blocked"; reason: string } | null>(null);
  const [incl, setIncl] = useState<InclusionProof | null>(null);
  const short = sha.replace("sha256:", "").slice(0, 8);

  const run = async () => {
    setOpen(true);
    setProof(null);
    setIncl(null);
    try {
      const pr = await prove(id);
      setProof(pr);
      if ("equal" in pr && pr.equal) {
        proveInclusion(id, pr.clientSha256).then((i) => i && setIncl(i)).catch(() => {});
      }
    } catch (e) {
      setProof({ state: "blocked", reason: String((e as Error)?.message ?? e) });
    }
  };

  const proven = proof && "equal" in proof ? proof.equal : undefined;
  const done = !!(proof && "equal" in proof);
  const blocked = !!(proof && "reason" in proof);
  const p = proof as Proof;
  return (
    <>
      <button className="digest" data-proven={proven === undefined ? undefined : String(proven)} onClick={run} title={`prove ${path}`}>
        <span className="mark">{proven === undefined ? "◇" : proven ? "◆" : "✕"}</span>
        sha256:{short}…
      </button>
      {open && createPortal(
        <div className="overlay" onClick={() => setOpen(false)}>
          {/* Opens at final size with every field present, then the values
              compute in place — no resize, one clean entrance. */}
          <div className="provecard glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Press to prove">
            <h3>Press to Prove</h3>
            {done ? (
              <>
                <div className="proverow"><span className="k">source</span><span className="v">{p.path}</span></div>
                <div className="proverow"><span className="k">bytes</span><span className="v">{p.byteLength.toLocaleString()}</span></div>
                <div className="proverow"><span className="k">server</span><span className="v">{p.serverSha256}</span></div>
                <div className="proverow"><span className="k">this browser</span><span className={`v ${p.equal ? "eq" : "neq"}`}>{p.clientSha256}</span></div>
                <div className="proverow"><span className="k">verdict</span><span className={`v ${p.equal ? "eq" : "neq"}`}>{p.equal ? "BYTE-IDENTICAL" : "MISMATCH — do not trust this surface"}</span></div>
                {p.equal && (
                  <>
                    <div className="proverow" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.7rem", marginTop: "0.3rem" }}>
                      <span className="k">seal root</span>
                      <span className="v">{incl ? `sha256:${incl.rootHex.slice(0, 40)}…` : "folding the sealed set…"}</span>
                    </div>
                    <div className="proverow">
                      <span className="k">inclusion</span>
                      <span className={`v ${incl ? (incl.verified ? "eq" : "neq") : "compute"}`}>
                        {incl
                          ? incl.verified
                            ? `PROVEN · this record folds into the root over ${incl.leafCount} surfaces in ${incl.steps} hops`
                            : "NOT INCLUDED — this record is not part of the sealed root"
                          : "computing the audit path…"}
                      </span>
                    </div>
                  </>
                )}
              </>
            ) : blocked ? (
              <>
                <div className="proverow"><span className="k">source</span><span className="v">{path}</span></div>
                <div className="proverow"><span className="k">blocked</span><span className="v neq">{(proof as { reason: string }).reason}</span></div>
              </>
            ) : (
              <>
                <div className="proverow"><span className="k">source</span><span className="v">{path}</span></div>
                <div className="proverow"><span className="k">bytes</span><span className="v compute">measuring…</span></div>
                <div className="proverow"><span className="k">server</span><span className="v">{sha}</span></div>
                <div className="proverow"><span className="k">this browser</span><span className="v compute">recomputing SHA-256 in this browser…</span></div>
                <div className="proverow"><span className="k">verdict</span><span className="v compute">…</span></div>
              </>
            )}
            <button className="close" onClick={() => setOpen(false)}>CLOSE</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ---------- Truth pill ---------- */
export function TruthPill({ lastEventAt, connected, sealed, violated }: {
  lastEventAt: number | null;
  connected: boolean;
  sealed?: { sealedAt: string; head: string } | null;
  violated?: boolean;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  if (violated) {
    return (
      <span className="pill" data-state="alarm">
        <span className="ind" />
        INVARIANT VIOLATED · re-verify failed
      </span>
    );
  }
  if (sealed) {
    return (
      <span className="pill" data-state="sealed">
        <span className="ind" />
        SEALED · {sealed.head.slice(0, 8)}<span className="pilldate"> · {sealed.sealedAt.slice(0, 10)}</span>
      </span>
    );
  }
  let state: LiveState = "offline";
  let label = "OFFLINE · rendering last verified snapshot";
  if (connected && lastEventAt) {
    const age = Date.now() - lastEventAt;
    if (age < 60_000) {
      state = "live";
      label = `LIVE · verified ${Math.max(1, Math.round(age / 1000))}s ago`;
    } else {
      state = "stale";
      label = `STALE · ${Math.round(age / 60_000)}m since last signal`;
    }
  }
  return (
    <span className="pill" data-state={state}>
      <span className="ind" />
      {label}
    </span>
  );
}

/* ---------- Station shell ---------- */
/* No page title: the station's identity lives on the dock tab you pressed, so
   the content floats on the screen without a redundant header. `id`/`name`/`sub`
   are kept in the signature (callers still pass them) for accessibility. */
export function Station({
  id, name, children,
}: { id: string; name: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="stbody" aria-label={`${id} ${name}`}>{children}</section>
  );
}

/* ---------- Stat: a figure that explains itself ----------
   Every headline number on the instrument is derived in this browser from
   digest-verified bytes. A Stat carries that derivation: the rule in words,
   the source records with their digests (press to prove), and the moment it
   was computed. Tap the figure to read it. The popover is placed against the
   figure's own box (absolute inside the static document; no fixed layers). */
export interface Source { id?: string; path: string; sha256: string }
export function Stat({ label, value, sub, rule, from, wide, small, children }: {
  label: string; value?: React.ReactNode; sub?: React.ReactNode;
  rule?: string; from?: Source[]; wide?: boolean; small?: boolean; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const at = useRef<string>("");
  const explain = !!rule;
  const toggle = () => {
    if (!explain) return;
    if (!open) {
      const r = ref.current?.getBoundingClientRect();
      if (r) {
        const w = Math.min(340, window.innerWidth - 16);
        const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
        setBox({ left, top: r.bottom + 6, width: w });
      }
      at.current = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    setOpen(!open);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!(e.target as HTMLElement)?.closest?.(".derive, .stat[data-explain]")) setOpen(false); };
    window.addEventListener("keydown", onKey, true); window.addEventListener("pointerdown", onDown, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointerdown", onDown, true); };
  }, [open]);
  return (
    <div ref={ref} className={`stat${wide ? " statwide" : ""}`} data-explain={explain ? "true" : undefined} data-open={String(open)}
      role={explain ? "button" : undefined} tabIndex={explain ? 0 : undefined}
      onClick={toggle} onKeyDown={(e) => { if (explain && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); } }}
      aria-expanded={explain ? open : undefined} title={explain ? "how this figure was derived" : undefined}>
      <span className="sl">{label}{explain && <i className="slq" aria-hidden="true">?</i>}</span>
      {value !== undefined && <span className={`sv${small ? " sm" : ""}`}>{value}</span>}
      {children}
      {sub !== undefined && <span className="sd">{sub}</span>}
      {open && box && createPortal(
        <div className="derive glass" style={{ left: box.left, top: box.top, width: box.width }} role="dialog" aria-label={`derivation of ${label}`} onClick={(e) => e.stopPropagation()}>
          <div className="dvk">how this figure was derived</div>
          <div className="dvrule">{rule}</div>
          <div className="dvk">from these committed bytes</div>
          {(from ?? []).length === 0 && <div className="dvsrc dim">the record shown on this station</div>}
          {(from ?? []).map((f) => (
            <div key={f.path} className="dvsrc">
              <span className="dvpath">{f.path}</span>
              <Digest id={f.id ?? `p/${f.path}`} sha={f.sha256} path={f.path} />
            </div>
          ))}
          <div className="dvat">computed in this browser at {at.current} · nothing on this instrument is a placeholder</div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ---------- blocked panel (fail-closed rendering) ---------- */
export function Blocked({ reason }: { reason: string }) {
  return (
    <div className="ipanel blocked">
      <h2>Blocked</h2>
      <p>
        This surface could not be verified, so nothing is rendered in its place.{" "}
        <b style={{ color: "var(--ink)" }}>A blocked result is preferable to a plausible default.</b>
      </p>
      <p style={{ fontFamily: "var(--mono)", fontSize: "0.66rem" }}>{reason}</p>
    </div>
  );
}

export function useSurfaceState<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ phase: "loading" } | { phase: "ready"; data: T } | { phase: "blocked"; reason: string }>({ phase: "loading" });
  useEffect(() => {
    let alive = true;
    setState({ phase: "loading" });
    loader()
      .then((data) => alive && setState({ phase: "ready", data }))
      .catch((e) => alive && setState({ phase: "blocked", reason: String((e as Error)?.message ?? e) }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
