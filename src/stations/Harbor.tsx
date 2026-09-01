/* HARBOR — THE LIVING ENGINE, brilliance pass.
   Two-layer canvas: a persistence layer (true motion trails) beneath a crisp
   layer (stations, eye, labels). Real artifacts ride a physical rail from the
   encounter, through the saccading eye and the six-kind chain, into the gate:
   known-bad fixtures spark red and fall; survivors stamp green and seal.
   Hover slows time so any packet's real path + digest can be read.
   Every moving thing is a committed byte. No mock data exists. */
import { useEffect, useRef } from "react";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import { Digest } from "../components/primitives";
import { fetchSurface } from "../lib/evidence";

interface ArtifactRow {
  artifact: { path: string; sha256: string };
  byte_size: number;
  role: string;
}

const TAU = Math.PI * 2;
const KINDS = ["OBS", "BEL", "DEC", "INT", "OUT", "EVD"];

interface Packet {
  a: ArtifactRow;
  t: number;
  speed: number;
  bad: boolean;
  fall: number;
  fx?: number; fy?: number; vx?: number; vy?: number;
  stamp: number;
  lane: number;
}
interface Spark { x: number; y: number; life: number }

export function Harbor({ ev, go, pulse }: { ev: VerifiedEvidence; go: (id: string) => void; pulse?: number }) {
  const trailRef = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef(0);
  useEffect(() => { if (pulse) pulseRef.current = performance.now(); }, [pulse]);
  /* the law behind each rejection: fixture path -> expected primary rule */
  const ruleRef = useRef<Map<string, string>>(new Map());
  const lastRejectRef = useRef<{ rule: string; at: number } | null>(null);
  useEffect(() => {
    fetchSurface<any>("fixtures").then((s) => {
      if (s.state === "observed") {
        const m = new Map<string, string>();
        for (const f of s.data.fixtures ?? []) if (f.expected_primary_rule_id) m.set(f.path, f.expected_primary_rule_id);
        ruleRef.current = m;
      }
    });
  }, []);

  const artifacts: ArtifactRow[] = ev.index?.artifacts ?? [];
  const auth = ev.index?.authority ?? {};
  const proj = ev.index?.candidate_projection ?? {};
  const badTotal = artifacts.filter((a) => a.role === "known_bad_fixture").length;

  useEffect(() => {
    const trailCv = trailRef.current, mainCv = mainRef.current;
    if (!trailCv || !mainCv || artifacts.length === 0) return;
    const tctx = trailCv.getContext("2d"), mctx = mainCv.getContext("2d");
    if (!tctx || !mctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mono = '11px "B612 Mono", monospace';
    const monoSmall = '9px "B612 Mono", monospace';

    /* ---- state ---- */
    let spawnIdx = 0, sealed = 0, spawnAcc = 0, blink = 0, raf = 0;
    let timeScale = 1, timeTarget = 1;
    const packets: Packet[] = [];
    const sparks: Spark[] = [];
    const nodeGlow = [0, 0, 0, 0, 0, 0];
    const pupil = { x: 0, y: 0 };
    const mouse = { x: -1, y: -1, over: false };

    const spawn = () => {
      const a = artifacts[spawnIdx % artifacts.length];
      spawnIdx++;
      const hh = parseInt(a.artifact.sha256.slice(9, 13), 16) / 0xffff;
      packets.push({
        a, t: 0, speed: 0.085 + hh * 0.05,
        bad: a.role === "known_bad_fixture",
        fall: 0, stamp: 0, lane: (hh - 0.5) * 2,
      });
    };
    for (let i = 0; i < 6; i++) { spawn(); packets[i].t = i * 0.15; }

    /* ghost field: the full committed population, dim, behind everything */
    let ghost: HTMLCanvasElement | null = null;
    let ghostKey = "";
    const buildGhost = (w: number, h: number, dpr: number, ink: string) => {
      ghost = document.createElement("canvas");
      ghost.width = w * dpr; ghost.height = h * dpr;
      const g = ghost.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const a of artifacts) {
        const hex = a.artifact.sha256.slice(9);
        const x = (parseInt(hex.slice(0, 5), 16) / 0xfffff) * w;
        const y = (parseInt(hex.slice(5, 10), 16) / 0xfffff) * h;
        g.fillStyle = `rgba(${ink},${a.role === "known_bad_fixture" ? 0.028 : 0.055})`;
        g.beginPath(); g.arc(x, y, 1, 0, TAU); g.fill();
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = mainCv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.over = true;
    };
    const onLeave = () => { mouse.over = false; };
    mainCv.addEventListener("pointermove", onMove);
    mainCv.addEventListener("pointerleave", onLeave);

    let last = performance.now();
    const draw = (now: number) => {
      const rdt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = mainCv.clientWidth, h = mainCv.clientHeight;
      for (const cv of [trailCv, mainCv]) {
        if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      }
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const dark = document.documentElement.dataset.ground === "dark";
      const INK = dark ? "255,255,255" : "16,18,21";
      const RED = dark ? "227,25,55" : "214,23,50";
      const OK = dark ? "143,208,176" : "23,114,76";
      const FADE = dark ? "rgba(10,11,14,0.22)" : "rgba(236,234,226,0.24)";
      const TA = dark ? "0.96" : "0.8"; // label ink: never dim on obsidian
      const surge = !!pulseRef.current && now - pulseRef.current < 2000;

      /* hover slows time: inspection is a first-class act */
      timeTarget = mouse.over ? 0.28 : 1;
      timeScale += (timeTarget - timeScale) * Math.min(1, rdt * 6);
      const dt = rdt * (reduced ? 0 : timeScale) * (surge ? 2 : 1);

      /* ---- layout: a physical rail with a gentle sag ---- */
      const midY = h * 0.46;
      const dip = h * 0.075;
      const x0 = w * 0.06, x2 = w * 0.9;
      const railPt = (t: number) => ({
        x: x0 + (x2 - x0) * t,
        y: (1 - t) * (1 - t) * midY + 2 * (1 - t) * t * (midY + dip) + t * t * midY,
      });
      const tEye = 0.18, tChain0 = 0.30, tChain1 = 0.62, tGate = 0.74;
      const eyeP = railPt(tEye), gateP = railPt(tGate);

      /* ---- ghost field (rebuilt on resize / ground flip) ---- */
      const key = `${w}x${h}x${dpr}x${dark}`;
      if (key !== ghostKey) { buildGhost(w, h, dpr, INK); ghostKey = key; }

      /* ================= TRAIL LAYER (persistence) ================= */
      tctx.fillStyle = FADE;
      tctx.fillRect(0, 0, w, h);
      if (reduced) tctx.clearRect(0, 0, w, h);

      /* packets ride the rail */
      spawnAcc += dt * 1.15;
      if (!reduced && spawnAcc > 0.5 && packets.length < 30) { spawnAcc = 0; spawn(); }
      let leading: Packet | null = null;
      let hovered: { p: Packet; x: number; y: number } | null = null;

      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        if (p.fall > 0 || (p.bad && p.t >= tGate)) {
          if (p.fall === 0) {
            /* the gate strikes: spark + eject with real physics */
            sparks.push({ x: gateP.x, y: gateP.y, life: 1 });
            const rule = ruleRef.current.get(p.a.artifact.path);
            if (rule) lastRejectRef.current = { rule, at: now };
            p.fx = gateP.x; p.fy = gateP.y;
            p.vx = 30 + Math.random() * 30; p.vy = 40;
          }
          p.fall += dt * 1.4;
          p.vy! += 640 * dt;
          p.fx! += p.vx! * dt; p.fy! += p.vy! * dt;
          const fa = Math.max(0, 1 - p.fall * 0.8);
          tctx.fillStyle = `rgba(${RED},${(0.9 * fa).toFixed(2)})`;
          tctx.beginPath(); tctx.arc(p.fx!, p.fy!, 2.8, 0, TAU); tctx.fill();
          if (p.fy! > h + 10 || p.fall > 1.6) packets.splice(i, 1);
          continue;
        }
        p.t += dt * p.speed;
        if (p.t >= 1) { sealed++; packets.splice(i, 1); continue; }
        const pt = railPt(p.t);
        const y = pt.y + Math.sin(p.t * 30) * 2 * p.lane;
        /* chain nodes light as the packet threads them */
        for (let k = 0; k < 6; k++) {
          const tN = tChain0 + (k / 5) * (tChain1 - tChain0);
          if (Math.abs(p.t - tN) < 0.006) nodeGlow[k] = 1;
        }
        if (Math.abs(p.t - tGate) < 0.012 && !p.bad) p.stamp = 1;
        p.stamp = Math.max(0, p.stamp - dt * 2.2);
        tctx.fillStyle = p.stamp > 0 ? `rgba(${OK},0.95)` : `rgba(${INK},${p.bad ? 0.4 : 0.88})`;
        tctx.beginPath(); tctx.arc(pt.x, y, p.bad ? 2.3 : 3, 0, TAU); tctx.fill();
        if (!leading || p.t > leading.t) leading = p;
        if (mouse.over) {
          const d = Math.hypot(mouse.x - pt.x, mouse.y - y);
          if (d < 26 && (!hovered || d < Math.hypot(mouse.x - hovered.x, mouse.y - hovered.y))) {
            hovered = { p, x: pt.x, y };
          }
        }
      }

      /* sparks at the gate */
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt * 2.4;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        tctx.strokeStyle = `rgba(${RED},${(s.life * 0.8).toFixed(2)})`;
        tctx.lineWidth = 1.5;
        tctx.beginPath(); tctx.arc(s.x, s.y, (1 - s.life) * 22 + 4, 0, TAU); tctx.stroke();
      }

      /* ================= CRISP LAYER ================= */
      mctx.clearRect(0, 0, w, h);
      if (ghost) mctx.drawImage(ghost, 0, 0, w, h);

      /* the rail itself */
      mctx.strokeStyle = `rgba(${INK},0.16)`;
      mctx.lineWidth = 1;
      mctx.beginPath();
      mctx.moveTo(x0, midY);
      mctx.quadraticCurveTo((x0 + x2) / 2, midY + dip * 2, x2, midY);
      mctx.stroke();

      mctx.font = monoSmall; mctx.textAlign = "center";

      /* encounter */
      const e0 = railPt(0);
      mctx.strokeStyle = `rgba(${INK},0.45)`; mctx.lineWidth = 1.2;
      mctx.beginPath();
      mctx.moveTo(e0.x - 22, e0.y + 38); mctx.lineTo(e0.x - 6, e0.y - 26);
      mctx.moveTo(e0.x + 22, e0.y + 38); mctx.lineTo(e0.x + 6, e0.y - 26);
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(e0.x, e0.y - 45); mctx.lineTo(e0.x + 7, e0.y - 38);
      mctx.lineTo(e0.x, e0.y - 31); mctx.lineTo(e0.x - 7, e0.y - 38);
      mctx.closePath(); mctx.stroke();
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.fillText("ENCOUNTER", e0.x, e0.y + 58);

      /* the eye: saccades toward the nearest approaching packet */
      blink = Math.max(0, blink - rdt);
      if (!reduced && Math.random() < rdt / 7) blink = 0.16;
      const eyeR = Math.min(30, w * 0.024);
      let target = { x: Math.cos(-TAU / 8) * eyeR * 0.18, y: Math.sin(-TAU / 8) * eyeR * 0.18 };
      let bestD = Infinity;
      for (const p of packets) {
        if (p.fall > 0 || p.t > tEye + 0.06) continue;
        const pt = railPt(p.t);
        const d = tEye - p.t;
        if (d >= 0 && d < bestD) {
          bestD = d;
          const ang = Math.atan2(pt.y - eyeP.y, pt.x - eyeP.x);
          target = { x: Math.cos(ang) * eyeR * 0.22, y: Math.sin(ang) * eyeR * 0.22 };
        }
      }
      pupil.x += (target.x - pupil.x) * Math.min(1, rdt * 14); /* saccade snap */
      pupil.y += (target.y - pupil.y) * Math.min(1, rdt * 14);
      mctx.save();
      mctx.translate(eyeP.x, eyeP.y);
      mctx.scale(1, blink > 0 ? Math.max(0.1, 1 - blink * 6) : 1);
      mctx.strokeStyle = `rgba(${INK},0.94)`;
      mctx.lineWidth = Math.max(3, eyeR * 0.24);
      mctx.lineCap = "round";
      mctx.beginPath();
      mctx.arc(0, 0, eyeR, -TAU / 8 + (25 * Math.PI) / 180, -TAU / 8 - (25 * Math.PI) / 180 + TAU);
      mctx.stroke();
      mctx.fillStyle = `rgba(${RED},0.95)`;
      mctx.beginPath(); mctx.arc(pupil.x, pupil.y, eyeR * 0.3 * (surge ? 1.25 : 1), 0, TAU); mctx.fill();
      mctx.restore();
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.fillText("REIYAH SEES", eyeP.x, eyeP.y + eyeR + 26);

      /* six kinds */
      for (let k = 0; k < 6; k++) {
        const tN = tChain0 + (k / 5) * (tChain1 - tChain0);
        const pN = railPt(tN);
        nodeGlow[k] = Math.max(0, nodeGlow[k] - rdt * 2.4);
        const gGlow = nodeGlow[k];
        mctx.strokeStyle = `rgba(${INK},${(0.45 + gGlow * 0.55).toFixed(2)})`;
        mctx.lineWidth = 1.2 + gGlow;
        mctx.beginPath(); mctx.arc(pN.x, pN.y, 5.5 + gGlow * 2.5, 0, TAU); mctx.stroke();
        mctx.fillStyle = `rgba(${INK},${TA})`;
        mctx.fillText(KINDS[k], pN.x, pN.y - 15 - gGlow * 2);
      }
      const midChain = railPt((tChain0 + tChain1) / 2);
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.fillText("SIX KINDS, NEVER MERGED", midChain.x, midChain.y + 58);

      /* the gate: bars close for an instant on every rejection */
      const closing = sparks.length > 0 ? 6 : 0;
      mctx.strokeStyle = `rgba(${INK},0.9)`;
      mctx.lineWidth = 2;
      mctx.beginPath();
      mctx.moveTo(gateP.x, gateP.y - 54); mctx.lineTo(gateP.x, gateP.y - 10 + closing);
      mctx.moveTo(gateP.x, gateP.y + 10 - closing); mctx.lineTo(gateP.x, gateP.y + 54);
      mctx.stroke();
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.fillText("THE GATE", gateP.x, gateP.y + 70);
      mctx.fillText("FAILS CLOSED", gateP.x, gateP.y + 82);
      mctx.fillStyle = `rgba(${RED},0.8)`;
      mctx.fillText(`↓ REJECTED BY DESIGN · ${badTotal}`, gateP.x, gateP.y + 100);
      const lr = lastRejectRef.current;
      if (lr && now - lr.at < 2800) {
        mctx.fillStyle = `rgba(${RED},${(0.85 * (1 - (now - lr.at) / 2800)).toFixed(2)})`;
        mctx.fillText(lr.rule, gateP.x, gateP.y + 114);
      }

      /* sealed ledger */
      const lP = railPt(1);
      const stackW = 46;
      const frac = Math.min(1, ((sealed % artifacts.length) / artifacts.length) + 0.15);
      mctx.strokeStyle = `rgba(${INK},0.4)`; mctx.lineWidth = 1;
      mctx.strokeRect(lP.x - stackW / 2 + 8, lP.y - 50, stackW, 100);
      mctx.fillStyle = `rgba(${INK},0.85)`;
      mctx.fillRect(lP.x - stackW / 2 + 8, lP.y + 50 - 100 * frac, stackW, 100 * frac);
      mctx.fillStyle = `rgba(${INK},${TA})`;
      mctx.fillText(`SEALED · ${artifacts.length}`, lP.x + 8, lP.y + 66);

      /* ticker: the leading packet's real identity */
      if (leading) {
        mctx.font = mono; mctx.textAlign = "right";
        mctx.fillStyle = `rgba(${INK},${TA})`;
        const label = `IN FLIGHT · ${leading.a.artifact.path} · ${leading.a.artifact.sha256.slice(0, 20)}…`;
        mctx.fillText(label.length > 96 ? "…" + label.slice(-94) : label, w - 16, 26);
        mctx.textAlign = "center";
      }

      /* hover: time slows; the packet under the cursor testifies */
      if (hovered) {
        mctx.strokeStyle = `rgba(${INK},0.9)`;
        mctx.lineWidth = 1;
        mctx.beginPath(); mctx.arc(hovered.x, hovered.y, 8, 0, TAU); mctx.stroke();
        const name = hovered.p.a.artifact.path.split("/").pop() ?? "";
        const sha = hovered.p.a.artifact.sha256.slice(7, 15);
        const tip = `${name} · ${sha} · ${hovered.p.bad ? "WILL BE REJECTED" : "WILL SEAL"}`;
        mctx.font = monoSmall; mctx.textAlign = "left";
        const tw = mctx.measureText(tip).width + 16;
        const tx = Math.min(w - tw - 8, hovered.x + 14), ty = hovered.y - 26;
        mctx.fillStyle = dark ? "rgba(5,5,7,0.85)" : "rgba(251,250,246,0.92)";
        mctx.strokeStyle = `rgba(${INK},0.25)`;
        mctx.beginPath(); mctx.roundRect(tx, ty, tw, 18, 5); mctx.fill(); mctx.stroke();
        mctx.fillStyle = hovered.p.bad ? `rgba(${RED},0.9)` : `rgba(${INK},0.85)`;
        mctx.fillText(tip, tx + 8, ty + 13);
        mctx.textAlign = "center";
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    if (reduced) requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      mainCv.removeEventListener("pointermove", onMove);
      mainCv.removeEventListener("pointerleave", onLeave);
    };
  }, [artifacts]);

  const authRows: Array<[string, string]> = [
    ["runtime_authorized", String(auth.runtime_authorized ?? "unknown").toUpperCase()],
    ["scientific_claim_authority", String(auth.scientific_claim_authority ?? "unknown").toUpperCase()],
    ["gate_b_authorized", String(auth.gate_b_authorized ?? "unknown").toUpperCase()],
    ["operator_acceptance", String(auth.operator_acceptance_state ?? "unknown").toUpperCase()],
    ["ga_17", String(auth.ga_17_state ?? "unknown").toUpperCase()],
    ["transport_verification", String(auth.transport_verification_state ?? "unknown").toUpperCase()],
  ];

  return (
      <div className="harbor">
        <div className="fieldwrap">
          <canvas ref={trailRef} aria-hidden="true" />
          <canvas ref={mainRef} aria-label={`Living diagram of the Reiyah engine processing ${artifacts.length} digest-verified artifacts`} />
          <div className="harbortitle">
            THE LIVING ENGINE · {artifacts.length.toLocaleString()} ARTIFACTS · {Number(proj.total_bytes ?? 0).toLocaleString()} BYTES · {badTotal} REJECTED BY DESIGN
          </div>
          <div className="fieldhud">
            <div className="fh">
              <Digest id="index" sha={ev.indexSha256} path="gate/GATE_A_EVIDENCE_INDEX.json" />
            </div>
            <div className="fh authwall" style={{ maxWidth: "34rem" }}>
              {authRows.map(([k, v]) => (
                <div key={k} className="authrow"><span>{k}</span><span className="st">{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
}
