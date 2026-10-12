import { useEffect, useRef, useState } from "react";
import { Blocked, useSurfaceState } from "../components/primitives";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import {
  CabinGround,
  EditionLabel,
  IntervalFigure,
  Segments,
  SourceLine,
  DocumentReader,
} from "../components/Research";
import { editionJson, researchLink } from "../lib/edition";
import type { Navigate } from "../components/StationFrame";

export async function loadHarborInstruments() {
  return editionJson("docs/CONTINUATION.json");
}
export function Harbor({
  ev,
  go,
  pulse,
}: {
  ev: VerifiedEvidence;
  go: Navigate;
  pulse?: number;
}) {
  const result = useSurfaceState(loadHarborInstruments, [pulse]);
  const [selection, setSelection] = useState(
      new URLSearchParams(location.search).get("view") ?? "family",
    ),
    [inspect, setInspect] = useState(
      new URLSearchParams(location.search).get("inspect") === "reference",
    );
  const trigger = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const onPop = () => {
      const on =
        new URLSearchParams(location.search).get("inspect") === "reference";
      setInspect(on);
      if (!on) requestAnimationFrame(() => trigger.current?.focus());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  if (result.phase === "loading")
    return (
      <div className="research-loading" role="status">
        Reading the research edition…
      </div>
    );
  if (result.phase === "blocked") return <Blocked reason={result.reason} />;
  const { data, file } = result.data,
    d = data.threshold_reference_screen;
  if (
    !d ||
    !Array.isArray(d.sharp_family_interval) ||
    d.sharp_family_interval.length !== 2
  )
    return <Blocked reason="comparison_contract_unavailable" />;
  const select = (v: string) => {
    setSelection(v);
    const u = new URL(location.href);
    u.searchParams.set("view", v);
    history.replaceState(history.state, "", u.pathname + u.search);
  };
  const open = () => {
    setInspect(true);
    const u = new URL(location.href);
    if (u.searchParams.get("inspect") !== "reference") {
      u.searchParams.set("inspect", "reference");
      history.pushState(
        { ...history.state, harborInspector: true },
        "",
        u.pathname + u.search,
      );
    }
    requestAnimationFrame(() => heading.current?.focus());
  };
  const close = () => {
    setInspect(false);
    if (history.state?.harborInspector) history.back();
    else {
      const u = new URL(location.href);
      u.searchParams.delete("inspect");
      history.replaceState(history.state, "", u.pathname + u.search);
    }
    requestAnimationFrame(() => trigger.current?.focus());
  };
  return (
    <section
      className={`harbor-current ${inspect ? "is-inspecting" : ""}`}
      aria-label="Harbor · conditional perception comparison"
      onKeyDown={(e) => {
        if (e.key === "Escape" && inspect) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <CabinGround />
      <header className="harbor-question">
        <EditionLabel />
        <h1>
          What would change
          <br />
          the decision?
        </h1>
        <p>Fixed predictions. Uncertain reference evidence.</p>
      </header>
      <div className="harbor-reading">
        <div className="eyebrow">
          One retained comparison · {d.images.toLocaleString()} images
        </div>
        <Segments
          label="Reference interpretation"
          value={selection}
          onChange={select}
          options={[
            { id: "family", label: "Allowed family" },
            { id: "original", label: "COCO 2017" },
            { id: "revised", label: "COCO-ReM" },
          ]}
        />
        <button
          className="figure-inspect"
          onClick={open}
          aria-label="Inspect the conditional loss difference and its evidence"
        >
          <IntervalFigure
            lower={d.sharp_family_interval[0]}
            upper={d.sharp_family_interval[1]}
            selected={selection}
            points={[
              {
                id: "revised",
                name: `Revised ${d.delta_revised}`,
                value: d.delta_revised,
              },
              {
                id: "original",
                name: `Original +${d.delta_original}`,
                value: d.delta_original,
              },
            ]}
          />
        </button>
        <div className="harbor-conclusion" aria-live="polite">
          <h2>
            {selection === "family"
              ? "Both preferences remain possible."
              : selection === "original"
                ? "Threshold 0.50 has lower loss."
                : "Threshold 0.25 has lower loss."}
          </h2>
          <p>
            Δ = loss(0.25) − loss(0.50). FP + FN, equal weights.
            <br />
            {selection === "family"
              ? "Exact policy-family enclosure; no physical-truth or probability claim."
              : "A reference-relative comparison; neither annotation policy is established as physical truth."}
          </p>
        </div>
        <button ref={trigger} className="research-button" onClick={open}>
          Inspect this comparison <span aria-hidden="true">↗</span>
        </button>
      </div>
      {inspect && (
        <aside className="harbor-inspector" aria-label="Comparison explanation">
          <div className="inspector-heading">
            <h2 ref={heading} tabIndex={-1}>
              The reference changes the answer.
            </h2>
            <button className="research-button" onClick={close}>
              Back to figure
            </button>
          </div>
          <p>
            Reiyah compares decisions across explicitly admitted
            interpretations. Here, each image may use either of two complete
            annotation sets. The interval contains every loss difference in that
            declared family.
          </p>
          <p>
            The engine’s broader research mission spans driver–vehicle belief,
            readiness, recoverability and joint silent misses. This implemented
            slice is an offline conditional perception comparison.
          </p>
          <p className="research-limit">
            A competent conventional calculation reaches this result too.
            Reduced complete work and a production advantage remain
            unestablished.
          </p>
          <SourceLine path={file.path} sha={file.sha256} />
          <a
            className="research-button"
            href={researchLink("comparison")}
            onClick={(e) => {
              e.preventDefault();
              go("comparison");
            }}
          >
            Explore the engine’s decision contract →
          </a>
          <DocumentReader path="research/threshold-reference-screen/0.1.0/README.md" />
        </aside>
      )}
      <footer className="harbor-foot">
        <span>HARBOR · evidence before assurance</span>
        <span>Conceptual cabin · saved evidence · no live vehicle</span>
      </footer>
    </section>
  );
}
