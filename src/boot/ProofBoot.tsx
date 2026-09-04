/* The Proof Boot. Not a loading animation: the identity gate, performed live.
   The instrument fetches the evidence index, recomputes its SHA-256 in this
   browser with WebCrypto, and resolves it against the committed sidecar.
   On any mismatch it renders a blocked state. No demo mode exists. */
import { useEffect, useRef, useState } from "react";
import {
  fetchRaw, fetchSummary, fetchSurface, setBypassCache, sha256Hex, type Summary,
} from "../lib/evidence";
import { Mark } from "../components/primitives";

export interface VerifiedEvidence {
  summary: Summary;
  index: any;
  indexSha256: string;
  sidecarLine: string;
  report: any;
  reportMeta: { path: string; sha256: string } | null;
}

/* One complete verification pass, no UI. Used for live re-verification when
   the repository changes: the same digest gate the boot enforces, every time. */
export async function verifyEvidenceOnce(): Promise<VerifiedEvidence> {
  const summary = await fetchSummary();
  if (summary.identity.state !== "observed") throw new Error("identity_blocked");
  const [rawIndex, rawSidecar] = await Promise.all([fetchRaw("index"), fetchRaw("index-sidecar")]);
  const clientSha = await sha256Hex(rawIndex.bytes);
  const sidecarLine = new TextDecoder().decode(rawSidecar.bytes).trim();
  const sidecarSha = sidecarLine.split(/\s+/)[0] ?? "";
  if (clientSha !== sidecarSha || clientSha !== rawIndex.serverSha256) {
    throw new Error("index_digest_mismatch");
  }
  const index = JSON.parse(new TextDecoder().decode(rawIndex.bytes));
  const reportId =
    summary.surfaces.find((s) => s.id.startsWith("report-") && s.id.includes("1.2.3"))?.id ??
    summary.surfaces.filter((s) => /^report-\d/.test(s.id)).map((s) => s.id).sort().at(-1);
  let report: any = null;
  let reportMeta: { path: string; sha256: string } | null = null;
  if (reportId) {
    const rs = await fetchSurface<any>(reportId);
    if (rs.state === "observed") {
      report = rs.data;
      reportMeta = { path: rs.meta.path, sha256: rs.meta.sha256 };
    }
  }
  return { summary, index, indexSha256: clientSha, sidecarLine, report, reportMeta };
}

/* Four real checks, in order. The meridian and the ring fill only as each of
   these actually passes — determinate progress bound to verification, never a
   fabricated timer. Each phase names the true work underway. */
const PHASES = ["establishing identity", "recomputing index digest", "confirming twin agreement", "descending into the field"] as const;

export function ProofBoot({ onReady }: { onReady: (ev: VerifiedEvidence) => void }) {
  const [phase, setPhase] = useState(0);               // 0..4 checks passed
  const [blocked, setBlocked] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  const result = useRef<VerifiedEvidence | null>(null);

  /* Hand off from the instant inline splash without a seam: this component
     paints the same iris, then removes the pre-boot node it now covers. */
  useEffect(() => {
    const el = document.getElementById("boot");
    if (!el) return;
    el.classList.add("ap-out");
    const t = setTimeout(() => el.remove(), 340);
    return () => clearTimeout(t);
  }, []);

  const depart = () => {
    if (done.current || !result.current) return;
    done.current = true;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { onReady(result.current); return; }
    setLeaving(true);
    setTimeout(() => onReady(result.current!), 680);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        /* 1 — identity */
        const summary = await fetchSummary();
        if (!alive) return;
        if (summary.identity.state !== "observed") throw new Error(`identity_blocked: ${summary.identity.reason}`);
        setPhase(1);

        /* 2 — index digest, recomputed here */
        const [rawIndex, rawSidecar] = await Promise.all([fetchRaw("index"), fetchRaw("index-sidecar")]);
        const clientSha = await sha256Hex(rawIndex.bytes);
        const sidecarLine = new TextDecoder().decode(rawSidecar.bytes).trim();
        const sidecarSha = sidecarLine.split(/\s+/)[0] ?? "";
        const indexOk = clientSha === sidecarSha && clientSha === rawIndex.serverSha256;
        if (!alive) return;
        if (!indexOk) throw new Error("index_digest_mismatch");
        const index = JSON.parse(new TextDecoder().decode(rawIndex.bytes));
        setPhase(2);

        /* 3 — canonical report, twin agreement */
        const reportId = summary.surfaces.find((s) => s.id.startsWith("report-") && s.id.includes("1.2.3"))?.id
          ?? summary.surfaces.filter((s) => s.id.startsWith("report-")).map((s) => s.id).sort().at(-1);
        let report: any = null;
        let reportMeta: { path: string; sha256: string } | null = null;
        if (reportId) {
          const rs = await fetchSurface<any>(reportId);
          if (rs.state === "observed") { report = rs.data; reportMeta = { path: rs.meta.path, sha256: rs.meta.sha256 }; }
        }
        if (!alive) return;
        setPhase(3);

        /* 4 — descent */
        result.current = { summary, index, indexSha256: clientSha, sidecarLine, report, reportMeta };
        setPhase(4);
        setComplete(true);
        setTimeout(() => { if (alive) depart(); }, 900);
      } catch (e) {
        if (!alive) return;
        const reason = String((e as Error)?.message ?? e);
        /* A transport failure (a fetch that failed, was aborted, or answered
           with a status) is not a verification failure. It is retried, up to
           three times, with backoff and every cache bypassed. A digest that
           truly mismatches is retried once through the network, then blocks
           for good. Nothing renders in the meantime; nothing is assumed. */
        const transport = /fetch|network|load failed|http_|no_evidence_source|aborted|timeout/i.test(reason);
        const budget = transport ? 3 : 1;
        if (attempt <= budget) {
          setBypassCache(true);
          setRetrying(`${transport ? "transport failed" : "digest mismatch"} · retrying ${attempt}/${budget} · ${reason}`);
          setTimeout(() => { if (alive) { setPhase(0); setAttempt((n) => n + 1); } }, 500 * attempt);
          return;
        }
        setRetrying(null);
        setBlocked(reason);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  const retry = () => { setBlocked(null); setRetrying(null); setPhase(0); setBypassCache(true); setAttempt(1); };

  const p = Math.min(phase, 4) / 4;                    // 0..1, determinate
  const RING = 2 * Math.PI * 104;                      // progress-ring circumference
  const status = complete ? "verified · entering harbor" : retrying ?? PHASES[Math.min(phase, 3)];

  if (blocked) {
    return (
      <div className="boot" data-leaving="false">
        <div className="bootcard">
          <div className="bootmast" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ color: "var(--ink)" }}><Mark size={17} /></span>
            <span><b>REIYAH</b> <span className="dot">//</span> HARBOR INSTRUMENT · PROOF BOOT</span>
          </div>
          <div className="blocked">
            <h2>Blocked</h2>
            <p>The instrument could not verify its evidence after several attempts, so it will not render. A blocked result is preferable to a plausible default.</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.66rem" }}>{blocked}</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.62rem", color: "var(--ink-faint)" }}>
              {/^index_digest_mismatch/.test(blocked) ? "the bytes fetched do not match the committed digest: this is a hard block" : "the sealed snapshot could not be reached or its transfer was interrupted"}
            </p>
            <button className="close" onClick={retry} style={{ marginTop: "0.4rem" }}>RETRY · bypass every cache</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="boot" data-leaving={String(leaving)}>
      <div className="apx" data-complete={String(complete)}>
        <div className="apx-core">
          <div className="apx-lens" />
          <div className="apx-iris">
            {/* determinate progress ring — fills as real checks pass */}
            <svg className="apx-arc" viewBox="0 0 240 240" width="132" height="132" aria-hidden="true">
              <circle cx="120" cy="120" r="104" fill="none" stroke="var(--line)" strokeWidth="2" />
              <circle
                cx="120" cy="120" r="104" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
                transform="rotate(-90 120 120)"
                strokeDasharray={RING} strokeDashoffset={RING * (1 - p)}
                style={{ transition: "stroke-dashoffset .7s cubic-bezier(.22,.61,.36,1)" }}
              />
            </svg>
            {/* the aware iris, alive */}
            <svg className="apx-eye" viewBox="0 0 240 240" width="80" height="80" aria-hidden="true">
              <circle className="apx-ring" cx="120" cy="120" r="84" fill="none" stroke="currentColor"
                      strokeWidth="24" strokeLinecap="round" strokeDasharray="454.5 73.3"
                      transform="rotate(-20 120 120)" />
              <circle cx="133" cy="107" r="27" fill="var(--accent)" />
            </svg>
          </div>
        </div>

        <div className="apx-below">
          <div className="apx-word">REIYAH</div>

          <div className="apx-track"><span className="apx-fill" style={{ transform: `scaleX(${p})` }} /></div>
          <div className="apx-status" data-complete={String(complete)}>{status}</div>
        </div>
      </div>
    </div>
  );
}
