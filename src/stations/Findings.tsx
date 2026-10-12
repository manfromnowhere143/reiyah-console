import { useEffect, useState } from "react";
import { Blocked, useSurfaceState } from "../components/primitives";
import {
  EditionLabel,
  PairBars,
  Segments,
  IntervalFigure,
  DocumentReader,
  SourceLine,
  ShareReading,
} from "../components/Research";
import { editionJson, rational } from "../lib/edition";
import { STUDIES, studyPath } from "../lib/studies";
import { BatchFigure } from "../components/BatchFigure";
import { MotionCrossing, WorldAperture } from "../components/EvidenceGraphics";
import { getAt, setAt } from "../lib/urlstate";

export function Findings() {
  const initial = () => STUDIES.find((s) => s.id === getAt())?.id ?? "batching";
  const [selected, setSelected] = useState<string>(initial),
    [view, setView] = useState(
      () => new URLSearchParams(location.search).get("view") ?? "batch1",
    ),
    [detail, setDetail] = useState(false);
  useEffect(() => {
    const pop = () => {
      setSelected(initial());
      setView(new URLSearchParams(location.search).get("view") ?? "batch1");
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
    const [continuation, readme, value, corrections, resolution, fixtures] =
      await Promise.all([
        editionJson("docs/CONTINUATION.json"),
        editionJson("research/releases/2026-10-11/evidence.json"),
        editionJson("research/value-disproof/0.1.0/results.json"),
        editionJson("evidence/claim-status-register-2026-10-10.json"),
        editionJson("research/resolution-identifiability/0.1.0/result.json"),
        editionJson("research/metric-aggregation-control/0.1.0/fixtures.json"),
      ]);
    return { continuation, readme, value, corrections, resolution, fixtures };
  }, []);
  const choose = (id: string) => {
    setSelected(id);
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
  const c = data.data.continuation.data,
    d = c[study.key];
  let figure: React.ReactNode;
  if (study.id === "batching")
    figure = (
      <BatchFigure
        fixtures={data.data.fixtures.data}
        data={d}
        view={
          ["batch1", "batch2", "corrected"].includes(view) ? view : "batch1"
        }
        onChange={changeView}
      />
    );
  else if (study.id === "empty") {
    const corrected = view === "corrected",
      scores = corrected ? d.authored_corrected_AUSRC : d.authored_native_AUSRC;
    figure = (
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
        <div className="empty-opportunity">
          <span className="empty-frame">∅</span>
          <div>
            <h2>Observed empty</h2>
            <p>
              A successful run with zero detections still contributes an
              evaluation opportunity.
            </p>
          </div>
        </div>
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
            : "Omitting empty outputs can reward the wrong candidate."}
        </p>
      </>
    );
  } else if (study.id === "motion")
    figure = (
      <>
        <MotionCrossing data={d} />
        <div className="opportunity-strip">
          <span>
            <b>{d.primary_disagreements.vision}</b> vision
          </span>
          <span>
            <b>{d.primary_disagreements.trajectory}</b> trajectory
          </span>
        </div>
        <p>
          Among clips with an applicable rule and no violation, these fractions
          still disagree with the released oracle on a rule-involved question.
          The scores have different denominators.
        </p>
      </>
    );
  else if (study.id === "review")
    figure = (
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
        <p className="figure-takeaway">
          {d.forced_ordinary_class_switches} forced ordinary-class switches.
        </p>
        <p>
          Each mark is one recorded object, not an independent trial. “Cannot
          solve” and “no strict majority” remain distinct unresolved outcomes.
        </p>
      </>
    );
  else if (study.id === "reference")
    figure = (
      <>
        <IntervalFigure
          lower={d.sharp_family_interval[0]}
          upper={d.sharp_family_interval[1]}
          points={[
            {
              name: `COCO-ReM ${d.delta_revised}`,
              value: d.delta_revised,
              id: "revised",
            },
            {
              name: `COCO 2017 +${d.delta_original}`,
              value: d.delta_original,
              id: "original",
            },
          ]}
        />
        <p>
          Δ = loss at threshold 0.25 − loss at 0.50. Positive favors 0.50;
          negative favors 0.25.
        </p>
        <PairBars
          max={d.simulated_conventional_reveals}
          rows={[
            {
              name: "Conventional simulated disclosures",
              value: d.simulated_conventional_reveals,
            },
            { name: "Hindsight minimum", value: d.hindsight_minimum_reveals },
          ]}
          caption="Count only · the ideal method knows answers in advance · no human work saving measured"
        />
      </>
    );
  else if (study.id === "resolution") {
    const richer = view === "policy",
      r = data.data.resolution.data.cases.find(
        (x: any) =>
          x.case_id === (richer ? "policy_record_available" : "hidden_policy"),
      );
    figure = (
      <>
        <Segments
          label="Available observation channel"
          value={richer ? "policy" : "image"}
          onChange={changeView}
          options={[
            { id: "image", label: "Image review only" },
            { id: "policy", label: "Include policy record" },
          ]}
        />
        <WorldAperture distinct={richer} />
        <p className="figure-takeaway">{r.state.replaceAll("_", " ")}.</p>
        <p>
          {richer
            ? "The declared policy observation distinguishes these two worlds."
            : "Identical available observations leave worlds with incompatible acceptable decisions. More of the same review cannot guarantee resolution."}
        </p>
        <p>
          {d.named_cases} named cases · {d.exhaustive_models.toLocaleString()}{" "}
          exhaustive finite models checked.
        </p>
      </>
    );
  } else if (study.id === "value") {
    const v = data.data.value.data;
    figure = (
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
          caption="Hypothetical reveals · equal information · complete economic cost unknown"
        />
        <div className="opportunity-strip">
          <span>
            <b>
              {v.totals.C.resolved}/{v.totals.C.assigned}
            </b>{" "}
            Reiyah resolved
          </span>
          <span>
            <b>
              {v.totals.D.resolved}/{v.totals.D.assigned}
            </b>{" "}
            conventional resolved
          </span>
        </div>
        <p className="figure-takeaway">
          No selection advantage demonstrated on this family.
        </p>
        <p>
          The practical test remains the same justified decision with less
          complete work. Preparation, review, checking and unresolved cases all
          count.
        </p>
      </>
    );
  } else
    figure = (
      <div className="correction-list">
        {data.data.corrections.data.claims
          .filter(
            (x: any) => x.status === "withdrawn_as_stated" && x.refutation,
          )
          .map((x: any) => (
            <article key={x.claim_id}>
              <span className="eyebrow">
                Withdrawn as stated · scientific use forbidden
              </span>
              <h2>{x.estimand}</h2>
              <p>{x.refutation.statement}</p>
            </article>
          ))}
      </div>
    );
  return (
    <section
      className="research-station findings-cinematic"
      aria-label="Research findings"
    >
      <div className="research-top">
        <EditionLabel />
        <ShareReading />
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
      <div className="finding-layout">
        <article className="finding-main">
          <header>
            <div className="eyebrow">
              Study {String(STUDIES.indexOf(study) + 1).padStart(2, "0")} /{" "}
              {study.kind}
            </div>
            <h1>{study.title}</h1>
            <p className="research-deck">{study.subtitle}</p>
          </header>
          <div className="finding-figure" key={study.id}>
            {figure}
          </div>
          {study.id === "batching" && (
            <SourceLine
              path={data.data.fixtures.file.path}
              sha={data.data.fixtures.file.sha256}
            />
          )}
          <p className="research-limit">{study.limit}</p>
          <SourceLine
            path={data.data.continuation.file.path}
            sha={data.data.continuation.file.sha256}
          />
        </article>
        <aside className="finding-reading">
          <div className="study-spine" aria-hidden="true">
            {STUDIES.map((s, i) => (
              <span key={s.id} data-current={s.id === study.id}>
                <i />
                {String(i + 1).padStart(2, "0")}
              </span>
            ))}
          </div>
          <div className="reading-top">
            <span className="eyebrow">
              EVIDENCE / {String(STUDIES.indexOf(study) + 1).padStart(2, "0")}
            </span>
            <h2>Behind the finding.</h2>
            <button
              className="research-button"
              aria-expanded={detail}
              onClick={() => setDetail(!detail)}
            >
              {detail ? "Close record" : "Read evidence & method"}
            </button>
          </div>
          <p>
            Open the study for its complete method, controls, reference
            definitions, provenance and limits.
          </p>
          {detail && (
            <DocumentReader key={study.id} path={studyPath(study.family)} />
          )}
        </aside>
      </div>
    </section>
  );
}
