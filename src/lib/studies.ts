export const STUDIES = [
  {
    id: "batching",
    label: "Batching",
    title: "The predictions stayed fixed.",
    subtitle: "The reported ranking reversed.",
    kind: "Constructed evaluator control",
    family: "metric-aggregation-control",
    key: "metric_aggregation_control",
    limit:
      "The failure and local correction are established on constructed cases. The effect on published empirical rankings remains unknown.",
  },
  {
    id: "empty",
    label: "Empty outputs",
    title: "An empty output is still an observation.",
    subtitle: "The opportunity must stay in the denominator.",
    kind: "Constructed evaluator control",
    family: "empty-output-score-control",
    key: "empty_output_scoring_control",
    limit:
      "Authored inputs exercise the released evaluator. Historical inference completion and published empirical impact remain unknown.",
  },
  {
    id: "motion",
    label: "Motion",
    title: "Consistent answers can disagree with the reference.",
    subtitle: "Two evaluation targets, two different rankings.",
    kind: "Saved-file audit · EgoDyn-Bench",
    family: "motion-consistency-audit",
    key: "motion_consistency_audit",
    limit:
      "A descriptive comparison of two saved runs. No causal trajectory effect, physical safety or Reiyah performance advantage is established.",
  },
  {
    id: "review",
    label: "Review",
    title: "What a review resolves depends on the procedure.",
    subtitle: "The object stays fixed. The decision can change.",
    kind: "Recorded-response sensitivity · Cityscapes",
    family: "review-procedure-sensitivity",
    key: "review_procedure_sensitivity",
    limit:
      "Observed response supports, not physical truth or authenticated independent voters. A future review channel and a causal procedure effect remain unqualified.",
  },
  {
    id: "reference",
    label: "Reference",
    title: "Which reference supports the choice?",
    subtitle: "One prediction file. Opposite threshold preferences.",
    kind: "Retrospective threshold comparison · COCO",
    family: "threshold-reference-screen",
    key: "threshold_reference_screen",
    limit:
      "The interval describes declared per-image mixtures of two annotation policies. It is not a confidence interval or a model of physical uncertainty.",
  },
  {
    id: "resolution",
    label: "Resolution",
    title: "More observations may leave the decision unresolved.",
    subtitle: "First ask whether the channel can distinguish the worlds.",
    kind: "Authored finite-model control",
    family: "resolution-identifiability",
    key: "resolution_identifiability",
    limit:
      "Complete, finite, read-only joint outcomes are a declared model. No physical observation channel or product-value case is qualified.",
  },
  {
    id: "value",
    label: "Value test",
    title: "The competent baseline matters.",
    subtitle: "Equal information removed the claimed selection advantage.",
    kind: "Exposed development comparison",
    family: "value-disproof",
    key: "value",
    limit:
      "Twenty dependent development cases with hypothetical answers. Complete human and economic work were not measured.",
  },
  {
    id: "corrections",
    label: "Corrections",
    title: "Corrections belong beside the result.",
    subtitle:
      "Historical measurements remain. Unsupported interpretations do not.",
    kind: "Current claim register · 10 October 2026",
    family: "claim-correction",
    key: "corrections",
    limit:
      "A selected-sample statistic does not establish a population bound, a universal independence law or safety-validation credit.",
  },
] as const;
export const studyPath = (family: string) =>
  `research/${family}/0.1.0/README.md`;
