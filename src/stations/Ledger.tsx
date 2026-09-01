/* LEDGER — the evidence index, aggregated live from the verified bytes. */
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { Digest, Station } from "../components/primitives";

export function Ledger({ ev }: { ev: VerifiedEvidence }) {
  const artifacts: Array<{ artifact: { path: string; sha256: string }; byte_size: number; role: string; media_type: string }> =
    ev.index?.artifacts ?? [];
  const proj = ev.index?.candidate_projection ?? {};

  const byRole = new Map<string, { n: number; bytes: number }>();
  const byMedia = new Map<string, number>();
  for (const a of artifacts) {
    const r = byRole.get(a.role) ?? { n: 0, bytes: 0 };
    r.n += 1; r.bytes += a.byte_size;
    byRole.set(a.role, r);
    byMedia.set(a.media_type, (byMedia.get(a.media_type) ?? 0) + 1);
  }
  const roles = [...byRole.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  const maxN = roles[0]?.[1].n ?? 1;
  const media = [...byMedia.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Station id="ST–01" name="Ledger" sub="aggregated in this browser from the digest-verified index bytes">
      <div className="grid3" style={{ marginBottom: "1rem" }}>
        <div className="ipanel"><div className="ilabel">artifacts</div><div className="big">{artifacts.length.toLocaleString()}</div><div className="sub">rows in the canonical inventory</div></div>
        <div className="ipanel"><div className="ilabel">tracked bytes</div><div className="big">{(Number(proj.total_bytes ?? 0) / 1e6).toFixed(2)}<em> MB</em></div><div className="sub">content-addressed, append-only</div></div>
        <div className="ipanel"><div className="ilabel">worktree</div><div className="big" style={{ fontSize: "1.1rem" }}>{String(proj.worktree_state ?? "unknown").toUpperCase()}</div><div className="sub">commit {String(proj.git_commit ?? "").slice(0, 12)}</div></div>
        <div className="ipanel"><div className="ilabel">index digest</div><div style={{ marginTop: "0.2rem" }}><Digest id="index" sha={ev.indexSha256} path="gate/GATE_A_EVIDENCE_INDEX.json" /></div><div className="sub">press to reprove in this browser</div></div>
      </div>

      <div className="ipanel" style={{ marginBottom: "0.8rem" }}>
        <div className="ilabel">roles · top {roles.length} of {byRole.size}</div>
        {roles.map(([role, { n }]) => (
          <div key={role} className="bar">
            <span className="bk">{role}</span>
            <span className="bt"><span className="bf" style={{ width: `${(n / maxN) * 100}%` }} /></span>
            <span className="bn">{n.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="ipanel">
        <div className="ilabel">media</div>
        {media.map(([m, n]) => (
          <div key={m} className="bar">
            <span className="bk">{m}</span>
            <span className="bt"><span className="bf" style={{ width: `${(n / artifacts.length) * 100}%` }} /></span>
            <span className="bn">{n.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Station>
  );
}
