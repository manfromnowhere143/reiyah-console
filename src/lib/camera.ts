/* The stations: the instrument's map. Three rails, one order. The stage
   cross-fades in place (App.tsx); the dock and the field index read this list.
   The earlier world-space damped camera is retired with its row/col grid. */

export type Rail = "engine" | "measurement" | "audit";
export const RAILS: Array<{ id: Rail; name: string; kicker: string }> = [
  { id: "engine", name: "The Engine", kicker: "gate a · the sealed architecture" },
  { id: "measurement", name: "The Measurement", kicker: "gate b · public data, proposed" },
  { id: "audit", name: "The Audit", kicker: "the reference examined" },
];

export interface StationDef {
  id: string;
  num: string;
  name: string;
  desc: string;
  rail: Rail;
  red?: boolean;
}

/* the dock's order is the rails' order: the engine, then what was measured
   with it, then the audit of the measurement's own reference */
export const STATIONS: StationDef[] = [
  { id: "harbor", num: "ST–00", name: "Harbor", desc: "the living engine", rail: "engine" },
  { id: "system", num: "ST–09", name: "The Seeing", desc: "the whole of Reiyah, one mandala", rail: "engine" },
  { id: "ledger", num: "ST–01", name: "Ledger", desc: "every artifact digest-bound", rail: "engine" },
  { id: "lineage", num: "ST–02", name: "Lineage", desc: "releases as chain of custody", rail: "engine" },
  { id: "encounter", num: "ST–03", name: "Encounter", desc: "the six-kind chain, alive", rail: "engine" },
  { id: "controls", num: "ST–04", name: "Controls", desc: "controls, twin evaluations", rail: "engine" },
  { id: "estimands", num: "ST–05", name: "Estimands", desc: "instruments awaiting first light", rail: "engine" },
  { id: "adversaries", num: "ST–06", name: "Adversaries", desc: "the known-bad wall", rail: "engine" },
  { id: "contract", num: "ST–10", name: "The Contract", desc: "schemas, coverage, what is not claimed", rail: "engine" },
  { id: "chair", num: "ST–07", name: "The Chair", desc: "the correction engine · the seat", rail: "engine", red: true },
  { id: "frontier", num: "ST–08", name: "Frontier", desc: "pointers, honestly ineligible", rail: "engine" },
  { id: "measurement", num: "ST–11", name: "The Measurement", desc: "camera and lidar fail together", rail: "measurement" },
  { id: "worstgroup", num: "ST–12", name: "The Worst Group", desc: "where redundancy is weakest", rail: "measurement" },
  { id: "windshield", num: "ST–13", name: "The Windshield", desc: "both sides · the human channel", rail: "measurement" },
  { id: "samehazard", num: "ST–14", name: "The Same Hazard", desc: "human and automation on one object", rail: "measurement" },
  { id: "law", num: "ST–15", name: "The Law", desc: "one estimand, three domains", rail: "measurement" },
  { id: "monitor", num: "ST–16", name: "The Monitor", desc: "joint failure, read live", rail: "measurement" },
  { id: "reference", num: "ST–17", name: "The Reference", desc: "the two horizons · the ghost re-examined", rail: "audit" },
];

export function stationById(id: string | null): StationDef {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[4];
}

function urlStation(): string {
  return new URLSearchParams(location.search).get("st") ?? "harbor";
}
