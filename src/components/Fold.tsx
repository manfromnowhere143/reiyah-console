/* THE FOLD — the Merkle proof as a set piece. The sealed surfaces fold pair
   by pair into one root, live: every node drawn is a hash the browser just
   computed with WebCrypto, the pressed record's audit path is lit through
   the tree, and the root is written digit by digit as it is reached. The
   computation runs first; only its results are revealed, at a cinematic pace.
   Reduced motion draws the finished fold at once. A practical effect: nothing
   on screen the browser did not compute. */
import { useEffect, useRef } from "react";
import type { MerkleTree } from "../lib/merkle";

const hex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

export function Fold({ tree, leafId, verified }: { tree: MerkleTree; leafId: string; verified: boolean | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const L = tree.layers.length;
    const leaf = tree.leafIndex.get(leafId);
    /* the audit path: the node index at every layer, and its sibling */
    const onPath = new Set<string>(), sib = new Set<string>();
    if (leaf !== undefined) {
      let idx = leaf;
      for (let k = 0; k < L; k++) {
        onPath.add(`${k}:${idx}`);
        if (k < L - 1) { const s = idx % 2 === 1 ? idx - 1 : Math.min(idx + 1, tree.layers[k].length - 1); sib.add(`${k}:${s}`); }
        idx = Math.floor(idx / 2);
      }
    }
    const T = reduced ? 0 : 2400;
    const t0 = performance.now();
    let raf = 0;

    const draw = () => {
      const now = performance.now();
      const p = T === 0 ? 1 : Math.min(1, (now - t0) / T);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(draw); return; }
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const dark = document.documentElement.dataset.ground === "dark";
      const INK = dark ? "255,255,255" : "16,18,21";
      const LIT = verified === false ? (dark ? "227,25,55" : "214,23,50") : (dark ? "126,166,255" : "47,102,214");
      const mono = '9px "B612 Mono", Menlo, monospace';
      const top = 30, bottom = h - 14;
      const rowGap = L > 1 ? (bottom - top) / (L - 1) : 0;
      /* positions: leaves spread across the width; parents at their children's midpoint */
      const xs: number[][] = [];
      const n0 = tree.layers[0].length;
      xs[0] = tree.layers[0].map((_, i) => ((i + 0.5) / n0) * (w - 24) + 12);
      for (let k = 1; k < L; k++) {
        xs[k] = tree.layers[k].map((_, i) => {
          const a = xs[k - 1][2 * i], b = xs[k - 1][Math.min(2 * i + 1, xs[k - 1].length - 1)];
          return (a + b) / 2;
        });
      }
      const yOf = (k: number) => bottom - k * rowGap;
      /* the timeline: layer k (k >= 1) folds during its own window; windows overlap a little */
      const win = (k: number) => { const s = ((k - 1) / Math.max(1, L - 1)) * 0.78; return ease((p - s) / 0.3); };

      /* leaves: present from the start, small ticks; the pressed leaf and its sibling lit */
      for (let i = 0; i < n0; i++) {
        const key = `0:${i}`; const lit = onPath.has(key) || sib.has(key);
        ctx.fillStyle = lit ? `rgba(${LIT},0.95)` : `rgba(${INK},0.32)`;
        const s = lit ? 5 : 3.5;
        ctx.fillRect(xs[0][i] - s / 2, yOf(0) - s / 2, s, s);
      }
      /* folds */
      for (let k = 1; k < L; k++) {
        const u = win(k);
        if (u <= 0) continue;
        const y = yOf(k), yc = yOf(k - 1);
        for (let i = 0; i < tree.layers[k].length; i++) {
          const key = `${k}:${i}`; const lit = onPath.has(key) || sib.has(key);
          const x = xs[k][i];
          const c1 = xs[k - 1][2 * i], c2 = xs[k - 1][Math.min(2 * i + 1, xs[k - 1].length - 1)];
          /* the two children's lines rise to the parent */
          ctx.strokeStyle = lit ? `rgba(${LIT},${(0.75 * u).toFixed(3)})` : `rgba(${INK},${(0.22 * u).toFixed(3)})`;
          ctx.lineWidth = lit ? 1.2 : 0.8;
          for (const cx of [c1, c2]) {
            ctx.beginPath(); ctx.moveTo(cx, yc); ctx.lineTo(cx + (x - cx) * u, yc + (y - yc) * u); ctx.stroke();
          }
          if (u > 0.85) {
            const a = ease((u - 0.85) / 0.15);
            const s = lit ? 6 : 4;
            ctx.fillStyle = lit ? `rgba(${LIT},${a})` : `rgba(${INK},${(0.45 * a).toFixed(3)})`;
            ctx.fillRect(x - s / 2, y - s / 2, s, s);
            /* lit nodes carry the first hex digits of the hash they are; the
               label sits on the side with room, and only on the path itself */
            if (onPath.has(key) && k < L - 1 && a > 0.5) {
              ctx.fillStyle = `rgba(${LIT},${a})`; ctx.font = mono; ctx.textBaseline = "middle";
              const label = hex(tree.layers[k][i]).slice(0, 6);
              const right = x < w * 0.62;
              ctx.textAlign = right ? "left" : "right";
              ctx.fillText(label, right ? x + 7 : x - 7, y);
            }
          }
        }
      }
      /* the root, written digit by digit as it is reached */
      const ru = ease((p - 0.8) / 0.2);
      if (ru > 0) {
        const root = tree.rootHex;
        const shown = root.slice(0, Math.floor(ru * root.length));
        ctx.font = mono; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillStyle = `rgba(${INK},0.55)`;
        ctx.fillText(`ROOT · ${tree.leafCount} SURFACES · ${L - 1} HOPS`, w / 2, 2);
        ctx.fillStyle = `rgba(${LIT},1)`;
        const maxc = Math.max(16, Math.floor((w - 16) / 5.6));
        ctx.fillText(shown.length > maxc ? shown.slice(0, maxc - 1) + "…" : shown, w / 2, 13);
      }
      if (p < 1) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tree, leafId, verified]);

  return <canvas ref={ref} className="fold" aria-label="The sealed surfaces folding into one Merkle root, every hash computed in this browser" />;
}
