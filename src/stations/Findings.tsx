import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Blocked, useSurfaceState } from "../components/primitives";
import {
  EditionLabel,
  PairBars,
  Segments,
  DocumentReader,
  SourceLine,
  ShareReading,
} from "../components/Research";
import {
  ContributionPlot,
  MotionPlot,
  PolicyPlot,
  ReferencePlot,
} from "../components/FindingsVisuals";
import { EDITION, editionJson, rational } from "../lib/edition";
import { STUDIES, studyPath } from "../lib/studies";
import { getAt, setAt } from "../lib/urlstate";

const CORRECTION_LABELS: Record<string, [string, string]> = {
  "evidence-cost-pooled": [
    "Pooled evidence budget",
    "The measured two-channel detection statistic does not meet the safety corollary’s scope, fusion rule or uniform-bound requirements.",
  ],
  "evidence-cost-worst-group": [
    "Worst-group evidence budget",
    "The measured dependence estimates remain. Converting them into a validation-evidence multiplier is the withdrawn step.",
  ],
  "result-g-derivation": [
    "Result G derivation",
    "Result G reads no data. Its arithmetic uses rounded, transcribed constants; deterministic output does not establish a measurement.",
  ],
  "selected-coincidence-population-bound": [
    "Population dependence bound",
    "Exact completions move population dependence above or below the selected value. The direction is not identified.",
  ],
  "universal-kind-independence-law": [
    "Universal independence law",
    "Different events, marginals, populations and reference selections prevent these benchmark contrasts from identifying a universal law.",
  ],
  "cross-agent-safety-evidence-credit": [
    "Safety-validation credit",
    "Transfer to safety-critic errors, the fusion rule, a uniform dependence bound and an evidence-count estimator remain unestablished.",
  ],
};
const correctionCopy = (claim: any) =>
  CORRECTION_LABELS[claim.claim_id.split(".").at(-1)] ?? [
    claim.estimand,
    claim.refutation.statement,
  ];

function Composition({
  visual,
  children,
}: {
  visual: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="finding-composition">
      <div className="finding-visual">{visual}</div>
      <div className="finding-insight">{children}</div>
    </div>
  );
}

function EvidenceReader({
  title,
  path,
  sources,
  claim,
  onClose,
}: {
  title: string;
  path: string;
  sources: { path: string; sha256: string }[];
  claim?: any;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current!;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    el.showModal();
    return () => {
      el.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="finding-reader"
      aria-labelledby="finding-reader-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="finding-reader-content">
        <header>
          <div>
            <span className="eyebrow">Evidence & method</span>
            <h2 id="finding-reader-title">{title}</h2>
          </div>
          <button className="research-button" autoFocus onClick={onClose}>
            Back to finding
          </button>
        </header>
        <EditionLabel />
        {claim && (
          <section className="selected-correction">
            <span className="eyebrow">
              {claim.status.replaceAll("_", " ")} · scientific use{" "}
              {claim.current_scientific_use}
            </span>
            <h3>{claim.estimand}</h3>
            <p>{claim.refutation.statement}</p>
          </section>
        )}
        {sources.map((file) => (
          <SourceLine key={file.path} path={file.path} sha={file.sha256} />
        ))}
        <DocumentReader path={path} />
      </div>
    </dialog>,
    document.body,
  );
}

export function Findings() {
  const initial = () => STUDIES.find((s) => s.id === getAt())?.id ?? "batching";
  const [selected, setSelected] = useState<string>(initial);
  const [view, setView] = useState(
    () => new URLSearchParams(location.search).get("view") ?? "batch1",
  );
  const [detail, setDetail] = useState(false);
  useEffect(() => {
    const pop = () => {
      setSelected(initial());
      setView(new URLSearchParams(location.search).get("view") ?? "batch1");
      setDetail(false);
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("reiyah:reading", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("reiyah:reading", pop);
    };
  }, []);
  const study = STUDIES.find((s) => s.id === selected)!;
  const data = useSurfaceState(async () => {
    const [continuation, value, corrections, resolution, fixtures] =
      await Promise.all([
        editionJson("docs/CONTINUATION.json"),
        editionJson("research/value-disproof/0.1.0/results.json"),
        editionJson("evidence/claim-status-register-2026-10-10.json"),
        editionJson("research/resolution-identifiability/0.1.0/result.json"),
        editionJson("research/metric-aggregation-control/0.1.0/fixtures.json"),
      ]);
    return { continuation, value, corrections, resolution, fixtures };
  }, []);
  const choose = (id: string) => {
    setSelected(id);
    setView("batch1");
    setDetail(false);
    const u = new URL(location.href);
    u.searchParams.delete("view");
    history.replaceState(history.state, "", u.pathname + u.search);
    setAt(id);
  };
  const changeView = (v: string) => {
    setView(v);
    const u = new URL(location.href);
    u.searchParams.set("view", v);
    history.replaceState(history.state, "", u.pathname + u.search);
  };
  if (data.phase === "loading")
    return <p role="status">Reading the findings…</p>;
  if (data.phase === "blocked") return <Blocked reason={data.reason} />;
  const d = data.data.continuation.data[study.key];
  const sources = [data.data.continuation.file];
  let figure: ReactNode, selectedClaim: any;
  if (study.id === "batching") {
    const current = ["batch1", "batch2", "corrected"].includes(view)
      ? view
      : "batch1";
    const corrected = current === "corrected",
      two = current === "batch2";
    const scores = corrected
      ? d.corrected_primary_TVD
      : two
        ? d.native_primary_TVD.chunk_2_or_64_order_1_2
        : d.native_primary_TVD.chunk_1;
    const a = rational(scores.A),
      b = rational(scores.B);
    sources.push(data.data.fixtures.file);
    figure = (
      <Composition
        visual={
          <>
            <Segments
              label="Processing configuration"
              value={current}
              onChange={changeView}
              options={[
                { id: "batch1", label: "Batch of 1" },
                { id: "batch2", label: "Batch of 2" },
                { id: "corrected", label: "Corrected" },
              ]}
            />
            <ContributionPlot
              fixtures={data.data.fixtures.data}
              omitted={two}
            />
            <p className="finding-caption">
              {two
                ? "Only the final image reaches the mean."
                : "Both images reach the mean."}{" "}
              Predictions and labels stay fixed.
            </p>
          </>
        }
      >
        <span className="eyebrow">
          Reported preference · {a < b ? "A" : "B"}
        </span>
        <PairBars
          max={0.5}
          rows={[
            { name: "Candidate A", value: a, tone: a < b ? "selected" : "" },
            { name: "Candidate B", value: b, tone: b < a ? "selected" : "" },
          ]}
          caption="Mean TVD · scale 0–0.50 · lower is better"
        />
        <p className="figure-takeaway">
          {corrected
            ? "Every eligible detection contributes."
            : two
              ? "Batch size alone reverses the ranking."
              : "A has lower error. Change the batch size."}
        </p>
        <p className="finding-context">
          Local correction checked across 90 constructed configurations.
        </p>
      </Composition>
    );
  } else if (study.id === "empty") {
    const corrected = view === "corrected",
      scores = corrected ? d.authored_corrected_AUSRC : d.authored_native_AUSRC;
    figure = (
      <Composition
        visual={
          <>
            <Segments
              label="Opportunity accounting"
              value={corrected ? "corrected" : "native"}
              onChange={changeView}
              options={[
                { id: "native", label: "Native evaluator" },
                { id: "corrected", label: "Complete roster" },
              ]}
            />
            <div
              className="empty-observation"
              role="img"
              aria-label="A successful run with zero detections remains an observed opportunity."
            >
              <span>∅</span>
              <div>
                <b>Observed empty</b>
                <small>Successful run · zero detections</small>
              </div>
            </div>
            <p className="finding-caption">
              An empty output is distinct from a missing or failed run.
            </p>
          </>
        }
      >
        <PairBars
          rows={[
            {
              name: "Candidate A",
              value: rational(scores.A),
              display: scores.A,
            },
            {
              name: "Candidate B",
              value: rational(scores.B),
              display: scores.B,
            },
          ]}
          caption="AUSRC · scale 0–1 · higher is better"
        />
        <p className="figure-takeaway">
          {corrected
            ? "The complete denominator reverses the preference."
            : "Omitted opportunities change the preference."}
        </p>
        <p className="finding-context">
          A successful empty run must stay in the evaluation roster.
        </p>
      </Composition>
    );
  } else if (study.id === "motion") {
    figure = (
      <Composition
        visual={
          <>
            <MotionPlot data={d} />
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
            <p className="finding-caption">
              Percent scales 0–100. Different targets and denominators; lines
              connect saved runs.
            </p>
          </>
        }
      >
        <span className="eyebrow">
          Reference disagreement despite rule consistency
        </span>
        <div className="finding-metrics">
          <div>
            <strong>{d.primary_disagreements.vision}</strong>
            <span>Vision</span>
          </div>
          <div>
            <strong>{d.primary_disagreements.trajectory}</strong>
            <span>Trajectory</span>
          </div>
        </div>
        <p className="figure-takeaway">The metric changes which run leads.</p>
        <p className="finding-context" data-essential>
          Fractions among clips with an applicable rule and no violation, on a
          rule-involved question.
        </p>
      </Composition>
    );
  } else if (study.id === "review") {
    figure = (
      <Composition
        visual={
          <>
            <div
              className="review-population"
              role="img"
              aria-label={`${d.guaranteed_same} guaranteed same, ${d.forced_difference} forced different, ${d.ambiguous} ambiguous of ${d.objects} objects`}
            >
              {Array.from({ length: d.objects }, (_, i) => (
                <i
                  key={i}
                  className={
                    i < d.guaranteed_same
                      ? "same"
                      : i < d.guaranteed_same + d.forced_difference
                        ? "different"
                        : "ambiguous"
                  }
                />
              ))}
            </div>
            <div className="review-legend">
              <span>
                <i className="same" />
                <b>{d.guaranteed_same}</b> same
              </span>
              <span>
                <i className="different" />
                <b>{d.forced_difference}</b> different
              </span>
              <span>
                <i className="ambiguous" />
                <b>{d.ambiguous}</b> ambiguous
              </span>
            </div>
            <p className="finding-caption">
              One mark per recorded object; these are not independent trials.
            </p>
          </>
        }
      >
        <div className="finding-number">
          {d.forced_ordinary_class_switches}
          <span>forced ordinary-class switches</span>
        </div>
        <p className="figure-takeaway">
          A different procedure can yield a different decision.
        </p>
        <p className="finding-context">
          “Cannot solve” and “no strict majority” remain distinct unresolved
          outcomes.
        </p>
      </Composition>
    );
  } else if (study.id === "reference") {
    figure = (
      <Composition
        visual={
          <>
            <ReferencePlot data={d} />
            <p className="finding-caption">
              Δ = loss at 0.25 − loss at 0.50. Positive favors 0.50; negative
              favors 0.25.
            </p>
          </>
        }
      >
        <span className="eyebrow">
          Simulated disclosures · no measured work saving
        </span>
        <div className="finding-metrics">
          <div>
            <strong>{d.simulated_conventional_reveals}</strong>
            <span>Conventional</span>
          </div>
          <div>
            <strong>{d.hindsight_minimum_reveals}</strong>
            <span>Hindsight · answers known</span>
          </div>
        </div>
        <p className="figure-takeaway">
          The declared family contains both preferences.
        </p>
        <p className="finding-context">
          The hindsight method knows answers in advance. No human work saving
          was measured.
        </p>
      </Composition>
    );
  } else if (study.id === "resolution") {
    const richer = view === "policy";
    const r = data.data.resolution.data.cases.find(
      (x: any) =>
        x.case_id === (richer ? "policy_record_available" : "hidden_policy"),
    );
    sources.push(data.data.resolution.file);
    figure = (
      <Composition
        visual={
          <>
            <Segments
              label="Available observation channel"
              value={richer ? "policy" : "image"}
              onChange={changeView}
              options={[
                { id: "image", label: "Image only" },
                { id: "policy", label: "Policy record" },
              ]}
            />
            <PolicyPlot distinct={richer} />
            <p className="finding-caption">
              {richer
                ? "The policy record distinguishes these worlds."
                : "The same image leaves incompatible acceptable decisions."}
            </p>
          </>
        }
      >
        <span className="eyebrow">{r.state.replaceAll("_", " ")}</span>
        <div className="finding-metrics">
          <div>
            <strong>{d.named_cases}</strong>
            <span>Named cases</span>
          </div>
          <div>
            <strong>{d.exhaustive_models.toLocaleString("en")}</strong>
            <span>Finite models</span>
          </div>
        </div>
        <p className="figure-takeaway">
          {richer
            ? "A distinguishable observation resolves this case."
            : "More of the same review cannot guarantee resolution."}
        </p>
        <p className="finding-context">
          A complete finite-model check, under the declared observation channel.
        </p>
      </Composition>
    );
  } else if (study.id === "value") {
    const v = data.data.value.data;
    sources.push(data.data.value.file);
    figure = (
      <Composition
        visual={
          <>
            <PairBars
              max={Math.max(v.totals.C.all_queries, v.totals.D.all_queries)}
              rows={[
                { name: "Reiyah arm", value: v.totals.C.all_queries },
                {
                  name: "Competent conventional arm",
                  value: v.totals.D.all_queries,
                },
              ]}
              caption="Hypothetical reveals · equal information"
            />
            <p className="finding-caption">
              Preparation, review, checking and unresolved cases all count
              toward complete work.
            </p>
          </>
        }
      >
        <span className="eyebrow">Cases resolved</span>
        <div className="finding-metrics">
          <div>
            <strong>
              {v.totals.C.resolved}/{v.totals.C.assigned}
            </strong>
            <span>Reiyah</span>
          </div>
          <div>
            <strong>
              {v.totals.D.resolved}/{v.totals.D.assigned}
            </strong>
            <span>Conventional</span>
          </div>
        </div>
        <p className="figure-takeaway">No selection advantage demonstrated.</p>
        <p className="finding-context">
          The practical test: the same justified decision with less complete
          work.
        </p>
      </Composition>
    );
  } else {
    const claims = data.data.corrections.data.claims.filter(
      (x: any) => x.status === "withdrawn_as_stated" && x.refutation,
    );
    selectedClaim =
      claims.find((x: any) => x.claim_id === view) ??
      claims.find((x: any) =>
        x.claim_id.endsWith("selected-coincidence-population-bound"),
      ) ??
      claims[0];
    const [title, summary] = correctionCopy(selectedClaim);
    sources.push(data.data.corrections.file);
    figure = (
      <Composition
        visual={
          <div
            className="correction-index"
            role="group"
            aria-label="Withdrawn interpretations"
          >
            {claims.map((claim: any, i: number) => (
              <button
                key={claim.claim_id}
                aria-pressed={claim === selectedClaim}
                onClick={() => changeView(claim.claim_id)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                {correctionCopy(claim)[0]}
                <i aria-hidden="true">×</i>
              </button>
            ))}
          </div>
        }
      >
        <span className="eyebrow">
          {claims.length} withdrawn as stated · scientific use forbidden
        </span>
        <h2 className="correction-title">{title}</h2>
        <p className="figure-takeaway">{summary}</p>
        <p className="finding-context">
          The complete refutation and retained records are in Evidence & method.
        </p>
      </Composition>
    );
  }
  return (
    <section
      className="research-station findings-cinematic findings-compact"
      aria-label="Research findings"
      data-finding={study.id}
    >
      <div className="research-top">
        <span className="edition-label">Research edition · {EDITION.asOf}</span>
        <ShareReading compact />
      </div>
      <nav className="study-nav" aria-label="Select finding">
        {STUDIES.map((s, i) => (
          <button
            key={s.id}
            aria-current={selected === s.id ? "page" : undefined}
            onClick={() => choose(s.id)}
          >
            <span className="study-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            {s.label}
          </button>
        ))}
      </nav>
      <article className="finding-sheet">
        <header className="finding-heading">
          <div>
            <div className="eyebrow">{study.kind}</div>
            <h1>{study.title}</h1>
          </div>
          <p className="research-deck">{study.subtitle}</p>
        </header>
        <div className="finding-figure" key={study.id}>
          {figure}
        </div>
        <footer className="finding-footer">
          <p className="research-limit">
            <span>Scope</span>
            {study.limit}
          </p>
          <button
            className="research-button"
            aria-haspopup="dialog"
            onClick={() => setDetail(true)}
          >
            Evidence & method <span aria-hidden="true">↗</span>
          </button>
        </footer>
      </article>
      {detail && (
        <EvidenceReader
          title={study.title}
          path={studyPath(study.family)}
          sources={sources}
          claim={selectedClaim}
          onClose={() => setDetail(false)}
        />
      )}
    </section>
  );
}
