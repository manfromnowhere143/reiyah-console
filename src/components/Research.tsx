import { useEffect, useRef, useState } from "react";
import { Digest, useSurfaceState, Blocked } from "./primitives";
import { EDITION, editionText, sourceUrl } from "../lib/edition";
import { RecordText } from "./RecordText";

export function EditionLabel() {
  return (
    <span className="edition-label">
      Research edition · {EDITION.asOf} <span aria-hidden="true">/</span>{" "}
      {EDITION.commit.slice(0, 7)}
    </span>
  );
}
export function ShareReading({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState(
    compact ? "Copy link" : "Copy reading link",
  );
  return (
    <button
      className="share-reading"
      onClick={async () => {
        const u = new URL(location.href);
        u.searchParams.set("edition", EDITION.commit);
        try {
          await navigator.clipboard.writeText(u.href);
          setStatus("Reading link copied");
        } catch {
          setStatus("Copy the address bar link");
          history.replaceState(history.state, "", u.pathname + u.search);
        }
      }}
    >
      {status}
    </button>
  );
}
export function SourceLine({ path, sha }: { path: string; sha: string }) {
  return (
    <div className="source-line">
      <a href={sourceUrl(path)} target="_blank" rel="noreferrer">
        Read the source ↗
      </a>
      <Digest id={`edition/${path}`} sha={sha} path={path} />
    </div>
  );
}
export function Segments({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="research-segments" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function IntervalFigure({
  lower,
  upper,
  points = [],
  selected = "family",
  label = "Conditional loss difference",
  min = -650,
  max = 500,
  tolerance = 0,
}: {
  lower: number;
  upper: number;
  points?: { name: string; value: number; id: string }[];
  selected?: string;
  label?: string;
  min?: number;
  max?: number;
  tolerance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const x = (v: number) => 36 + ((v - min) / (max - min)) * (width - 72);
  return (
    <figure className="interval-figure">
      <div ref={ref}>
        <svg
          viewBox={`0 0 ${width} 205`}
          role="img"
          aria-label={`${label}. Admitted interval ${lower} to ${upper}. ${points.map((p) => `${p.name}: ${p.value}`).join(". ")}. Threshold ${tolerance}.`}
        >
          <line x1="36" x2={width - 36} y1="116" y2="116" className="axis" />
          <line x1={x(0)} x2={x(0)} y1="25" y2="165" className="baseline" />
          <text x={x(0)} y="190" textAnchor="middle">
            0 · equal loss
          </text>
          {tolerance !== 0 && (
            <>
              <line
                x1={x(tolerance)}
                x2={x(tolerance)}
                y1="25"
                y2="165"
                className="baseline tolerance"
              />
              <text x={x(tolerance)} y="20" textAnchor="middle">
                τ = {tolerance}
              </text>
            </>
          )}
          <g
            className={
              selected === "family" ? "interval-active" : "interval-muted"
            }
          >
            <rect
              x={x(lower)}
              y="91"
              width={Math.max(2, x(upper) - x(lower))}
              height="50"
              rx="2"
              className="enclosure-fill"
            />
            <line
              x1={x(lower)}
              x2={x(upper)}
              y1="116"
              y2="116"
              className="enclosure"
            />
            {[...new Set([lower, upper])].map((v, i) => (
              <g key={i}>
                <line
                  x1={x(v)}
                  x2={x(v)}
                  y1="100"
                  y2="132"
                  className="enclosure"
                />
                <text x={x(v)} y="159" textAnchor="middle">
                  {v > 0 ? "+" : ""}
                  {v}
                </text>
              </g>
            ))}
          </g>
          {points.map((p) => (
            <g
              key={p.id}
              opacity={selected === p.id || selected === "family" ? 1 : 0.3}
            >
              <line
                x1={x(p.value)}
                x2={x(p.value)}
                y1="58"
                y2="110"
                className="point-stem"
              />
              <circle
                cx={x(p.value)}
                cy="116"
                r={selected === p.id ? 7 : 4}
                className="reading-dot"
              />
              <text x={x(p.value)} y="44" textAnchor="middle">
                {p.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption>
        {label} · exact family enclosure; no probability assigned.
      </figcaption>
    </figure>
  );
}
export function PairBars({
  rows,
  max = 1,
  unit = "",
  caption,
}: {
  rows: { name: string; value: number; display?: string; tone?: string }[];
  max?: number;
  unit?: string;
  caption: string;
}) {
  return (
    <figure className="pair-bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.name}>
          <div className="bar-label">
            <span>{r.name}</span>
            <strong>
              {r.display ??
                r.value.toLocaleString("en", { maximumFractionDigits: 3 })}
              {unit}
            </strong>
          </div>
          <div className="bar-track">
            <div
              className={`bar-fill ${r.tone ?? ""}`}
              style={{
                width: `${Math.max(0, Math.min(1, r.value / max)) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
export function DocumentReader({ path }: { path: string }) {
  const [raw, setRaw] = useState(false);
  const state = useSurfaceState(() => editionText(path), [path]);
  if (state.phase === "loading")
    return <p role="status">Reading the bound record…</p>;
  if (state.phase === "blocked") return <Blocked reason={state.reason} />;
  const { text, file } = state.data;
  return (
    <div className="record-reader">
      <SourceLine path={path} sha={file.sha256} />
      {path.endsWith(".md") && (
        <button
          className="share-reading"
          onClick={() => setRaw((v) => !v)}
          aria-pressed={raw}
        >
          {raw ? "Read formatted record" : "Show exact source text"}
        </button>
      )}
      {path.endsWith(".md") && !raw ? (
        <RecordText text={text} path={path} />
      ) : (
        <pre className="record-code">{text}</pre>
      )}
    </div>
  );
}
