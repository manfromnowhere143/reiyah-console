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
        <div className="eyebrow">HARBOR / Reiyah</div>
        <h1>
          The evidence
          <br />
          behind the decision.
        </h1>
        <p>Observation. Belief. Decision. Consequence.</p>
        <div className="harbor-index-proof">
          <span>
            {(ev.index?.artifacts?.length ?? 0).toLocaleString()} historical
            artifact identities
          </span>
          <Digest
            id="index"
            sha={ev.indexSha256}
            path="gate/GATE_A_EVIDENCE_INDEX.json"
          />
        </div>
      </header>
      <button
        ref={trigger}
        className="harbor-reference"
        onClick={open}
        aria-expanded={inspect}
      >
        <span className="eyebrow">Current finding / Reference choice</span>
        <span className="reference-contrast">
          <b>+{d.delta_original}</b>
          <i aria-hidden="true">↔</i>
          <b>{d.delta_revised}</b>
        </span>
        <span>The same predictions. Opposite preferences.</span>
        <span className="harbor-reference-action">
          Inspect the comparison <span aria-hidden="true">↗</span>
        </span>
      </button>
      <nav
        className="harbor-instruments"
        aria-label="Explore the current research"
      >
        <button onClick={() => go("findings")}>
          <span className="instrument-number">01</span>
          <span>
            <small>THE FINDINGS</small>
            <strong>Follow the evidence.</strong>
            <em>Eight visual studies</em>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
        <button onClick={() => go("comparison")}>
          <span className="instrument-number">02</span>
          <span>
            <small>THE ENGINE</small>
            <strong>Change what is known.</strong>
            <em>Explore checked synthetic packets</em>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
        <button onClick={() => go("research")}>
          <span className="instrument-number">03</span>
          <span>
            <small>THE RESEARCH</small>
            <strong>Open the record.</strong>
            <em>{result.data.manifest.files.length} locally bound records</em>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      </nav>
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
        <EditionLabel />
        <span>Saved evidence · no live vehicle</span>
      </footer>
    </section>
  );
}
