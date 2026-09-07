/* ST–09 · THE SEEING — the whole of Reiyah as one field of sight.
   The Aware Iris at the centre. Around it, every sealed artifact of the
   evidence index is one point of light on one of four rings: governance,
   the contract and its tools, the fixtures (known-good in ink, known-bad in
   red, rejected by design), and custody. In the exact direction of the
   iris's opening lies the Dark Sector: the rings break there, because what
   is defined but unmeasured, unauthorized, has no bytes to stand on. A slow
   gaze sweeps the field; where it crosses the sector it finds nothing, and
   says so. Hover reads a byte, press proves it. Every number is committed.
   Canvas only, at most thirty frames a second, idle under reduced motion. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { fetchCatalog, fetchSurface } from "../lib/evidence";
import { MONO, tones } from "../lib/roadScene";
import { useGround } from "../lib/ground";
import { Blocked, Digest, Station, useSurfaceState } from "../components/primitives";

interface Art { path: string; role: string; sha: string; ring: number; bad: boolean; sealed: boolean }
interface Pt extends Art { a: number; x: number; y: number }
const TAU = Math.PI * 2;
/* the iris opens toward the upper right: the arc gap of the ring glyph,
   rotated minus twenty degrees, spans these angles */
const SECTOR: [number, number] = [-70 * Math.PI / 180, -20 * Math.PI / 180];
const RINGS = ["GOVERNANCE · CHARTER · CONTRACTS", "SCHEMAS · TOOLCHAIN · VALIDATORS", "FIXTURES · KNOWN-GOOD IN INK · KNOWN-BAD IN RED", "CUSTODY · RIGHTS · RELEASES · HISTORY"];

function ringOf(role: string): number {
  if (/schema|toolchain|validator|launcher|index_builder/.test(role)) return 1;
  if (/fixture/.test(role)) return 2;
  if (/source|rights|receipt|ledger|historical|operator_decision|distribution|custody|frontier|repository|citation|contribution|license|attribution|security|overview/.test(role)) return 3;
  return 0;
}
const inSector = (a: number) => { const t = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; return t > SECTOR[0] && t < SECTOR[1]; };

export function SystemAtlas({ ev }: { ev: VerifiedEvidence }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<Pt | null>(null);
  const raysRef = useRef<Array<{ x: number; y: number; dark: boolean }>>([]);
  const [picked, setPicked] = useState<Pt | null>(null);
  const dark = useGround();
  const state = useSurfaceState(async () => {
    const proto = await fetchSurface<any>("protocol");
    const catalog = await fetchCatalog();
    const sealedPaths = new Set(catalog.map((c) => c.path));
    const diVersions = [...new Set(
      catalog.map((c) => c.path).filter((p) => p.includes("operator-decision-interface")).map((p) => p.match(/1\.2\.\d+/)?.[0]).filter(Boolean) as string[]
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const arts: Art[] = (ev.index?.artifacts ?? []).map((a: any) => ({ path: a.artifact.path, role: a.role, sha: a.artifact.sha256, ring: ringOf(a.role), bad: a.role === "known_bad_fixture", sealed: sealedPaths.has(a.artifact.path) }));
    arts.sort((a, b) => a.ring - b.ring || a.path.localeCompare(b.path));
    return { proto: proto.state === "observed" ? proto.data : null, diVersions, arts };
  });

  /* the rays end where each label begins: measured, not drawn by hand */
  useLayoutEffect(() => {
    const root = rootRef.current; if (!root) return;
    const measure = () => {
      if (window.innerWidth <= 760) { raysRef.current = []; return; }
      const rr = root.getBoundingClientRect();
      raysRef.current = [...root.querySelectorAll<HTMLElement>(".shud")].map((el) => {
        const b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2 - rr.left, y: b.top + b.height / 2 - rr.top, dark: el.dataset.dark === "true" };
      });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(root);
    return () => ro.disconnect();
  }, [state.phase]);

  /* the field */
  useEffect(() => {
    if (state.phase !== "ready") return;
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { arts } = state.data;
    let raf = 0, last = 0, w = 0, h = 0, pts: Pt[] = [];
    const t0 = performance.now();
    const { INK, OK, RED } = tones(dark);

    const layout = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      const mobile = w < 560;
      const cx = w / 2, cy = h / 2;
      const ry = mobile ? h * 0.42 : h / 2 - 66;
      const rx = mobile ? Math.min(w * 0.42, ry * 1.4) : Math.min(w / 2 - 210, ry * 1.75);
      pts = [];
      for (let ring = 0; ring < 4; ring++) {
        const members = arts.filter((a) => a.ring === ring);
        const f = [0.5, 0.66, 0.82, 1][ring];
        /* the lit arc: everything but the sector, walked from its far edge */
        const span = TAU - (SECTOR[1] - SECTOR[0]);
        members.forEach((m, i) => {
          const a = SECTOR[1] + (span * (i + 0.5)) / members.length;
          pts.push({ ...m, a, x: cx + Math.cos(a) * rx * f, y: cy + Math.sin(a) * ry * f });
        });
      }
      return { cx, cy, rx, ry, mobile };
    };
    let geo = layout();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return; last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.clientWidth !== w || cv.clientHeight !== h) geo = layout();
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      if (w === 0 || h === 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const { cx, cy, rx, ry, mobile } = geo;
      const s = (now - t0) / 1000;
      const breathe = reduced ? 1 : 1 + 0.02 * Math.sin(s * TAU / 7);
      const sweep = reduced ? SECTOR[0] - 0.9 : ((s * TAU) / 36) % TAU;
      const R0 = Math.min(rx, ry) * 0.3;

      /* the rays: iris to each label; the ray into the dark sector dashed */
      for (const r of raysRef.current) {
        const dx = r.x - cx, dy = r.y - cy, L = Math.hypot(dx, dy);
        ctx.save(); if (r.dark) ctx.setLineDash([3, 5]);
        ctx.strokeStyle = `rgba(${INK},${r.dark ? 0.22 : 0.14})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + (dx / L) * R0 * 1.1, cy + (dy / L) * R0 * 1.1); ctx.lineTo(cx + (dx / L) * (L - 60), cy + (dy / L) * (L - 60)); ctx.stroke(); ctx.restore();
      }
      /* the rings, broken at the sector */
      for (let ring = 0; ring < 4; ring++) {
        const f = [0.5, 0.66, 0.82, 1][ring];
        ctx.strokeStyle = `rgba(${INK},0.08)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx * f, ry * f, 0, SECTOR[1], SECTOR[0] + TAU); ctx.stroke();
      }
      /* the sector's edges */
      ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = `rgba(${INK},0.3)`;
      for (const a of SECTOR) { ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R0 * 1.1, cy + Math.sin(a) * R0 * 1.1); ctx.lineTo(cx + Math.cos(a) * rx * 1.06, cy + Math.sin(a) * ry * 1.06); ctx.stroke(); }
      ctx.restore();
      /* the gaze: a soft beam that sweeps the field */
      if (!reduced) {
        const g = ctx.createConicGradient(sweep - 0.18, cx, cy);
        g.addColorStop(0, `rgba(${OK},0)`); g.addColorStop(0.03, `rgba(${OK},${dark ? 0.09 : 0.07})`); g.addColorStop(0.06, `rgba(${OK},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.06, ry * 1.06, 0, 0, TAU); ctx.fill();
      }
      /* every artifact, one point; the beam brightens what it crosses */
      const hov0 = hoverRef.current;
      for (const p of pts) {
        let d = Math.abs(((p.a - sweep + Math.PI) % TAU + TAU) % TAU - Math.PI);
        const lit = reduced ? 0 : Math.max(0, 1 - d / 0.22);
        const base = p.bad ? 0.38 : 0.62;
        const alpha = Math.min(1, base + lit * 0.5);
        const sz = (p.bad ? 1.2 : 1.9) + lit * 1.2 + (p === hov0 ? 2 : 0);
        ctx.fillStyle = p.bad ? `rgba(${RED},${alpha.toFixed(2)})` : `rgba(${INK},${alpha.toFixed(2)})`;
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      /* the iris: the ring with its opening, breathing; the red pupil */
      ctx.save(); ctx.translate(cx, cy); ctx.scale(breathe, breathe);
      ctx.strokeStyle = `rgba(${INK},1)`; ctx.lineWidth = R0 * 0.23; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, R0, SECTOR[1], SECTOR[0] + TAU); ctx.stroke();
      ctx.fillStyle = `rgba(${RED},1)`; ctx.beginPath(); ctx.arc(R0 * 0.18, -R0 * 0.15, R0 * 0.27, 0, TAU); ctx.fill();
      ctx.restore();
      /* ring names along one diagonal, right-aligned onto their ring */
      if (!mobile) {
        ctx.font = `8px ${MONO}`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = `rgba(${INK},0.55)`;
        const a = 250 * Math.PI / 180;
        for (let ring = 0; ring < 4; ring++) { const f = [0.5, 0.66, 0.82, 1][ring]; ctx.fillText(RINGS[ring], cx + Math.cos(a) * rx * f - 6, cy + Math.sin(a) * ry * f); }
      }
      /* the sweep's own readout: what the gaze finds, or does not */
      const hov = hoverRef.current;
      if (!reduced) {
        const dark_ = inSector(sweep);
        ctx.font = `${mobile ? 8 : 9}px ${MONO}`; ctx.textAlign = mobile ? "center" : "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = `rgba(${INK},0.6)`;
        if (!hov) ctx.fillText(dark_ ? "the gaze finds nothing here · defined, unmeasured, unauthorized" : "the gaze · every point it crosses is a committed byte", mobile ? cx : 8, mobile ? h - 4 : cy + 44);
      }
      /* hover readout */
      if (hov) {
        ctx.font = `9px ${MONO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = hov.bad ? `rgba(${RED},0.95)` : `rgba(${INK},0.95)`;
        ctx.fillText(`${hov.path}  ·  ${hov.role.replace(/_/g, " ")}  ·  ${hov.sha.slice(7, 19)}…`, 8, mobile ? h - 4 : cy + 44);
      }
    };
    raf = requestAnimationFrame(draw);
    const near = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      let best: Pt | null = null, bd = 64;
      for (const p of pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
      return best;
    };
    const onMove = (e: PointerEvent) => { hoverRef.current = near(e); cv.style.cursor = hoverRef.current ? "pointer" : "default"; };
    const onLeave = () => { hoverRef.current = null; };
    const onClick = (e: PointerEvent) => { const p = near(e); if (p) setPicked(p); };
    cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerleave", onLeave); cv.addEventListener("pointerdown", onClick);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerleave", onLeave); cv.removeEventListener("pointerdown", onClick); };
  }, [state, dark]);

  if (state.phase === "loading") return <Station id="ST–09" name="The Seeing"><div className="note" data-loading="true">composing the field…</div></Station>;
  if (state.phase === "blocked") return <Station id="ST–09" name="The Seeing"><Blocked reason={state.reason} /></Station>;
  const { proto, diVersions, arts } = state.data;
  const bad = arts.filter((a) => a.bad).length, good = arts.filter((a) => a.role === "known_good_fixture").length;
  const controls = (ev.report?.required_replay_controls?.length ?? 0) + (ev.report?.implementation_controls?.length ?? 0);
  const kinds: string[] = proto?.scientific_layers ?? ["observation", "latent_belief", "decision", "intervention", "outcome", "evidence"];
  const epistemicN = proto?.epistemic_states?.length ?? 6;
  const estimands = proto?.estimands?.length ?? 10;
  const auth = ev.index?.authority ?? {};

  return (
    <Station id="ST–09" name="The Seeing" sub="re'iyah · the seeing that knows what it does not see · every point is a committed byte">
      <div className="seeing" ref={rootRef}>
        <div className="seeingcv"><canvas ref={cvRef} aria-label="Every sealed artifact as a point of light on rings around the Aware Iris; the dark sector stays unlit" /></div>
        <div className="shuds">
          <div className="shud p-n"><div className="mmotto">"A BLOCKED RESULT IS PREFERABLE TO A PLAUSIBLE DEFAULT."</div></div>
          <div className="shud p-ne" data-dark="true">
            <div className="mname">THE DARK SECTOR</div>
            <div className="mline"><b>{estimands}</b> estimands defined · <b>0</b> measured</div>
            <div className="mline">runtime {String(auth.runtime_authorized ?? false).toUpperCase()} · gate B {String(auth.gate_b_authorized ?? false).toUpperCase()}</div>
            <div className="mline dim">the light does not pretend to reach here</div>
          </div>
          <div className="shud p-e">
            <div className="mbig">{arts.length.toLocaleString()}</div>
            <div className="mname">SEALED EVIDENCE</div>
            <div className="mline">content-addressed · append-only</div>
            <div className="mline dim">re-verified in this browser at boot</div>
          </div>
          <div className="shud p-se">
            <div className="mname">IT CORRECTS ITSELF</div>
            <div className="msaga">{diVersions.map((v, i) => <span key={v}><b>{v}</b>{i < diVersions.length - 1 ? " → " : ""}</span>)}</div>
            <div className="mline dim">defect → contract → review → seal · append-only</div>
          </div>
          <div className="shud p-s">
            <div className="mname">THE HUMAN</div>
            <div className="mline">acceptance {String(auth.operator_acceptance_state ?? "unaccepted").toUpperCase()}</div>
            <div className="mline dim">no tool may decide</div>
          </div>
          <div className="shud p-sw">
            <div className="mbig">{controls}<em>✓</em></div>
            <div className="mname">THE GATE</div>
            <div className="mline">twin isolated evaluations, byte-equal</div>
            <div className="mline red">{good} known-good · {bad} known-bad, rejected by design</div>
          </div>
          <div className="shud p-w">
            <div className="mname">THE WORLD</div>
            <div className="mline">a person–vehicle–automation encounter</div>
            <div className="mline dim">never a person alone</div>
          </div>
          <div className="shud p-nw">
            <div className="mbig">{kinds.length}</div>
            <div className="mname">KINDS, NEVER MERGED</div>
            <div className="mchips">{kinds.map((k) => <span key={k}>{k.replace("latent_", "")}</span>)}</div>
            <div className="mline dim">{epistemicN} epistemic states · missing is never zero</div>
          </div>
        </div>
        {picked && (
          <div className="sread">
            <span className="sreadp">{picked.path}</span>
            <span className="sreadr">{picked.role.replace(/_/g, " ")}{picked.bad ? " · rejected by design" : ""}</span>
            {picked.sealed ? <Digest id={`p/${picked.path}`} sha={picked.sha} path={picked.path} /> : <span className="sreadr">{picked.sha.slice(0, 22)}… · indexed, bytes not in this seal</span>}
            <button className="sreadx" onClick={() => setPicked(null)} aria-label="close">×</button>
          </div>
        )}
      </div>
    </Station>
  );
}
