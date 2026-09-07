/* The Proof Boot. Not a loading animation: the identity gate, performed live.
   The instrument fetches the evidence index, recomputes its SHA-256 in this
   browser with WebCrypto, and resolves it against the committed sidecar.
   On any mismatch it renders a blocked state. No demo mode exists. */
import { useEffect, useLayoutEffect, useState } from "react";
import {
  fetchRaw, fetchSummary, fetchSurface, setBypassCache, sha256Hex, type Summary,
} from "../lib/evidence";
import { Opening } from "./Opening";

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

/* The opening stays above the verified stage until that station's code,
   readers and first layout settle. There is no artificial completion hold,
   and no empty interval between removing the opening and mounting the page. */
export function ProofBoot({ onReady, stageReady, onExit }: {
  onReady: (ev: VerifiedEvidence) => void; stageReady: boolean; onExit: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [facesReady, setFacesReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // The inline and React openings share their geometry and styles in index.html.
  useLayoutEffect(() => {
    const inline = document.getElementById("boot");
    const previous = inline?.querySelector(".opening-reflection")?.getAnimations()[0];
    const current = document.querySelector(".boot .opening-reflection")?.getAnimations()[0];
    // Continue the same light pass when the module arrives, without restarting it.
    if (previous?.currentTime != null && current) current.currentTime = previous.currentTime;
    inline?.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    const finish = () => { if (alive) setFacesReady(true); };
    const timer = setTimeout(finish, 1400);
    Promise.all(['500 1rem "Big Shoulders"', '1rem "Instrument Sans"', '1rem "B612 Mono"', '700 1rem "B612 Mono"']
      .map((font) => document.fonts.load(font))).then(finish, finish);
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!stageReady || !facesReady || blocked) return;
    setPhase(4);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { onExit(); return; }
    setLeaving(true);
    const timer = setTimeout(onExit, 360);
    return () => clearTimeout(timer);
  }, [stageReady, facesReady, blocked, onExit]);

  useEffect(() => {
    let alive = true;
    let retryTimer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        const summary = await fetchSummary();
        if (!alive) return;
        if (summary.identity.state !== "observed") throw new Error(`identity_blocked: ${summary.identity.reason}`);
        setRetrying(null);
        setPhase(1);

        const [rawIndex, rawSidecar] = await Promise.all([fetchRaw("index"), fetchRaw("index-sidecar")]);
        const clientSha = await sha256Hex(rawIndex.bytes);
        const sidecarLine = new TextDecoder().decode(rawSidecar.bytes).trim();
        const sidecarSha = sidecarLine.split(/\s+/)[0] ?? "";
        if (!alive) return;
        if (clientSha !== sidecarSha || clientSha !== rawIndex.serverSha256) throw new Error("index_digest_mismatch");
        const index = JSON.parse(new TextDecoder().decode(rawIndex.bytes));
        setPhase(2);

        // Read the retained report. This is not a new replay or acceptance.
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
        // Mount under the opening; the station reports its own readiness.
        onReady({ summary, index, indexSha256: clientSha, sidecarLine, report, reportMeta });
      } catch (e) {
        if (!alive) return;
        const reason = String((e as Error)?.message ?? e);
        const transport = /fetch|network|load failed|http_|no_evidence_source|aborted|timeout/i.test(reason);
        const budget = transport ? 3 : 1;
        if (attempt <= budget) {
          setBypassCache(true);
          setRetrying(`${transport ? "Reconnecting" : "Rechecking evidence"} · attempt ${attempt + 1}`);
          retryTimer = setTimeout(() => { if (alive) { setPhase(0); setAttempt((n) => n + 1); } }, 500 * attempt);
          return;
        }
        setRetrying(null);
        setBlocked(reason);
      }
    })();
    return () => { alive = false; clearTimeout(retryTimer); };
  }, [attempt, onReady]);

  const retry = () => {
    setBlocked(null); setRetrying(null); setPhase(0); setBypassCache(true); setAttempt(1);
  };
  return <Opening phase={phase} leaving={leaving} blocked={blocked} retrying={retrying} onRetry={retry} />;
}
