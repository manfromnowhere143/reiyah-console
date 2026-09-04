/* ST-01 · LEDGER — THE BYTE SKYLINE. Every one of the index's artifacts is a
   point on one line: sorted by role, then by size, its height the log of its
   bytes. Role bands are shaded and named where they are wide enough to carry
   a name. A slow cursor sweeps the skyline reading the exact record under it;
   hover or touch takes the cursor. Aggregated in this browser from the
   digest-verified index bytes; nothing here is a placeholder. */
import { useEffect, useRef, useState } from "react";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { Digest, FitList, Stat, Station } from "../components/primitives";
import { getAt, setAt } from "../lib/urlstate";

interface Row { artifact: { path: string; sha256: string }; byte_size: number; role: string; media_type: string }

export function Ledger({ ev }: { ev: VerifiedEvidence }) {
  const artifacts: Row[] = ev.index?.artifacts ?? [];
  const proj = ev.index?.candidate_projection ?? {};
  const IDX = [{ id: "index", path: "gate/GATE_A_EVIDENCE_INDEX.json", sha256: ev.indexSha256 }];

  const byRole = new Map<string, { n: number; bytes: number }>();
  const byMedia = new Map<string, number>();
  for (const a of artifacts) {
    const r = byRole.get(a.role) ?? { n: 0, bytes: 0 };
    r.n += 1; r.bytes += a.byte_size;
    byRole.set(a.role, r);
    byMedia.set(a.media_type, (byMedia.get(a.media_type) ?? 0) + 1);
  }
  const roles = [...byRole.entries()].sort((a, b) => b[1].n - a[1].n);
  const rank = new Map(roles.map(([r], i) => [r, i]));
  const maxN = roles[0]?.[1].n ?? 1;
  const byBytes = [...byRole.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
  const totalBytes = byBytes.reduce((s, [, v]) => s + v.bytes, 0) || 1;
  const heavy = byBytes.slice(0, 5);
  const otherBytes = byBytes.slice(5).reduce((s, [, v]) => s + v.bytes, 0);
  const segments: Array<[string, number]> = [...heavy.map(([r, v]) => [r, v.bytes] as [string, number]), ["other", otherBytes]];
  const tone = (i: number) => `color-mix(in srgb, var(--ink) ${Math.max(12, 78 - i * 12)}%, transparent)`;
  const pct = (b: number) => Math.round((b / totalBytes) * 100);

  /* the skyline order: role by count, then bytes descending inside the role */
  const sorted = [...artifacts].sort((a, b) => (rank.get(a.role)! - rank.get(b.role)!) || (b.byte_size - a.byte_size));
  const n = sorted.length;

  const cvRef = useRef<HTMLCanvasElement>(null);
  const [cur, setCur] = useState(() => { const a = getAt(); const i = a ? sorted.findIndex((x) => x.artifact.path === a) : -1; return i >= 0 ? i : 0; });
  const [hover, setHover] = useState<number | null>(() => { const a = getAt(); const i = a ? sorted.findIndex((x) => x.artifact.path === a) : -1; return i >= 0 ? i : null; });
  const at = sorted[hover ?? cur];

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || hover !== null || n === 0) return;
    const step = Math.max(1, Math.round(n / 90));
    const t = setInterval(() => setCur((c) => (c + step) % n), 700);
    return () => clearInterval(t);
  }, [hover, n]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || n === 0) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const lmax = Math.log(Math.max(...sorted.map((a) => a.byte_size || 1)) + 1);
    const lmin = Math.log(Math.max(1, Math.min(...sorted.map((a) => a.byte_size || 1))) + 1);
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w === 0 || h === 0) return;
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const dark = document.documentElement.dataset.ground === "dark";
      const INK = dark ? "255,255,255" : "16,18,21";
      const RED = dark ? "227,25,55" : "214,23,50";
      const base = h - 16, top = 14;
      const xOf = (i: number) => (i / n) * w;
      const yOf = (b: number) => base - (top < base ? (base - top) * ((Math.log((b || 1) + 1) - lmin) / Math.max(1e-9, lmax - lmin)) : 0);
      /* a real log scale: gridlines at every power of ten between the smallest
         and the largest artifact, labelled, so height is readable, not felt */
      ctx.font = '8px "B612 Mono", Menlo, monospace'; ctx.textBaseline = "middle"; ctx.textAlign = "right";
      for (let p = 1; p <= 8; p++) {
        const v = Math.pow(10, p);
        const y = yOf(v);
        if (y <= top || y >= base) continue;
        ctx.strokeStyle = `rgba(${INK},0.09)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); ctx.stroke();
        ctx.fillStyle = `rgba(${INK},0.45)`;
        ctx.fillText(v >= 1e6 ? `${v / 1e6} MB` : v >= 1e3 ? `${v / 1e3} KB` : `${v} B`, w - 4, y - 6);
      }
      /* role bands, alternately shaded, named when wide enough */
      let start = 0;
      ctx.font = '8px "B612 Mono", Menlo, monospace'; ctx.textBaseline = "top";
      for (let i = 1; i <= n; i++) {
        if (i === n || sorted[i].role !== sorted[start].role) {
          const x0 = xOf(start), x1 = xOf(i);
          const band = rank.get(sorted[start].role)! % 2 === 0;
          const rejected = sorted[start].role === "known_bad_fixture";
          if (rejected) { ctx.fillStyle = `rgba(${RED},${dark ? 0.07 : 0.05})`; ctx.fillRect(x0, 0, x1 - x0, h); }
          else if (band) { ctx.fillStyle = `rgba(${INK},${dark ? 0.045 : 0.035})`; ctx.fillRect(x0, 0, x1 - x0, h); }
          const label = sorted[start].role.replace(/_/g, " ");
          if (x1 - x0 > ctx.measureText(label).width + 10) { ctx.fillStyle = `rgba(${INK},0.55)`; ctx.textAlign = "left"; ctx.fillText(label, x0 + 5, 2); }
          start = i;
        }
      }
      /* the skyline */
      ctx.beginPath(); ctx.moveTo(0, base);
      for (let i = 0; i < n; i++) { const y = yOf(sorted[i].byte_size); ctx.lineTo(xOf(i), y); ctx.lineTo(xOf(i + 1), y); }
      ctx.lineTo(w, base); ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, base);
      g.addColorStop(0, `rgba(${INK},${dark ? 0.55 : 0.5})`); g.addColorStop(1, `rgba(${INK},${dark ? 0.12 : 0.1})`);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = `rgba(${INK},0.35)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.stroke();
      /* the cursor */
      const i = hover ?? cur;
      const cx = xOf(i + 0.5), cy = yOf(sorted[i].byte_size);
      const bad = sorted[i].role === "known_bad_fixture";
      ctx.strokeStyle = `rgba(${bad ? RED : INK},0.7)`;
      ctx.beginPath(); ctx.moveTo(cx, top - 4); ctx.lineTo(cx, base); ctx.stroke();
      ctx.fillStyle = `rgba(${bad ? RED : INK},1)`;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
      /* the exact reading, on a ground plate beside the cursor */
      const label = `${Number(sorted[i].byte_size).toLocaleString()} B`;
      ctx.font = '9px "B612 Mono", Menlo, monospace'; ctx.textBaseline = "middle";
      const tw = ctx.measureText(label).width + 10;
      const lx = cx + 10 + tw > w ? cx - 10 - tw : cx + 10;
      const ly = Math.max(top + 8, Math.min(base - 8, cy));
      ctx.fillStyle = dark ? "rgba(5,5,7,0.82)" : "rgba(244,243,238,0.88)";
      ctx.beginPath(); ctx.roundRect(lx, ly - 8, tw, 16, 4); ctx.fill();
      ctx.fillStyle = `rgba(${bad ? RED : INK},0.95)`; ctx.textAlign = "left";
      ctx.fillText(label, lx + 5, ly);
    };
    draw();
    const ro = new ResizeObserver(draw); ro.observe(cv);
    const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ground"] });
    return () => { ro.disconnect(); mo.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, hover, n]);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
    setHover(i); setAt(sorted[i]?.artifact.path ?? null);
  };

  return (
    <Station id="ST–01" name="Ledger" sub="aggregated in this browser from the digest-verified index bytes">
      <div className="onepage">
        <div className="statstrip">
          <Stat label="artifacts" value={artifacts.length.toLocaleString()} sub={`${byRole.size} roles · ${byMedia.size} media types`}
            rule="count of rows in the evidence index's artifacts array; roles and media types are the distinct values of each row's role and media_type" from={IDX} />
          <Stat label="tracked bytes" value={<>{(Number(proj.total_bytes ?? 0) / 1e6).toFixed(2)}<em> MB</em></>} sub="content-addressed, append-only"
            rule="candidate_projection.total_bytes of the evidence index, shown in megabytes to two decimals" from={IDX} />
          <Stat label="worktree" value={String(proj.worktree_state ?? "unknown").toUpperCase()} small sub={`commit ${String(proj.git_commit ?? "").slice(0, 12)}`}
            rule="candidate_projection.worktree_state and candidate_projection.git_commit of the evidence index, as recorded at index generation" from={IDX} />
          <Stat label="index digest" wide rule="SHA-256 of the index bytes, recomputed in this browser at boot and required to equal the committed sidecar before anything rendered" from={IDX}>
            <div style={{ marginTop: "0.28rem" }}><Digest id="index" sha={ev.indexSha256} path="gate/GATE_A_EVIDENCE_INDEX.json" /></div>
          </Stat>
        </div>

        <div className="stackrow">
          <div className="stackbar" role="img" aria-label="Byte allocation by role">
            {segments.map(([role, b], i) => (
              <div key={role} className="seg" title={`${role} · ${(b / 1e6).toFixed(2)} MB · ${pct(b)}%`} style={{ flex: b, background: tone(i) }} />
            ))}
          </div>
          <div className="stacklegend">
            {segments.map(([role, b], i) => <span key={role}><i style={{ background: tone(i) }} />{role.replace(/_/g, " ")} · {pct(b)}%</span>)}
          </div>
        </div>

        <div className="grid2 fillgrid skygrid">
          <div className="skywrap">
            <div className="ilabel">the byte skyline · every artifact, by role then size · height = log bytes</div>
            <canvas ref={cvRef} className="sky" onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => setHover(null)}
              aria-label="Skyline of every artifact's byte size, grouped by role" />
            <div className="skycap" aria-live="polite">
              <span className="wcidx">{(hover ?? cur) + 1} / {n}</span>
              <span className="wcpath">{at?.artifact.path}</span>
              <span className="skymeta">{at?.role.replace(/_/g, " ")} · {Number(at?.byte_size ?? 0).toLocaleString()} B · {String(at?.artifact.sha256 ?? "").slice(7, 19)}</span>
            </div>
          </div>
          <div className="ipanel fillpanel">
            <div className="ilabel">roles · {byRole.size} distinct · ranked by count</div>
            <FitList
              items={roles}
              render={([role, { n: k }]) => (
                <div key={role} className="bar">
                  <span className="bk">{role}</span>
                  <span className="bt"><span className="bf" style={{ width: `${(k / maxN) * 100}%` }} /></span>
                  <span className="bn">{k.toLocaleString()}</span>
                </div>
              )}
              more={(k) => <>+ {k} more roles, all on the skyline</>}
            />
          </div>
        </div>
      </div>
    </Station>
  );
}
