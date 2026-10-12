import { useEffect, useState } from "react";
import { Blocked, Digest, useSurfaceState } from "../components/primitives";
import {
  EditionLabel,
  Segments,
  IntervalFigure,
  DocumentReader,
  ShareReading,
} from "../components/Research";
import { MatchingGraph } from "../components/EvidenceGraphics";
import { exampleJson } from "../lib/example";
import { editionJson, rational } from "../lib/edition";
export function Comparison() {
  const [which, setWhich] = useState(
      new URLSearchParams(location.search).get("view") === "confirmed"
        ? "confirmed"
        : "insufficient",
    ),
    [inspect, setInspect] = useState(false);
  useEffect(() => {
    const pop = () =>
      setWhich(
        new URLSearchParams(location.search).get("view") === "confirmed"
          ? "confirmed"
          : "insufficient",
      );
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const state = useSurfaceState(async () => {
    const [yes, no, input] = await Promise.all([
      exampleJson("confirmed.json"),
      exampleJson("insufficient.json"),
      editionJson(
        "research/perception-revision/0.1.0/replacement-example.json",
      ),
    ]);
    return { yes, no, input };
  }, []);
  if (state.phase === "loading")
    return <p role="status">Reading the engine packets…</p>;
  if (state.phase === "blocked") return <Blocked reason={state.reason} />;
  const chosen = which === "confirmed" ? state.data.yes : state.data.no,
    r = chosen.data.payload.result,
    exact = (q: any) => rational(`${q.numerator}/${q.denominator}`),
    sufficient = r.sufficiency === "sufficient";
  const tolerance = exact(state.data.input.data.loss.tolerance);
  return (
    <section
      className="research-station comparison-cinematic"
      aria-label="Conditional comparison engine"
    >
      <div className="research-top">
        <EditionLabel />
        <ShareReading />
      </div>
      <div className="finding-layout">
        <article className="finding-main">
          <div className="eyebrow">
            Actual engine packets · published synthetic example
          </div>
          <h1>
            Enough evidence
            <br />
            for which claim?
          </h1>
          <p className="research-deck">
            Strict improvement and preference are different questions.
          </p>
          <Segments
            label="Hypothetical reference observations"
            value={which}
            onChange={(v) => {
              setWhich(v);
              const u = new URL(location.href);
              u.searchParams.set("view", v);
              history.replaceState(history.state, "", u.pathname + u.search);
            }}
            options={[
              { id: "insufficient", label: "Confirm one object" },
              { id: "confirmed", label: "Confirm both objects" },
            ]}
          />
          <MatchingGraph
            anchors={state.data.input.data.anchors}
            confirmed={sufficient}
          />
          {r.bounds ? (
            <IntervalFigure
              lower={exact(r.bounds.lower)}
              upper={exact(r.bounds.upper)}
              min={-0.5}
              max={2.5}
              tolerance={tolerance}
              label="Δ = loss A − loss B"
            />
          ) : (
            <figure className="counterexample">
              <span>Checked adverse interpretation</span>
              <strong>Δ = {exact(r.counterexample_value)}</strong>
              <p>
                Delete the unconfirmed object. The value reaches τ = {tolerance}
                ; strict improvement requires Δ &gt; τ.
              </p>
              <figcaption>
                Counterexample only. This packet supplies no full-family
                enclosure.
              </figcaption>
            </figure>
          )}
          <div className="decision-pair">
            <div>
              <span>Strict improvement beyond τ</span>
              <strong>
                {sufficient
                  ? "Supported in the declared family"
                  : "These observations are insufficient"}
              </strong>
            </div>
            <div>
              <span>Preference without that margin</span>
              <strong>
                {sufficient
                  ? "B has lower loss"
                  : "This witness still favors B"}
              </strong>
            </div>
          </div>
          <p className="research-limit">
            At most one reference deletion. Hypothetical answers, equal weights,
            unit FP/FN penalties. No real audit occurred. Physical truth,
            statistical confidence and saved human work remain unestablished.
          </p>
          <div className="source-line">
            <span>Engine result · {r.enclosure_kind.replaceAll("_", " ")}</span>
            <Digest
              id={`example/${which}.json`}
              sha={chosen.sha}
              path={`synthetic replay/${which}.json`}
            />
          </div>
        </article>
        <aside className="finding-reading">
          <div className="eyebrow">THE COMPUTATION</div>
          <h2>
            Two outputs.
            <br />
            One shared world.
          </h2>
          <p>
            Qualify two outputs, keep them on the same reference world, bound
            their loss difference, and check a proposed certificate. Missing
            outputs block the comparison; observed empty outputs remain
            observations.
          </p>
          <ol className="contract-steps">
            <li>Bind the inputs and declared uncertainty.</li>
            <li>Compare maximum one-to-one matchings.</li>
            <li>Preserve exact, conservative and unavailable bounds.</li>
            <li>Check the certificate and distinguish the propositions.</li>
          </ol>
          <p>
            These packets were reproduced from the published engine and passed
            its separate audit checker. That is a local reproduction, not
            independent replication.
          </p>
          <button
            className="research-button"
            aria-expanded={inspect}
            onClick={() => setInspect(!inspect)}
          >
            {inspect ? "Close technical contract" : "Read the full contract"}
          </button>
          {inspect && (
            <DocumentReader path="research/perception-revision/0.1.0/README.md" />
          )}
        </aside>
      </div>
    </section>
  );
}
