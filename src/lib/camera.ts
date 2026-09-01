/* The camera. One world, nine cells, damped flight.
   Motion law: damped for mass (critically-damped rAF interpolation, the
   Jarvis manner — state is interpolated in the render loop, never toggled).
   The scale dips with remaining distance, giving the zoom-out-and-land arc
   of a ZUI without any timeline. Reduced motion: jump cuts. */
import { useEffect, useRef, useState } from "react";

export interface StationDef {
  id: string;
  num: string;
  name: string;
  desc: string;
  row: number;
  col: number;
  red?: boolean;
}

export const STATIONS: StationDef[] = [
  { id: "harbor", num: "ST–00", name: "Harbor", desc: "the living engine", row: 1, col: 1 },
  { id: "ledger", num: "ST–01", name: "Ledger", desc: "every artifact digest-bound", row: 0, col: 0 },
  { id: "lineage", num: "ST–02", name: "Lineage", desc: "releases as chain of custody", row: 0, col: 1 },
  { id: "encounter", num: "ST–03", name: "Encounter", desc: "the six-kind chain, alive", row: 0, col: 2 },
  { id: "controls", num: "ST–04", name: "Controls", desc: "controls, twin evaluations", row: 1, col: 0 },
  { id: "estimands", num: "ST–05", name: "Estimands", desc: "instruments awaiting first light", row: 1, col: 2 },
  { id: "adversaries", num: "ST–06", name: "Adversaries", desc: "the known-bad wall", row: 2, col: 0 },
  { id: "chair", num: "ST–07", name: "The Chair", desc: "the correction engine · the seat", row: 2, col: 1, red: true },
  { id: "frontier", num: "ST–08", name: "Frontier", desc: "pointers, honestly ineligible", row: 2, col: 2 },
];

export function stationById(id: string | null): StationDef {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[4];
}

function urlStation(): string {
  return new URLSearchParams(location.search).get("st") ?? "harbor";
}

export function useCamera(worldRef: React.RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState<string>(urlStation());
  const target = useRef(stationById(urlStation()));
  const pos = useRef({ x: 0, y: 0, initialized: false });
  const raf = useRef(0);

  const go = (id: string, push = true) => {
    const st = stationById(id);
    target.current = st;
    setActive(st.id);
    if (push) {
      const q = st.id === "harbor" ? location.pathname : `?st=${st.id}`;
      history.pushState({ st: st.id }, "", q);
    }
  };

  useEffect(() => {
    const onPop = () => go(urlStation(), false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go("harbor");
      const cur = stationById(target.current.id);
      const move: Record<string, [number, number]> = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
      };
      const d = move[e.key];
      if (d) {
        const next = STATIONS.find((s) => s.row === cur.row + d[0] && s.col === cur.col + d[1]);
        if (next) go(next.id);
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const t = target.current;
      const tx = t.col * W + W / 2;
      const ty = t.row * H + H / 2;
      if (!pos.current.initialized || reduced) {
        pos.current = { x: tx, y: ty, initialized: true };
      } else {
        const k = Math.min(1, dt * 5.2);
        pos.current.x += (tx - pos.current.x) * k;
        pos.current.y += (ty - pos.current.y) * k;
      }
      const dist = Math.hypot(tx - pos.current.x, ty - pos.current.y);
      const norm = Math.min(1, dist / Math.max(W, H));
      const scale = reduced ? 1 : 1 / (1 + 0.55 * norm); // the dip of the flight arc
      const el = worldRef.current;
      if (el) {
        el.style.transform =
          `translate3d(${W / 2}px, ${H / 2}px, 0) scale(${scale.toFixed(4)}) ` +
          `translate3d(${(-pos.current.x).toFixed(2)}px, ${(-pos.current.y).toFixed(2)}px, 0)`;
        el.style.transformOrigin = "0 0";
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [worldRef]);

  return { active, go };
}
