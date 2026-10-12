import { useEffect, useRef, useState } from "react";
import { Blocked, Digest, useSurfaceState } from "../components/primitives";
import type { VerifiedEvidence } from "../boot/ProofBoot";
import {
  EditionLabel,
  IntervalFigure,
  Segments,
  SourceLine,
  DocumentReader,
} from "../components/Research";
import { editionJson, editionManifest, researchLink } from "../lib/edition";
import { HarborScene } from "./HarborScene";
import type { Navigate } from "../components/StationFrame";

const referenceView = () => {
  const value = new URLSearchParams(location.search).get("view");
  return value === "original" || value === "revised" ? value : "family";
};

export async function loadHarborInstruments() {
  const [record, manifest] = await Promise.all([
    editionJson("docs/CONTINUATION.json"),
    editionManifest(),
  ]);
  return { ...record, manifest };
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
  const [selection, setSelection] = useState(referenceView()),
    [inspect, setInspect] = useState(
      new URLSearchParams(location.search).get("inspect") === "reference",
    );
  const inspector = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const onPop = () => {
      const on =
        new URLSearchParams(location.search).get("inspect") === "reference";
      setInspect(on);
      setSelection(referenceView());
      if (!on) requestAnimationFrame(() => trigger.current?.focus());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (
      inspect &&
      result.phase === "ready" &&
      inspector.current &&
      !inspector.current.open
    ) {
      inspector.current.showModal();
      heading.current?.focus();
    }
  }, [inspect, result.phase]);
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
  const referenceX = (value: number) =>
    8 + ((value - d.sharp_family_interval[0]) / (d.sharp_family_interval[1] - d.sharp_family_interval[0])) * 84;
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
      className={`harbor-restored ${inspect ? "is-inspecting" : ""}`}
      aria-label="Harbor · the evidence instrument"
      onKeyDown={(e) => {
        if (e.key === "Escape" && inspect) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <HarborScene ev={ev} pulse={pulse} />
      <header className="harbor-identity">
        <div className="eyebrow">HARBOR / Evidence instrument</div>
        <h1>The evidence behind the decision.</h1>
        <p>Observation. Belief. Decision. Consequence.</p>
      </header>
      <button
        ref={trigger}
        className="harbor-reference"
        onClick={open}
        aria-expanded={inspect}
        aria-label={`Inspect the current reference finding: ${d.delta_original} under COCO and ${d.delta_revised} under COCO-ReM`}
      >
        <span className="harbor-reference-top">
          <span className="eyebrow">Current finding</span>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" /></svg>
        </span>
        <span className="harbor-reference-title">Fixed predictions. Two references.</span>
        <span className="reference-contrast">
          <span><small>COCO-ReM</small><b>{d.delta_revised}</b></span>
          <svg className="reference-mini-axis" viewBox="0 0 100 26" aria-hidden="true">
            <path className="reference-axis-track" d={`M8 13h84M${referenceX(0)} 7v12`} />
            <path className="reference-axis-span" d={`M${referenceX(d.delta_revised)} 13H${referenceX(d.delta_original)}`} />
            <circle cx={referenceX(d.delta_revised)} cy="13" r="3" /><circle cx={referenceX(d.delta_original)} cy="13" r="3" />
          </svg>
          <span><small>COCO</small><b>+{d.delta_original}</b></span>
        </span>
        <span className="harbor-reference-action">Opposite preferences <span>Inspect ↗</span></span>
      </button>
      {inspect && (
        <dialog
          ref={inspector}
          className="harbor-inspector"
          aria-label="Comparison explanation"
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <div className="inspector-heading">
            <h2 ref={heading} tabIndex={-1}>
              The reference changes the answer.
            </h2>
            <button className="research-button" onClick={close}>
              Back to figure
            </button>
          </div>
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
        </dialog>
      )}
      <footer className="harbor-foot">
        <div className="harbor-index-proof">
          <span>{(ev.index?.artifacts?.length ?? 0).toLocaleString()} bound artifact identities</span>
          <Digest id="index" sha={ev.indexSha256} path="gate/GATE_A_EVIDENCE_INDEX.json" />
        </div>
        <span>Illustrated evidence flow · no live vehicle</span>
        <EditionLabel />
      </footer>
    </section>
  );
}
