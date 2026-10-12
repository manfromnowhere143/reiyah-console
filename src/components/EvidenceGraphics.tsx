import { useEffect, useRef, useState } from "react";
import { rational, type EditionFile } from "../lib/edition";
import { useStationLayout } from "./StationFrame";

/* Draw in measured CSS pixels. Text never shrinks with a fixed desktop SVG. */
function useFigure() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 320, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  useStationLayout(ref, box.w, box.h);
  return { ref, width: Math.max(260, box.w) };
}

export function BatchCircuit({
  fixtures,
  omitted,
  a,
  b,
}: {
  fixtures: any;
  omitted: boolean;
  a: number;
  b: number;
}) {
  const { ref, width: w } = useFigure();
  const cases = ["primary_A", "primary_B"].map((id) =>
    fixtures.cases.find((c: any) => c.id === id),
  );
  const xs = [w * 0.25, w * 0.75],
    cy = 246;
  return (
    <div
      ref={ref}
      className="evidence-graphic batch-circuit"
      data-omitted={omitted}
    >
      <svg
        viewBox={`0 0 ${w} 318`}
        role="img"
        aria-label={`Two authored images. ${omitted ? "Image 1 is omitted from the mean." : "Both images contribute."} Candidate A error ${a}; B error ${b}. ${a < b ? "A" : "B"} has lower reported error.`}
      >
        <text x="18" y="23" className="graphic-kicker">
          FIXED INPUTS
        </text>
        <text x={w - 18} y="23" textAnchor="end" className="graphic-kicker">
          02 IMAGES
        </text>
        {xs.map((x, i) => (
          <g
            key={i}
            className={
              omitted && i === 0
                ? "contribution-omitted"
                : "contribution-present"
            }
          >
            <path
              className="circuit-trace"
              d={`M ${x} 164 C ${x} 210, ${w / 2} 190, ${w / 2} ${cy - 24}`}
            />
            <rect
              x={x - 48}
              y="47"
              width="96"
              height="88"
              rx="3"
              className="image-plane"
            />
            <path
              d={`M${x - 42} 57v-4h12 M${x + 42} 57v-4h-12 M${x - 42} 125v4h12 M${x + 42} 125v4h-12`}
              className="graphic-bracket"
            />
            <rect
              x={x - 17}
              y="72"
              width="34"
              height="34"
              className="reference-outline"
            />
            <rect
              x={x - 17}
              y="72"
              width="34"
              height="34"
              className="detection-outline"
            />
            <text x={x} y="151" textAnchor="middle" className="graphic-label">
              IMAGE 0{i + 1}
            </text>
            <text x={x} y="175" textAnchor="middle" className="graphic-numeric">
              {cases
                .map(
                  (c: any, j) =>
                    `${j === 0 ? "A" : "B"} ${(1 - rational(c.images[i].detections[0].probability)).toFixed(3)}`,
                )
                .join(" · ")}
            </text>
            {omitted && i === 0 && (
              <g>
                <path
                  d={`M ${x - 6} 192l12 12m0-12l-12 12`}
                  className="omission-cross"
                />
                <text
                  x={x - 5}
                  y="222"
                  textAnchor="middle"
                  className="omission-label"
                >
                  omitted
                </text>
              </g>
            )}
          </g>
        ))}
        <circle cx={w / 2} cy={cy} r="24" className="collector" />
        <text
          x={w / 2}
          y={cy + 6}
          textAnchor="middle"
          className="collector-symbol"
        >
          μ
        </text>
        <text x={w / 2} y="296" textAnchor="middle" className="graphic-label">
          {omitted
            ? "ONLY THE LAST IMAGE REACHES THE MEAN"
            : "EVERY ELIGIBLE CONTRIBUTION REACHES THE MEAN"}
        </text>
      </svg>
      <div className="circuit-result" aria-live="polite">
        <span>Reported preference</span>
        <strong>{a < b ? "A" : "B"}</strong>
        <span>
          Lower mean TVD
          <br />
          <b>{Math.min(a, b).toFixed(3)}</b>
        </span>
      </div>
    </div>
  );
}

export function MotionCrossing({ data: d }: { data: any }) {
  const { ref, width: w } = useFigure();
  const x1 = 64,
    x2 = w - 64,
    y = (v: number) => 254 - v * 1.8;
  const rows = [
    { key: "vision", label: "Vision" },
    { key: "trajectory", label: "Trajectory" },
  ];
  return (
    <figure>
      <div ref={ref} className="evidence-graphic motion-crossing">
        <svg
          viewBox={`0 0 ${w} 292`}
          role="img"
          aria-label={`Reference agreement: vision ${(d.native_accuracy.vision * 100).toFixed(2)} percent, trajectory ${(d.native_accuracy.trajectory * 100).toFixed(2)} percent. Physics consistency: vision ${(d.native_WPCR.vision * 100).toFixed(2)} percent, trajectory ${(d.native_WPCR.trajectory * 100).toFixed(2)} percent.`}
        >
          <text x={x1} y="24" textAnchor="middle" className="graphic-kicker">
            REFERENCE
          </text>
          <text x={x2} y="24" textAnchor="middle" className="graphic-kicker">
            CONSISTENCY
          </text>
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line
                x1={x1}
                x2={x2}
                y1={y(v)}
                y2={y(v)}
                className="graphic-grid"
              />
              <text
                x={w / 2}
                y={y(v) - 5}
                textAnchor="middle"
                className="scale-label"
              >
                {v}%
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const a = d.native_accuracy[r.key] * 100,
              b = d.native_WPCR[r.key] * 100;
            return (
              <g key={r.key} className={`crossing-series series-${i}`}>
                <path
                  d={`M${x1} ${y(a)} L${x2} ${y(b)}`}
                  className="crossing-line"
                />
                {[
                  [x1, a],
                  [x2, b],
                ].map(([x, v], j) => (
                  <g key={j}>
                    <circle cx={x} cy={y(v)} r="5" />
                    <text
                      x={x}
                      y={
                        y(v) +
                        (i === 0 ? (j === 0 ? 24 : -15) : j === 0 ? -14 : 24)
                      }
                      textAnchor="middle"
                      className="reading-value"
                    >
                      {v.toFixed(2)}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
        <div className="graphic-legend">
          <span>
            <i className="series-0" />
            Vision
          </span>
          <span>
            <i className="series-1" />
            Trajectory
          </span>
        </div>
      </div>
      <figcaption>
        Percent scales 0–100. Different targets and denominators; connecting
        lines identify saved runs, not a causal effect.
      </figcaption>
    </figure>
  );
}

export function MatchingGraph({
  anchors,
  confirmed,
}: {
  anchors: any[];
  confirmed: boolean;
}) {
  return (
    <div className="matching-constellation">
      {anchors.map((anchor, i) => (
        <AnchorGraph
          key={anchor.id}
          anchor={anchor}
          deletable={i === 1 && !confirmed}
        />
      ))}
    </div>
  );
}
function AnchorGraph({
  anchor,
  deletable,
}: {
  anchor: any;
  deletable: boolean;
}) {
  const { ref, width: w } = useFigure(),
    end = w - 60;
  return (
    <figure className="anchor-graphic">
      <div className="anchor-heading">
        <span>{anchor.id}</span>
        <span>
          weight {anchor.weight.numerator}/{anchor.weight.denominator}
        </span>
      </div>
      <div ref={ref} className="evidence-graphic">
        <svg
          viewBox={`0 0 ${w} 220`}
          role="img"
          aria-label={`${anchor.id}: output A unmatched. Output B matches ${anchor.reference.objects[0].id}, ${deletable ? "unconfirmed and deletable in the counterexample" : "hypothetically confirmed present"}.`}
        >
          <path
            d={`M60 65 H${Math.max(100, end - 65)}`}
            className="unmatched-trace"
          />
          <text x={w / 2} y="46" textAnchor="middle" className="graphic-kicker">
            UNMATCHED
          </text>
          <path
            d={`M60 151 C${w * 0.48} 151, ${w * 0.48} 110, ${end - 24} 110`}
            className={`matching-trace ${deletable ? "is-deletable" : ""}`}
          />
          {[
            { letter: "A", y: 65 },
            { letter: "B", y: 151 },
          ].map((n) => (
            <g key={n.letter}>
              <rect
                x="24"
                y={n.y - 18}
                width="36"
                height="36"
                rx="4"
                className="detection-node"
              />
              <text
                x="42"
                y={n.y + 5}
                textAnchor="middle"
                className="graphic-label"
              >
                {n.letter}
              </text>
            </g>
          ))}
          <circle
            cx={end}
            cy="110"
            r="24"
            className={`object-orbit ${deletable ? "is-deletable" : ""}`}
          />
          <circle
            cx={end}
            cy="110"
            r="5"
            className={deletable ? "object-unknown" : "object-present"}
          />
          <text x={end} y="157" textAnchor="middle" className="graphic-kicker">
            {anchor.reference.objects[0].id}
          </text>
          <text x={w / 2} y="201" textAnchor="middle" className="graphic-label">
            {deletable ? "PRESENCE UNRESOLVED" : "CONFIRMED PRESENT"}
          </text>
        </svg>
      </div>
    </figure>
  );
}

export function WorldAperture({ distinct }: { distinct: boolean }) {
  const { ref, width: w } = useFigure(),
    xs = [w * 0.25, w * 0.75],
    mid = w / 2;
  return (
    <div ref={ref} className="evidence-graphic">
      <svg
        viewBox={`0 0 ${w} 240`}
        role="img"
        aria-label={
          distinct
            ? "Policy observation distinguishes worlds requiring different decisions"
            : "Two worlds require different decisions but yield the same available image observation"
        }
      >
        {xs.map((x, i) => (
          <g key={i}>
            <path
              d={`M${x} 103 C${x} 150,${distinct ? x : mid} 120,${distinct ? x : mid} 170`}
              className="circuit-trace"
            />
            <circle cx={x} cy="70" r="32" className="world-orbit" />
            <text x={x} y="77" textAnchor="middle" className="world-letter">
              {i === 0 ? "A" : "B"}
            </text>
            <text x={x} y="21" textAnchor="middle" className="graphic-kicker">
              WORLD 0{i + 1}
            </text>
          </g>
        ))}
        {(distinct ? xs : [mid]).map((x, i) => (
          <g key={i}>
            <rect
              x={x - 39}
              y="160"
              width="78"
              height="35"
              rx="3"
              className="observation-aperture"
            />
            <text x={x} y="181" textAnchor="middle" className="graphic-label">
              {distinct ? `POLICY ${i + 1}` : "IMAGE"}
            </text>
          </g>
        ))}
        <text x={mid} y="228" textAnchor="middle" className="graphic-label">
          {distinct
            ? "DISTINGUISHABLE OBSERVATIONS"
            : "ONE OBSERVATION · INCOMPATIBLE DECISIONS"}
        </text>
      </svg>
    </div>
  );
}

export function RecordMap({
  files,
  selected,
  onSelect,
}: {
  files: EditionFile[];
  selected: string;
  onSelect: (p: string) => void;
}) {
  const { ref, width: w } = useFigure();
  const groups = [
    { name: "Studies", test: (p: string) => p.startsWith("research/") },
    { name: "Evidence", test: (p: string) => p.startsWith("evidence/") },
    { name: "Engine", test: (p: string) => p.startsWith("tools/") },
    {
      name: "Mission",
      test: (p: string) =>
        !p.startsWith("research/") &&
        !p.startsWith("evidence/") &&
        !p.startsWith("tools/"),
    },
  ];
  const columns = w < 540 ? 2 : 4,
    cw = w / columns,
    across = Math.max(5, Math.floor((cw - 30) / 9));
  const rowHeight = Math.max(
    100,
    ...groups.map(
      (g) =>
        58 + Math.ceil(files.filter((f) => g.test(f.path)).length / across) * 9,
    ),
  );
  return (
    <figure className="record-map">
      <div ref={ref}>
        <svg
          viewBox={`0 0 ${w} ${Math.ceil(4 / columns) * rowHeight}`}
          aria-label="Map of locally bound records. Each mark opens its record; the list below provides keyboard access."
        >
          {groups.map((g, i) => {
            const rows = files.filter((f) => g.test(f.path)),
              gx = (i % columns) * cw,
              gy = Math.floor(i / columns) * rowHeight,
              across = Math.max(5, Math.floor((cw - 30) / 9));
            return (
              <g key={g.name} transform={`translate(${gx + 10},${gy})`}>
                <text x="0" y="20" className="graphic-kicker">
                  {g.name.toUpperCase()} / {rows.length}
                </text>
                {rows.map((f, j) => {
                  const x = (j % across) * 9 + 4,
                    y = 40 + Math.floor(j / across) * 9;
                  return (
                    <a
                      href={`?st=research&at=${encodeURIComponent(f.path)}`}
                      tabIndex={-1}
                      key={f.path}
                      onClick={(e) => {
                        e.preventDefault();
                        onSelect(f.path);
                      }}
                    >
                      <title>{f.path}</title>
                      <rect
                        x={x - 4}
                        y={y - 4}
                        width="9"
                        height="9"
                        fill="transparent"
                      />
                      <rect
                        x={x - 2.5}
                        y={y - 2.5}
                        width="5"
                        height="5"
                        className={
                          f.path === selected
                            ? "map-selected"
                            : f.continuation_bound
                              ? "map-bound"
                              : "map-record"
                        }
                      />
                    </a>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption>
        One mark per local record. Blue marks carry continuation bindings.
        Select a mark to read its bytes.
      </figcaption>
    </figure>
  );
}
