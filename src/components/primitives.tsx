/* Primitives: EpistemicValue, Digest (press-to-prove), TruthPill, StationShell.
   The EpistemicValue is the atomic component of the whole instrument —
   six states, never merged, never coerced to zero or false. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { claimLayer, newLayerToken, onLayerClaim } from "../lib/layers";
import { getMerkle, prove, proveInclusion, type Proof, type LiveState, type InclusionProof, getEvidenceGeneration } from "../lib/evidence";
import type { MerkleTree } from "../lib/merkle";
import { Fold } from "./Fold";
import { useStationReadiness } from "./StationFrame";

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
  return <div className={`fitlist complete-list${className ? ` ${className}` : ""}`} style={style} tabIndex={0} aria-label="Complete record list">{items.map(render)}</div>;
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
/* the receipt is a single host at the app root: a chip asks for a receipt,
   the host claims the layer (so the card that held the chip closes), runs
   the proof, and shows one overlay above everything. Results flow back to
   every chip that names the same record. */
interface ReceiptReq { id: string; sha: string; path: string }
const receiptBus = new EventTarget();
export function openReceipt(r: ReceiptReq): void { receiptBus.dispatchEvent(new CustomEvent("open", { detail: r })); }
const proven = new Map<string, boolean>();

export function Digest({ id, sha, path }: { id: string; sha: string; path: string }) {
  const [, force] = useState(0);
  useEffect(() => { const h = () => force((n) => n + 1); receiptBus.addEventListener("result", h); return () => receiptBus.removeEventListener("result", h); }, []);
  const short = sha.replace("sha256:", "").slice(0, 8);
  const pv = proven.get(`${id}|${sha}`);
  return (
    <button className="digest" data-proven={pv === undefined ? undefined : String(pv)} onClick={(e) => { e.stopPropagation(); openReceipt({ id, sha, path }); }} title={`prove ${path}`}>
      <span className="mark">{pv === undefined ? "◇" : pv ? "◆" : "✕"}</span>
      sha256:{short}…
    </button>
  );
}

export function ReceiptHost() {
  const [req, setReq] = useState<ReceiptReq | null>(null);
  const [proof, setProof] = useState<Proof | { reason: string } | null>(null);
  const [incl, setIncl] = useState<InclusionProof | null | undefined>(undefined);
  const dialog = useRef<HTMLDialogElement>(null);
  const token = useRef(newLayerToken());
  const seq = useRef(0);
  const close = () => { dialog.current?.close(); seq.current++; setReq(null); };
  useEffect(() => onLayerClaim(t => { if (t !== token.current) close(); }), []);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const r = (e as CustomEvent<ReceiptReq>).detail, generation = ++seq.current;
      claimLayer(token.current); setReq(r); setProof(null); setIncl(undefined);
      (async () => {
        try {
          const pr = await prove(r.id, r.sha);
          if (generation !== seq.current) return;
          setProof(pr); proven.set(`${r.id}|${r.sha}`, pr.equal); receiptBus.dispatchEvent(new Event("result"));
          const inclusion = pr.equal ? await proveInclusion(r.id, pr.clientSha256) : null;
          if (generation === seq.current) setIncl(inclusion);
        } catch (e) { if (generation === seq.current) setProof({reason:String((e as Error).message)}); }
      })();
    };
    receiptBus.addEventListener("open", onOpen);
    return () => { seq.current++; receiptBus.removeEventListener("open", onOpen); };
  }, []);
  useEffect(() => { if (req && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [req]);
  if (!req) return null;
  return createPortal(<dialog ref={dialog} className="receipt-dialog" role="dialog" aria-modal="true" aria-label="Evidence receipt" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
    <div className="receipt-content">
      <div className="eyebrow">Evidence receipt</div><h2>The bytes behind this reading.</h2>
      <p className="receipt-path">{req.path}</p>
      <dl><dt>Displayed digest</dt><dd>{req.sha}</dd>
      {proof && "equal" in proof ? <><dt>Recomputed digest</dt><dd>{proof.clientSha256}</dd><dt>Result</dt><dd className={proof.equal?'ok':'red'}>{proof.equal?'Matches the displayed record':'Mismatch · do not use this reading'}</dd><dt>Length</dt><dd>{proof.byteLength.toLocaleString()} bytes</dd><dt>Historical surface inclusion</dt><dd>{incl === undefined ? 'Checking…' : incl ? (incl.verified ? `Included among ${incl.leafCount} historical surfaces` : 'Not included') : 'Not applicable · record is bound by its own source manifest'}</dd></> : <><dt>Status</dt><dd>{proof ? proof.reason : 'Recomputing SHA-256…'}</dd></>}
      </dl><p className="research-limit">Integrity identifies these bytes. It does not establish physical truth, independent replication or operator acceptance.</p>
      <button className="research-button" autoFocus onClick={close}>Close receipt</button>
    </div>
  </dialog>,document.body);
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
        ARCHIVE · {sealed.head.slice(0, 8)}<span className="pilldate"> · {sealed.sealedAt.slice(0, 10)}</span>
      </span>
    );
  }
  let state: LiveState = "offline";
  let label = "OFFLINE · rendering last verified snapshot";
  if (connected && lastEventAt) {
    const age = Date.now() - lastEventAt;
    if (age < 60_000) {
      state = "live";
      label = `LOCAL SOURCE · verified ${Math.max(1, Math.round(age / 1000))}s ago`;
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
    <section className="stbody" aria-label={`${id} ${name}`}>
      {["ST–13","ST–14","ST–15"].includes(id) && <div className="legacy-correction"><strong>Interpretation corrected · 10 October 2026.</strong> These historical, selected-sample contrasts do not establish a population lower bound, a universal kind-independence law or safety credit. <a href="?st=findings&at=corrections">Read the corrections →</a></div>}
      {id === "ST–16" && <div className="legacy-correction"><strong>Saved research results.</strong> The in-domain monitor score does not establish task transfer or live deployment. Transfer failures and calibration limits remain part of this record. <a href="?st=research&at=evidence%2Fclaim-status-register-2026-10-10.json">Current claim register →</a></div>}
      {children}</section>
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
  const token = useRef(newLayerToken());
  useEffect(() => onLayerClaim((t) => { if (t !== token.current) setOpen(false); }), []);
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
    if (!open) claimLayer(token.current);
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
          <div className="dvat">read in this browser at {at.current} · inspect the source and its scope</div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ---------- blocked panel (fail-closed rendering) ---------- */
export function Blocked({ reason }: { reason: string }) {
  const absent = /absent|not present|unknown_gateb_surface/i.test(reason);
  const transport = /fetch|network|http_|aborted|timeout/i.test(reason);
  return (
    <div className="blocked" role="alert">
      <span className="blocked-state"><i aria-hidden="true" />Blocked</span>
      <h2>{absent ? "Source unavailable" : transport ? "Connection interrupted" : "Verification incomplete"}</h2>
      <p>{absent ? "The required record is not available from this source." : transport ? "The source could not be reached. You can try again." : "The source did not pass verification."}</p>
      <button className="blocked-retry" onClick={() => location.reload()}>Try again<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.5 5.5A5 5 0 1 0 13 9M9 5.5h4V1.5" /></svg></button>
      <details className="blocked-details"><summary>Details</summary><code>{reason}</code></details>
    </div>
  );
}

/* every station's assembled data is kept for the session, keyed by the
   loader's own source and its deps: a station returns to its data in the
   same frame it mounts, and the loader still re-runs underneath so a newer
   seal or a live event replaces it. The bytes beneath are content-addressed,
   so this is honest caching, never a stale claim. */
const surfaceCache = new Map<string, unknown>();
/* run a station's loader before the station mounts (during boot), so the
   first screen renders with its numbers already in hand */
export async function primeSurface<T>(loader: () => Promise<T>, deps: unknown[] = []): Promise<void> {
  const key = getEvidenceGeneration() + "|" + loader.toString() + "|" + JSON.stringify(deps);
  if (surfaceCache.has(key)) return;
  try { surfaceCache.set(key, await loader()); } catch { /* the station will report it */ }
}
export function useSurfaceState<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const key = getEvidenceGeneration() + "|" + loader.toString() + "|" + JSON.stringify(deps);
  const [state, setState] = useState<{ phase: "loading" } | { phase: "ready"; data: T } | { phase: "blocked"; reason: string }>(() => surfaceCache.has(key) ? { phase: "ready", data: surfaceCache.get(key) as T } : { phase: "loading" });
  useEffect(() => {
    let alive = true;
    if (!surfaceCache.has(key)) setState({ phase: "loading" });
    loader()
      .then((data) => { surfaceCache.set(key, data); if (alive) setState({ phase: "ready", data }); })
      .catch((e) => alive && setState({ phase: "blocked", reason: String((e as Error)?.message ?? e) }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useStationReadiness(state.phase);
  return state;
}
