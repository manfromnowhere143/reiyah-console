import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Blocked, Digest, useSurfaceState } from "../components/primitives";
import { EditionLabel, Segments, DocumentReader, ShareReading } from "../components/Research";
import { exampleJson } from "../lib/example";
import { editionJson, rational } from "../lib/edition";
import "../comparison.css";

function ContractReader({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
    return () => { el.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return createPortal(
    <dialog ref={dialog} className="comparison-reader" aria-labelledby="comparison-reader-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <header>
        <div><span className="eyebrow">The computation</span><h2 id="comparison-reader-title">Two outputs. One shared world.</h2></div>
        <button className="research-button" autoFocus onClick={onClose}>Back to comparison</button>
      </header>
      <div className="comparison-reader-body" tabIndex={0} role="region" aria-label="Comparison contract">
        <EditionLabel />
        <p>Qualify two outputs, keep them on the same reference world, bound their loss difference, and check a proposed certificate. Missing outputs block the comparison; observed empty outputs remain observations.</p>
        <ol className="contract-steps">
          <li>Bind the inputs and declared uncertainty.</li>
          <li>Compare maximum one-to-one matchings.</li>
          <li>Preserve exact, conservative and unavailable bounds.</li>
          <li>Check the certificate and distinguish the propositions.</li>
        </ol>
        <p>These packets were reproduced from the published engine and passed its separate audit checker. That is a local reproduction, not independent replication.</p>
        <DocumentReader path="research/perception-revision/0.1.0/README.md" />
      </div>
    </dialog>, document.body,
  );
}

function SharedWorld({ anchors, confirmed }: { anchors: any[]; confirmed: boolean }) {
  return <div className="comparison-worlds" aria-label="Two outputs on the same reference world">
    {anchors.map((anchor, i) => {
      const unresolved = i === 1 && !confirmed;
      return <figure className="comparison-world" key={anchor.id} data-unresolved={unresolved}>
        <figcaption><span>{anchor.id}</span><span>weight {anchor.weight.numerator}/{anchor.weight.denominator}</span></figcaption>
        <div className="comparison-match-map" role="img" aria-label={`${anchor.id}: output A unmatched; output B matches ${anchor.reference.objects[0].id}. ${unresolved ? "Presence unresolved; deletion is admitted." : "Hypothetically confirmed present."}`}>
          <div className="comparison-match-lane" data-matched="false"><b>A</b><i /><span>no match</span></div>
          <div className="comparison-match-lane" data-matched="true"><b>B</b><i /><span><em aria-hidden="true" />{anchor.reference.objects[0].id}</span></div>
        </div>
        <div className="comparison-world-state"><i aria-hidden="true">{unresolved ? "◇" : "◆"}</i>{unresolved ? "Presence unresolved" : "Confirmed present"}</div>
      </figure>;
    })}
  </div>;
}

function DecisionAxis({ sufficient, lower, upper, witness, tolerance }: {
  sufficient: boolean; lower: number; upper: number; witness: number; tolerance: number;
}) {
  const position = (n: number) => `${((n + 0.5) / 3) * 100}%`;
  const point = sufficient ? lower : witness;
  return <figure className="comparison-axis" aria-label={sufficient
    ? `Exact family enclosure ${lower} to ${upper}; strict improvement requires delta greater than ${tolerance}.`
    : `Checked counterexample delta ${witness}; strict improvement requires delta greater than ${tolerance}. No full-family enclosure supplied.`}>
    <figcaption><span>Δ = loss A − loss B</span><span>Higher favors B</span></figcaption>
    <div className="comparison-axis-plot" role="img" aria-label={`Linear scale −0.5 to 2.5. Threshold ${tolerance}; ${sufficient ? "exact enclosure" : "counterexample"} at ${point}.`}>
      <div className="comparison-axis-advantage" style={{ left: position(tolerance) }} />
      <div className="comparison-axis-line" />
      {[0, 1, 2].map((n) => <div className="comparison-axis-tick" key={n} style={{ left: position(n) }}><i /><span>{n}</span></div>)}
      <div className="comparison-axis-threshold" style={{ left: position(tolerance) }}><span>τ = {tolerance}</span></div>
      <div className="comparison-axis-point" data-sufficient={sufficient} style={{ left: position(point) }}><i /><strong>{sufficient ? `[${lower}, ${upper}]` : `Δ = ${witness}`}</strong></div>
    </div>
    <p>{sufficient ? "Exact finite-family enclosure." : <>Delete the unconfirmed object: Δ reaches τ. Checked counterexample only; no full-family enclosure.</>}</p>
  </figure>;
}

export function Comparison() {
  const selected = () => new URLSearchParams(location.search).get("view") === "confirmed" ? "confirmed" : "insufficient";
  const [which, setWhich] = useState(selected), [inspect, setInspect] = useState(false);
  useEffect(() => {
    const pop = () => { setWhich(selected()); setInspect(false); };
    window.addEventListener("popstate", pop);
    window.addEventListener("reiyah:reading", pop);
    return () => { window.removeEventListener("popstate", pop); window.removeEventListener("reiyah:reading", pop); };
  }, []);
  const state = useSurfaceState(async () => {
    const [yes, no, input] = await Promise.all([
      exampleJson("confirmed.json"), exampleJson("insufficient.json"),
      editionJson("research/perception-revision/0.1.0/replacement-example.json"),
    ]);
    return { yes, no, input };
  }, []);
  if (state.phase === "loading") return <p role="status">Reading the engine packets…</p>;
  if (state.phase === "blocked") return <Blocked reason={state.reason} />;
  const chosen = which === "confirmed" ? state.data.yes : state.data.no;
  const r = chosen.data.payload.result;
  const exact = (q: any) => rational(`${q.numerator}/${q.denominator}`);
  const sufficient = r.sufficiency === "sufficient";
  const tolerance = exact(state.data.input.data.loss.tolerance);
  return <section className="research-station comparison-instrument" aria-label="Conditional comparison engine">
    <div className="research-top"><EditionLabel /><ShareReading compact /></div>
    <header className="comparison-heading">
      <div><span className="eyebrow">Actual engine packets · synthetic example</span><h1>Enough evidence for which claim?</h1></div>
      <p>Strict improvement and preference are different questions.</p>
    </header>
    <div className="comparison-control-row">
      <Segments label="Hypothetical reference observations" value={which} onChange={(v) => {
        setWhich(v); const u = new URL(location.href); u.searchParams.set("view", v); history.replaceState(history.state, "", u.pathname + u.search);
      }} options={[{ id: "insufficient", label: "Confirm one object" }, { id: "confirmed", label: "Confirm both objects" }]} />
      <span className="comparison-observation-count">{r.supplied_observations} / 2 hypothetical confirmations</span>
    </div>
    <div className="comparison-workbench">
      <div className="comparison-inputs"><div className="comparison-section-label"><span>01</span> Shared reference world</div><SharedWorld anchors={state.data.input.data.anchors} confirmed={sufficient} /><p className="comparison-graph-note">A stays unmatched. B matches each retained object.</p></div>
      <div className="comparison-result">
        <div className="comparison-section-label"><span>02</span> Check the proposition</div>
        <DecisionAxis sufficient={sufficient} lower={r.bounds ? exact(r.bounds.lower) : 0} upper={r.bounds ? exact(r.bounds.upper) : 0} witness={r.counterexample_value ? exact(r.counterexample_value) : 0} tolerance={tolerance} />
        <div className="comparison-verdicts" aria-live="polite">
          <div data-supported={sufficient}><span>Strict improvement · Δ &gt; {tolerance}</span><strong>{sufficient ? "Supported in this family" : "Observations insufficient"}</strong></div>
          <div><span>Preference without that margin</span><strong>{sufficient ? "B has lower loss" : "This witness still favors B"}</strong></div>
        </div>
      </div>
    </div>
    <footer className="comparison-footer">
      <p className="research-limit"><span>Scope</span>At most one reference deletion. Hypothetical answers, equal weights, unit FP/FN penalties. No real audit occurred. Physical truth, statistical confidence and saved human work remain unestablished.</p>
      <div className="comparison-source-actions"><Digest id={`example/${which}.json`} sha={chosen.sha} path={`synthetic replay/${which}.json`} /><button className="research-button" aria-haspopup="dialog" onClick={() => setInspect(true)}>Method & contract <span aria-hidden="true">↗</span></button></div>
    </footer>
    {inspect && <ContractReader onClose={() => setInspect(false)} />}
  </section>;
}
