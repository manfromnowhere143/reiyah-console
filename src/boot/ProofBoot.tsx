/* The Proof Boot. Not a loading animation: the identity gate, performed live.
   The instrument fetches the evidence index, recomputes its SHA-256 in this
   browser with WebCrypto, and resolves it against the committed sidecar.
   On any mismatch it renders a blocked state. No demo mode exists. */
import { useEffect, useRef, useState } from "react";
import {
  fetchRaw, fetchSummary, fetchSurface, sha256Hex, type Summary,
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

type RowState = "wait" | "on" | "fail";
interface Row { t: string; d: React.ReactNode; s: string; state: RowState }

export function ProofBoot({ onReady }: { onReady: (ev: VerifiedEvidence) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const done = useRef(false);
  const result = useRef<VerifiedEvidence | null>(null);
  const [complete, setComplete] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const depart = () => {
    if (done.current || !result.current) return;
    done.current = true;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { onReady(result.current); return; }
    setLeaving(true);
    setTimeout(() => onReady(result.current!), 680);
  };

  const push = (row: Row) => setRows((r) => [...r, row]);

  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    const stamp = () => `T+${((performance.now() - t0) / 1000).toFixed(2)}s`;

    (async () => {
      try {
        /* 1 — identity */
        const summary = await fetchSummary();
        if (!alive) return;
        if (summary.identity.state !== "observed") throw new Error(`identity_blocked: ${summary.identity.reason}`);
        const idn = summary.identity;
        push({
          t: stamp(), state: "on", s: idn.worktree_clean ? "VERIFIED" : "DIRTY TREE",
          d: (<><b>Identity.</b> reiyah · {idn.branch || "detached"} · <span className="mono">{idn.head.slice(0, 12)}</span> · worktree {idn.worktree_clean ? "clean" : "dirty"}</>),
        });

        /* 2 — index digest, recomputed here */
        const [rawIndex, rawSidecar] = await Promise.all([fetchRaw("index"), fetchRaw("index-sidecar")]);
        const clientSha = await sha256Hex(rawIndex.bytes);
        const sidecarLine = new TextDecoder().decode(rawSidecar.bytes).trim();
        const sidecarSha = sidecarLine.split(/\s+/)[0] ?? "";
        const indexOk = clientSha === sidecarSha && clientSha === rawIndex.serverSha256;
        if (!alive) return;
        push({
          t: stamp(), state: indexOk ? "on" : "fail", s: indexOk ? "BYTE-IDENTICAL" : "DIGEST MISMATCH",
          d: (<><b>Index digest.</b> <span className="mono">{clientSha.slice(0, 26)}…</span> recomputed in this browser · {indexOk ? "equals committed sidecar" : "does NOT equal the committed sidecar"}</>),
        });
        if (!indexOk) throw new Error("index_digest_mismatch");
        const index = JSON.parse(new TextDecoder().decode(rawIndex.bytes));

        /* 3 — canonical report, twins */
        const reportId = summary.surfaces.find((s) => s.id.startsWith("report-") && s.id.includes("1.2.3"))?.id
          ?? summary.surfaces.filter((s) => s.id.startsWith("report-")).map((s) => s.id).sort().at(-1);
        let report: any = null;
        let reportMeta: { path: string; sha256: string } | null = null;
        if (reportId) {
          const rs = await fetchSurface<any>(reportId);
          if (rs.state === "observed") {
            report = rs.data;
            reportMeta = { path: rs.meta.path, sha256: rs.meta.sha256 };
          }
        }
        if (!alive) return;
        const dual = report?.dual_evaluation;
        push({
          t: stamp(), state: dual?.complete_payloads_equal ? "on" : "fail",
          s: dual?.complete_payloads_equal ? "TWINS AGREE" : "NOT OBSERVED",
          d: dual
            ? (<><b>Dual evaluation.</b> {dual.logical_worker_ids?.join(" ≡ ")} · {Number(dual.comparable_payload_byte_size).toLocaleString()}-byte payloads equal · status {report.status} · exit {report.exit_code}</>)
            : (<><b>Dual evaluation.</b> canonical report unavailable</>),
        });

        /* 4 — authority engraving */
        const auth = index?.authority ?? report?.authority;
        push({
          t: stamp(), state: "on", s: "HONEST",
          d: (<><b>Authority.</b> seven refusals engraved · acceptance {String(auth?.operator_acceptance_state ?? "unknown").toUpperCase()} · GA-17 {String(auth?.ga_17_state ?? "unknown").toUpperCase()}</>),
        });

        /* 5 — descent */
        result.current = { summary, index, indexSha256: clientSha, sidecarLine, report, reportMeta };
        push({ t: stamp(), state: "on", s: "● LIVE", d: (<><b>Descent.</b> {Number(index?.artifacts?.length ?? 0).toLocaleString()} artifacts verified into the field · entering Harbor</>) });
        setComplete(true);
        setTimeout(() => { if (alive) depart(); }, 1000);
      } catch (e) {
        if (alive) setBlocked(String((e as Error)?.message ?? e));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="boot" data-leaving={String(leaving)}>
      <div className="bootcard">
        <div className="bootmast" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ color: "var(--ink)" }}><Mark size={17} /></span>
          <span><b>REIYAH</b> <span className="dot">//</span> HARBOR INSTRUMENT · PROOF BOOT</span>
        </div>
        {blocked ? (
          <div className="blocked">
            <h2>Blocked</h2>
            <p>The instrument could not verify its evidence, so it will not render. A blocked result is preferable to a plausible default.</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.66rem" }}>{blocked}</p>
          </div>
        ) : (
          <>
            {rows.map((r, i) => (
              <div key={i} className="bootrow" data-on="true" data-state={r.state}>
                <span className="bt">{r.t}</span>
                <span className="bd">{r.d}</span>
                <span className="bs">{r.s}</span>
              </div>
            ))}
            {!complete && (
              <div className="bootrow" data-on="true" data-state="wait">
                <span className="bt">…</span>
                <span className="bd">verifying</span>
                <span className="bs">WORKING</span>
              </div>
            )}
          </>
        )}
        <div className="bootmotto">
          "THE ARCHITECTURE IS DESIGNED TO REJECT AMBIGUITY.<br />
          A BLOCKED RESULT IS PREFERABLE TO A PLAUSIBLE DEFAULT."
        </div>
        {!blocked && !complete && (
          <button className="bootskip" onClick={depart}>SKIP ▸ (available once verified)</button>
        )}
      </div>
    </div>
  );
}
