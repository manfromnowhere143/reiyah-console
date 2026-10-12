import { Segments, PairBars } from "./Research";
import { BatchCircuit } from "./EvidenceGraphics";
import { rational } from "../lib/edition";
export function BatchFigure({
  fixtures,
  data,
  view,
  onChange,
}: {
  fixtures: any;
  data: any;
  view: string;
  onChange: (v: string) => void;
}) {
  const corrected = view === "corrected",
    two = view === "batch2";
  const source = corrected
    ? data.corrected_primary_TVD
    : two
      ? data.native_primary_TVD.chunk_2_or_64_order_1_2
      : data.native_primary_TVD.chunk_1;
  const a = rational(source.A),
    b = rational(source.B);
  return (
    <>
      <Segments
        label="Processing configuration"
        value={view}
        onChange={onChange}
        options={[
          { id: "batch1", label: "Batch of 1" },
          { id: "batch2", label: "Batch of 2" },
          { id: "corrected", label: "Local correction" },
        ]}
      />
      <BatchCircuit fixtures={fixtures} omitted={two} a={a} b={b} />
      <PairBars
        max={0.5}
        rows={[
          { name: "Candidate A", value: a, tone: a < b ? "selected" : "" },
          { name: "Candidate B", value: b, tone: b < a ? "selected" : "" },
        ]}
        caption="Mean total variation distance · scale 0–0.50 · lower is better"
      />
      <p className="figure-takeaway">
        {corrected
          ? "Every eligible detection contributes. A retains the lower error."
          : two
            ? "The predictions stayed fixed. The reported ranking reversed."
            : "A has the lower reported error. Change only the batch size."}
      </p>
    </>
  );
}
