import { useEffect, useRef, useState, type ReactNode } from "react";
import { rational } from "../lib/edition";
import { useStationLayout } from "./StationFrame";

/* The drawing uses the available CSS pixels, including its height. Labels
   stay the same size when a shorter viewport reduces the plotting area. */
function Plot({
  label,
  children,
  className = "",
}: {
  label: string;
  children: (width: number, height: number) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 180 });
  useEffect(() => {
    const el = ref.current!;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const next = { w: Math.round(box.width), h: Math.round(box.height) };
      setSize((old) => (old.w === next.w && old.h === next.h ? old : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);
  useStationLayout(ref, size.w, size.h);
  return (
    <div className={`finding-plot evidence-graphic ${className}`} ref={ref}>
      <svg
        viewBox={`0 0 ${Math.max(1, size.w)} ${Math.max(1, size.h)}`}
        role="img"
        aria-label={label}
      >
        {children(Math.max(1, size.w), Math.max(1, size.h))}
      </svg>
    </div>
  );
}

export function ContributionPlot({
  fixtures,
  omitted,
}: {
  fixtures: any;
  omitted: boolean;
}) {
  const cases = ["primary_A", "primary_B"].map((id) =>
    fixtures.cases.find((c: any) => c.id === id),
  );
  return (
    <Plot
      className="contribution-plot"
      label={`Two fixed images. ${omitted ? "Only image 2 contributes to the mean; image 1 is omitted." : "Both images contribute to the mean."} Per-image errors: A 0 and 0.5; B 0.375 and 0.375.`}
    >
      {(w, h) => {
        const input = w * 0.25,
          output = w * 0.78,
          cy = h / 2;
        return (
          <>
            {[Math.max(28, h * 0.28), h - Math.max(28, h * 0.22)].map((y, i) => (
              <g
                key={i}
                className={
                  omitted && i === 0
                    ? "contribution-omitted"
                    : "contribution-present"
                }
              >
                <path
                  d={`M${input + 40} ${y} C${w * 0.55} ${y},${w * 0.55} ${cy},${output - 22} ${cy}`}
                  className="circuit-trace"
                />
                <rect
                  x={input - 40}
                  y={y - 18}
                  width="80"
                  height="28"
                  rx="3"
                  className="image-plane"
                />
                <rect
                  x={input + 4}
                  y={y - 14}
                  width="20"
                  height="18"
                  className="detection-outline"
                />
                <text
                  x={input - 21}
                  y={y + 1}
                  textAnchor="middle"
                  className="graphic-kicker"
                >
                  0{i + 1}
                </text>
                <text
                  x={input}
                  y={y + 25}
                  textAnchor="middle"
                  className="graphic-numeric"
                >
                  {cases
                    .map(
                      (c: any, j: number) =>
                        `${j === 0 ? "A" : "B"} ${(1 - rational(c.images[i].detections[0].probability)).toFixed(3)}`,
                    )
                    .join(" · ")}
                </text>
                {omitted && i === 0 && (
                  <g className="omission-mark">
                    <path
                      d={`M${w * 0.53 - 5} ${y - 5}l10 10m0-10l-10 10`}
                      className="omission-cross"
                    />
                    <text x={w * 0.56} y={y - 15} className="omission-label">
                      omitted
                    </text>
                  </g>
                )}
              </g>
            ))}
            <circle cx={output} cy={cy} r="22" className="collector" />
            <text
              x={output}
              y={cy + 5}
              textAnchor="middle"
              className="collector-symbol"
            >
              μ
            </text>
            <text
              x={output}
              y={cy + 44}
              textAnchor="middle"
              className="graphic-label"
            >
              MEAN TVD
            </text>
          </>
        );
      }}
    </Plot>
  );
}

export function MotionPlot({ data: d }: { data: any }) {
  return (
    <Plot
      label={`Reference agreement: vision ${(100 * d.native_accuracy.vision).toFixed(2)}%, trajectory ${(100 * d.native_accuracy.trajectory).toFixed(2)}%. Physics consistency: vision ${(100 * d.native_WPCR.vision).toFixed(2)}%, trajectory ${(100 * d.native_WPCR.trajectory).toFixed(2)}%. Both scales 0 to 100; different denominators.`}
    >
      {(w, h) => {
        const x1 = 46,
          x2 = w - 46,
          y = (v: number) => h - 18 - (v * (h - 56)) / 100;
        return (
          <>
            <text x={x1} y="13" textAnchor="middle" className="graphic-kicker">
              REFERENCE
            </text>
            <text x={x2} y="13" textAnchor="middle" className="graphic-kicker">
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
                  y={y(v) - 4}
                  textAnchor="middle"
                  className="scale-label"
                >
                  {v}%
                </text>
              </g>
            ))}
            {["vision", "trajectory"].map((key, i) => {
              const a = d.native_accuracy[key] * 100,
                b = d.native_WPCR[key] * 100;
              return (
                <g key={key} className={`crossing-series series-${i}`}>
                  <path
                    d={`M${x1} ${y(a)}L${x2} ${y(b)}`}
                    className="crossing-line"
                  />
                  {[
                    [x1, a],
                    [x2, b],
                  ].map(([x, v], j) => (
                    <g key={j}>
                      <circle cx={x} cy={y(v)} r="4" />
                      <text
                        x={x}
                        y={y(v) + (i === j ? 19 : -10)}
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
          </>
        );
      }}
    </Plot>
  );
}

export function PolicyPlot({ distinct }: { distinct: boolean }) {
  return (
    <Plot
      label={
        distinct
          ? "Policy records distinguish worlds requiring different decisions."
          : "Worlds A and B require different decisions but yield the same image observation."
      }
    >
      {(w, h) => {
        const xs = [w * 0.25, w * 0.75],
          mid = w / 2,
          bottom = h - 27;
        return (
          <>
            {xs.map((x, i) => (
              <g key={i}>
                <path
                  d={`M${x} 72C${x} ${h * 0.65},${distinct ? x : mid} ${h * 0.6},${distinct ? x : mid} ${bottom}`}
                  className="circuit-trace"
                />
                <circle cx={x} cy="47" r="24" className="world-orbit" />
                <text x={x} y="54" textAnchor="middle" className="world-letter">
                  {i === 0 ? "A" : "B"}
                </text>
                <text
                  x={x}
                  y="12"
                  textAnchor="middle"
                  className="graphic-kicker"
                >
                  WORLD 0{i + 1}
                </text>
              </g>
            ))}
            {(distinct ? xs : [mid]).map((x, i) => (
              <g key={i}>
                <rect
                  x={x - 36}
                  y={bottom - 17}
                  width="72"
                  height="32"
                  rx="3"
                  className="observation-aperture"
                />
                <text
                  x={x}
                  y={bottom + 3}
                  textAnchor="middle"
                  className="graphic-label"
                >
                  {distinct ? `POLICY ${i + 1}` : "IMAGE"}
                </text>
              </g>
            ))}
          </>
        );
      }}
    </Plot>
  );
}

export function ReferencePlot({ data: d }: { data: any }) {
  const [lo, hi] = d.sharp_family_interval;
  return (
    <Plot
      className="reference-plot"
      label={`Loss difference, threshold 0.25 minus 0.50: COCO 2017 ${d.delta_original}; COCO-ReM ${d.delta_revised}. Exact family enclosure ${lo} to ${hi}. Positive favors 0.50, negative favors 0.25. No probability assigned.`}
    >
      {(w, h) => {
        const x = (v: number) => 24 + ((v + 650) / 1150) * (w - 48),
          cy = h * 0.56;
        return (
          <>
            <line x1="16" x2={w - 16} y1={cy} y2={cy} className="axis" />
            <line
              x1={x(0)}
              x2={x(0)}
              y1="22"
              y2={h - 25}
              className="baseline"
            />
            <rect
              x={x(lo)}
              y={cy - 15}
              width={x(hi) - x(lo)}
              height="30"
              rx="2"
              className="enclosure-fill"
            />
            <line x1={x(lo)} x2={x(hi)} y1={cy} y2={cy} className="enclosure" />
            {[lo, hi].map((v) => (
              <g key={v}>
                <line
                  x1={x(v)}
                  x2={x(v)}
                  y1={cy - 15}
                  y2={cy + 15}
                  className="enclosure"
                />
                <text
                  x={x(v)}
                  y={cy + 34}
                  textAnchor="middle"
                  className="graphic-numeric"
                >
                  {v > 0 ? "+" : ""}
                  {v}
                </text>
              </g>
            ))}
            {[
              ["COCO-ReM", d.delta_revised],
              ["COCO 2017", d.delta_original],
            ].map(([label, value]) => (
              <g key={label}>
                <line
                  x1={x(value)}
                  x2={x(value)}
                  y1="43"
                  y2={cy}
                  className="point-stem"
                />
                <circle cx={x(value)} cy={cy} r="4" className="reading-dot" />
                <text
                  x={x(value)}
                  y="16"
                  textAnchor="middle"
                  className="graphic-kicker"
                >
                  {label}
                </text>
                <text
                  x={x(value)}
                  y="35"
                  textAnchor="middle"
                  className="reading-value"
                >
                  {value > 0 ? "+" : ""}
                  {value}
                </text>
              </g>
            ))}
            <text
              x={x(0)}
              y={h - 7}
              textAnchor="middle"
              className="graphic-label"
            >
              0 · EQUAL LOSS
            </text>
          </>
        );
      }}
    </Plot>
  );
}
