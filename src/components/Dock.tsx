/* The dock: every station on one rail, measured.
   Seventeen stations do not fit one row on any screen, so the dock says how
   many stand beyond its edge and opens the whole field on request. Nothing is
   hidden by a hidden scrollbar: the overflow is measured with a ResizeObserver
   and on scroll, the edges fade only where more cards exist, a pinned tab
   carries the exact count of cards out of view, and the pressed station is
   always brought into view. The tab opens THE FIELD INDEX: all stations in
   their three rails, one screen, opaque (the card law), one card at a time
   (the layer bus), Escape closes, arrows move. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RAILS, STATIONS } from "../lib/camera";
import { claimLayer, newLayerToken, onLayerClaim } from "../lib/layers";
import { prefetchStation, STATION_CODE } from "../lib/prefetch";
import type { Navigate } from "./StationFrame";
import { Mark } from "./primitives";

const warm = (id: string) => { STATION_CODE[id]?.().catch(() => {}); prefetchStation(id).catch(() => {}); };

export function Dock({ active, pending, go }: { active: string; pending: string | null; go: Navigate }) {
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false, beyond: 0 });
  const [open, setOpen] = useState(false);
  const visited = useRef(new Set([active]));
  const [indicatorFor, setIndicatorFor] = useState<string | null>(null);
  useEffect(() => { visited.current.add(active); }, [active]);
  useEffect(() => {
    setIndicatorFor(null);
    if (!pending || visited.current.has(pending)) return;
    // Feedback is only for a noticeable first load. This timer never delays
    // navigation, and revisiting a station never reintroduces the spinner.
    const timer = setTimeout(() => setIndicatorFor(pending), 200);
    return () => clearTimeout(timer);
  }, [pending]);
  const loadingFeedback = pending && indicatorFor === pending ? pending : null;
  const indexRef = useRef<HTMLDivElement>(null);
  const token = useRef(newLayerToken());
  useEffect(() => onLayerClaim((t) => { if (t !== token.current) setOpen(false); }), []);

  /* measure: which cards are fully in view; count those past the right edge */
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const cards = [...el.querySelectorAll<HTMLElement>(".navcard")];
      const beyond = cards.filter((c) => c.getBoundingClientRect().right > r.right + 1).length;
      const before = cards.filter((c) => c.getBoundingClientRect().left < r.left - 1).length;
      setEdge({ left: before > 0, right: beyond > 0, beyond: beyond + before });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", measure); };
  }, []);

  /* Settle the selected card in the same paint as the page. A second smooth
     scroll left the rail moving under the user's next tap after arrival. */
  useLayoutEffect(() => {
    const rail = ref.current;
    const card = rail?.querySelector<HTMLElement>(`.navcard[data-station="${active}"]`);
    if (!rail || !card) return;
    const r = rail.getBoundingClientRect(), c = card.getBoundingClientRect();
    const shift = c.left < r.left ? c.left - r.left : c.right > r.right ? c.right - r.right : 0;
    // Scroll only this rail. scrollIntoView can also scroll clipped ancestors.
    if (shift) rail.scrollTo({ left: rail.scrollLeft + shift, behavior: "instant" });
  }, [active]);

  const openIndex = () => { claimLayer(token.current); setOpen(true); };
  const closeIndex = () => { if (pending) go(active); setOpen(false); };
  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    indexRef.current?.querySelector<HTMLElement>(".fixrow[data-active='true']")?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeIndex(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, pending, active, go]);

  const onIndexKey = (e: React.KeyboardEvent) => {
    const rows = [...(indexRef.current?.querySelectorAll<HTMLButtonElement>(".fixrow") ?? [])];
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (index + 1) % rows.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (index - 1 + rows.length) % rows.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = rows.length - 1;
    if (e.key === "Tab") {
      const buttons = [...(indexRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])].filter((b) => b.getClientRects().length);
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
    if (next !== undefined) { e.preventDefault(); rows[next]?.focus(); }
    e.stopPropagation();
  };

  const destination = STATIONS.find((s) => s.id === pending);

  let lastRail = "";
  return (
    <div className="dockwrap" data-left={String(edge.left)} data-right={String(edge.right)}>
      <nav className="dock" aria-label="Stations" ref={ref}>
        {STATIONS.map((s) => {
          const first = s.rail !== lastRail; lastRail = s.rail;
          const rail = RAILS.find((r) => r.id === s.rail)!;
          return (
            <button
              key={s.id}
              className="navcard glass"
              data-station={s.id}
              data-rail={s.rail}
              data-first={String(first)}
              data-red={String(!!s.red)}
              data-active={String(s.id === active)}
              data-pending={String(s.id === loadingFeedback)}
              aria-busy={s.id === pending || undefined}
              aria-current={s.id === active ? "page" : undefined}
              onPointerEnter={() => warm(s.id)} onFocus={() => warm(s.id)} onPointerDown={() => warm(s.id)}
              onClick={() => go(s.id)}
            >
              <span className="nid">{s.num}<span className="nrail"> · {rail.name.replace(/^The /, "")}</span></span>
              <span className="nnm">{s.name}</span>
              <span className="nds">{s.desc}</span>
            </button>
          );
        })}
      </nav>
      <button className="dockall glass" onClick={openIndex} aria-label={`Open the field index: ${STATIONS.length} stations, ${edge.beyond} out of view`} title="every station">
        <svg className="dockindexmark" viewBox="0 0 24 20" aria-hidden="true"><path d="M3 2v16M11 2v16M19 2v16" /><path d="M1 5h4M9 10h4M17 15h4" /></svg>
        <span className="dal">index</span>
        <span className="dan">{edge.beyond > 0 ? `+${edge.beyond}` : STATIONS.length}</span>
      </button>
      {open && createPortal(
        <div className="overlay fieldover" onClick={closeIndex}>
          <div className="fieldindex" ref={indexRef} role="dialog" aria-modal="true" aria-label="The field index: every station" onClick={(e) => e.stopPropagation()} onKeyDown={onIndexKey}>
            <div className="fixnav">
            <div className="fixhead">
              <div className="fixidentity"><Mark size={17} /><h2 className="fixk">Field index</h2></div>
              <button className="fixclose" aria-label="Close field index" onClick={closeIndex}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
            </div>
            <div className="fixrails">
              {RAILS.map((r) => (
                <section key={r.id} className="fixrail" data-rail={r.id} aria-label={r.name}>
                  <div className="fixrk">{r.name.replace(/^The /, "")}<i>{STATIONS.filter((s) => s.rail === r.id).length}</i></div>
                  {STATIONS.filter((s) => s.rail === r.id).map((s) => (
                    <button key={s.id} className="fixrow" data-station={s.id} data-active={String(s.id === active)} data-red={String(!!s.red)}
                      aria-current={s.id === active ? "page" : undefined} aria-busy={s.id === pending || undefined} data-pending={String(s.id === loadingFeedback)}
                      onPointerEnter={() => warm(s.id)} onFocus={() => warm(s.id)} onPointerDown={() => warm(s.id)}
                      onClick={() => go(s.id, { animate: false, onCommit: () => setOpen(false) })}>
                      <span className="fixid">{s.num}<span className="fixcurrent">current</span></span>
                      <span className="fixnm">{s.name}</span>
                      <svg className="fixarrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10m-4-4 4 4-4 4" /></svg>
                    </button>
                  ))}
                </section>
              ))}
            </div>
            <div className="fixfoot"><span className="fixfootstatus" role="status">{loadingFeedback ? `Opening ${destination?.name ?? "station"}` : `${STATIONS.length} stations`}</span><span className="fixescape">ESC / CLOSE</span></div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
