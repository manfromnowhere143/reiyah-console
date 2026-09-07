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

export function Dock({ active, pending, go }: { active: string; pending?: string | null; go: (id: string, push?: boolean, before?: () => void) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false, beyond: 0 });
  const [open, setOpen] = useState(false);
  const token = useRef(newLayerToken());
  useEffect(() => onLayerClaim((t) => { if (t !== token.current) setOpen(false); }), []);

  /* measure: which cards are fully in view; count those past the right edge */
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const cards = [...el.querySelectorAll<HTMLElement>(".navcard")];
      /* a card counts as out of view when its centre is past an edge, so the
         number holds steady while the dock glides and half a card crosses */
      const mid = (c: HTMLElement) => { const b = c.getBoundingClientRect(); return (b.left + b.right) / 2; };
      const beyond = cards.filter((c) => mid(c) > r.right).length;
      const before = cards.filter((c) => mid(c) < r.left).length;
      setEdge({ left: before > 0, right: beyond > 0, beyond: beyond + before });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", measure); };
  }, []);

  /* the pressed station is never left out of view */
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`.navcard[data-station="${active}"]`);
    el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);

  const openIndex = () => { claimLayer(token.current); setOpen(true); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

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
              data-pending={String(s.id === pending)}
              aria-current={s.id === active ? "page" : undefined}
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
        <span className="dan">{edge.beyond > 0 ? `+${edge.beyond}` : STATIONS.length}</span>
        <span className="dal">{edge.beyond > 0 ? "more" : "all"}</span>
      </button>
      {open && createPortal(
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="fieldindex" role="dialog" aria-label="The field index: every station" onClick={(e) => e.stopPropagation()}>
            <div className="fixhead"><span className="fixk">the field index</span><span className="fixn">{STATIONS.length} stations · three rails · press to fly · esc</span></div>
            <div className="fixrails">
              {RAILS.map((r) => (
                <section key={r.id} className="fixrail" data-rail={r.id} aria-label={r.name}>
                  <div className="fixrk">{r.name}<i>{r.kicker}</i></div>
                  {STATIONS.filter((s) => s.rail === r.id).map((s) => (
                    <button key={s.id} className="fixrow" data-active={String(s.id === active)} data-red={String(!!s.red)} onClick={() => go(s.id, true, () => setOpen(false))}>
                      <span className="fixid">{s.num}</span>
                      <span className="fixnm">{s.name}</span>
                      <span className="fixds">{s.desc}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
