/* The ground toggle. Paper by default; obsidian for the night watch.
   Persisted per operator, restored before first paint by the inline script
   in index.html, committed through a View Transition where available. */
import { useState } from "react";

type Ground = "light" | "dark";

function apply(g: Ground) {
  document.documentElement.dataset.ground = g;
  try { localStorage.setItem("harbor-ground", g); } catch { /* preference is a convenience */ }
  const m = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (m) m.content = g === "dark" ? "#050507" : "#f4f3ee";
}

export function GroundToggle() {
  const [ground, setGround] = useState<Ground>(() =>
    document.documentElement.dataset.ground === "dark" ? "dark" : "light"
  );
  const flip = () => {
    const next: Ground = ground === "dark" ? "light" : "dark";
    const commit = () => { apply(next); setGround(next); };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const svt = (document as any).startViewTransition?.bind(document);
    if (!reduced && svt) svt(commit);
    else commit();
  };
  return (
    <button
      className="groundtoggle"
      onClick={flip}
      aria-pressed={ground === "dark"}
      aria-label={ground === "dark" ? "Switch to paper ground" : "Switch to obsidian ground"}
      title={ground === "dark" ? "Paper" : "Obsidian"}
    >
      <span className="half" aria-hidden="true" />
    </button>
  );
}
