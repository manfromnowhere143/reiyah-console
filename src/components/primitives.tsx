/* Primitives: EpistemicValue, Digest (press-to-prove), TruthPill, StationShell.
   The EpistemicValue is the atomic component of the whole instrument —
   six states, never merged, never coerced to zero or false. */
import { useEffect, useState } from "react";
import { prove, type Proof, type LiveState } from "../lib/evidence";

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
  const short = sha.replace("sha256:", "").slice(0, 8);

  const run = async () => {
    setOpen(true);
    setProof(null);
    try {
      setProof(await prove(id));
    } catch (e) {
      setProof({ state: "blocked", reason: String((e as Error)?.message ?? e) });
    }
  };

  const proven = proof && "equal" in proof ? proof.equal : undefined;
  return (
    <>
      <button className="digest" data-proven={proven === undefined ? undefined : String(proven)} onClick={run} title={`prove ${path}`}>
        <span className="mark">{proven === undefined ? "◇" : proven ? "◆" : "✕"}</span>
        sha256:{short}…
      </button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="provecard glass" onClick={(e) => e.stopPropagation()}>
            <h3>Press to Prove</h3>
            {!proof && <div className="proverow"><span className="k">status</span><span className="v">refetching exact bytes · recomputing SHA-256 in this browser…</span></div>}
            {proof && "equal" in proof && (
              <>
                <div className="proverow"><span className="k">source</span><span className="v">{proof.path}</span></div>
                <div className="proverow"><span className="k">bytes</span><span className="v">{proof.byteLength.toLocaleString()}</span></div>
                <div className="proverow"><span className="k">server</span><span className="v">{proof.serverSha256}</span></div>
                <div className="proverow"><span className="k">this browser</span><span className={`v ${proof.equal ? "eq" : "neq"}`}>{proof.clientSha256}</span></div>
                <div className="proverow"><span className="k">verdict</span><span className={`v ${proof.equal ? "eq" : "neq"}`}>{proof.equal ? "BYTE-IDENTICAL" : "MISMATCH — do not trust this surface"}</span></div>
              </>
            )}
            {proof && "reason" in proof && !("equal" in proof) && (
              <div className="proverow"><span className="k">blocked</span><span className="v neq">{proof.reason}</span></div>
            )}
            <button className="close" onClick={() => setOpen(false)}>CLOSE</button>
          </div>
        </div>
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
export function Station({
  id, name, sub, children,
}: { id: string; name: string; sub?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="sthead">
        <span className="stid">{id}</span>
        <h2>{name}</h2>
        {sub && <span className="stsub">{sub}</span>}
      </div>
      <div className="stbody">{children}</div>
    </>
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
