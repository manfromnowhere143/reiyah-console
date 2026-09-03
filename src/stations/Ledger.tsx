/* LEDGER — the evidence index, aggregated live from the verified bytes, on one
   screen. A stat strip, one stacked bar for where the bytes live, then the
   ranked roles and the media mix. Lists are measured, never scrolled: each
   renders exactly the rows its space can hold and says what it withheld. */
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { Digest, FitList, Station } from "../components/primitives";

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
  const roles = [...byRole.entries()].sort((a, b) => b[1].n - a[1].n);
  const maxN = roles[0]?.[1].n ?? 1;
  const media = [...byMedia.entries()].sort((a, b) => b[1] - a[1]);
  const byBytes = [...byRole.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
  const totalBytes = byBytes.reduce((s, [, v]) => s + v.bytes, 0) || 1;

  /* part-to-whole reads at a glance only up to six segments: the five heaviest
     roles keep their identity, everything else folds into "other" */
  const heavy = byBytes.slice(0, 5);
  const otherBytes = byBytes.slice(5).reduce((s, [, v]) => s + v.bytes, 0);
  const segments: Array<[string, number]> = [...heavy.map(([r, v]) => [r, v.bytes] as [string, number]), ["other", otherBytes]];
  const tone = (i: number) => `color-mix(in srgb, var(--ink) ${Math.max(12, 78 - i * 12)}%, transparent)`;
  const pct = (b: number) => Math.round((b / totalBytes) * 100);

  return (
    <Station id="ST–01" name="Ledger" sub="aggregated in this browser from the digest-verified index bytes">
      <div className="onepage">
        <div className="statstrip">
          <div className="stat"><span className="sl">artifacts</span><span className="sv">{artifacts.length.toLocaleString()}</span><span className="sd">rows in the canonical inventory</span></div>
          <div className="stat"><span className="sl">tracked bytes</span><span className="sv">{(Number(proj.total_bytes ?? 0) / 1e6).toFixed(2)}<em> MB</em></span><span className="sd">content-addressed, append-only</span></div>
          <div className="stat"><span className="sl">worktree</span><span className="sv sm">{String(proj.worktree_state ?? "unknown").toUpperCase()}</span><span className="sd">commit {String(proj.git_commit ?? "").slice(0, 12)}</span></div>
          <div className="stat statwide"><span className="sl">index digest</span><div style={{ marginTop: "0.28rem" }}><Digest id="index" sha={ev.indexSha256} path="gate/GATE_A_EVIDENCE_INDEX.json" /></div></div>
        </div>

        <div className="ipanel" style={{ flex: "none" }}>
          <div className="ilabel">where the {(totalBytes / 1e6).toFixed(2)} MB lives · by role · derived live</div>
          <div className="stackbar" role="img" aria-label="Byte allocation by role">
            {segments.map(([role, b], i) => (
              <div key={role} className="seg" title={`${role} · ${(b / 1e6).toFixed(2)} MB · ${pct(b)}%`}
                style={{ flex: b, background: tone(i) }} />
            ))}
          </div>
          <div className="stacklegend">
            {segments.map(([role, b], i) => (
              <span key={role}><i style={{ background: tone(i) }} />{role} · {pct(b)}%</span>
            ))}
          </div>
        </div>

        <div className="grid2 fillgrid">
          <div className="ipanel fillpanel">
            <div className="ilabel">roles · {byRole.size} distinct · ranked by count</div>
            <FitList
              items={roles}
              render={([role, { n }]) => (
                <div key={role} className="bar">
                  <span className="bk">{role}</span>
                  <span className="bt"><span className="bf" style={{ width: `${(n / maxN) * 100}%` }} /></span>
                  <span className="bn">{n.toLocaleString()}</span>
                </div>
              )}
              more={(k) => <>+ {k} more roles, all counted above</>}
            />
          </div>
          <div className="ipanel fillpanel">
            <div className="ilabel">media · {media.length} types</div>
            <FitList
              items={media}
              render={([m, n]) => (
                <div key={m} className="bar">
                  <span className="bk">{m}</span>
                  <span className="bt"><span className="bf" style={{ width: `${(n / artifacts.length) * 100}%` }} /></span>
                  <span className="bn">{n.toLocaleString()}</span>
                </div>
              )}
              more={(k) => <>+ {k} more media types</>}
            />
          </div>
        </div>
      </div>
    </Station>
  );
}
