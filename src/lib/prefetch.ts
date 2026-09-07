/* Load on demand. A station declares the bytes it reads; the instrument
   fetches the active station's bytes when it mounts (the station itself does
   that) and, in idle time, only its two dock neighbours' bytes and code, so
   the next press lands instantly without paying for the whole field up front.
   Every fetch here goes through the same memoised, digest-checked readers the
   stations use: prefetching is a head start, never a second source. */
import { STATIONS } from "./camera";
import { fetchCatalog, fetchSchemaIndex, fetchSurface } from "./evidence";
import { fetchLane, fetchLaneText, registerPath } from "./gateb";

export interface Needs { surfaces?: string[]; lane?: string[]; register?: boolean; catalog?: boolean; schemas?: boolean }

/* the lane transcripts each station parses, by repo-relative path */
const L = {
  L: "evidence/measurement/result_l.txt", N: "evidence/measurement/result_n.txt", O: "evidence/measurement/result_o.txt",
  P: "evidence/measurement/result_p.txt", Q: "evidence/measurement/result_q.txt", I: "evidence/measurement/result_i.txt",
  S: "evidence/measurement/result_s.txt", HI: "evidence/measurement/result_h_instance_unit.txt",
  WG: "evidence/measurement/worst-group-records.jsonl", AO: "evidence/measurement/result_ao.json",
  Z: "evidence/measurement/result_z.txt", AA: "evidence/measurement/result_aa.txt", AB: "evidence/measurement/result_ab.txt",
  H1: "human-channel/evidence/h1_driver_observation.txt", H2: "human-channel/evidence/h2_glance_at_conflict.txt",
  H3: "human-channel/evidence/h3_observation_response_joint.txt", H4: "human-channel/evidence/h4_dcpt_takeover.txt",
  H5: "human-channel/evidence/h5_cross_agent_joint.txt", H5MD: "human-channel/H5_CROSS_AGENT_JOINT.md",
  H6: "human-channel/evidence/h6_total_both_miss.txt", H7: "human-channel/evidence/h7_intervals.txt",
  T: "llm-generalization/evidence/result_t.txt", U: "llm-generalization/evidence/result_u.txt", V: "llm-generalization/evidence/result_v.txt",
  X: "llm-generalization/evidence/result_x.txt", X2: "llm-generalization/evidence/result_x2.txt", AC: "llm-generalization/evidence/result_ac.txt",
  SEL: "evidence/reference-study/selection-aggregate-0.2.0.json", RDY: "evidence/reference-study/readiness-aggregate-0.2.0.json",
  FRZ: "research/reference-study/0.2.0/freeze.json",
};

export const NEEDS: Record<string, Needs> = {
  harbor: { surfaces: ["fixtures"], catalog: true, register: true, lane: [L.L, L.H3, L.H6, L.AC, L.V] },
  system: { surfaces: ["protocol"], catalog: true },
  ledger: {},
  lineage: { surfaces: ["odi"], catalog: true },
  encounter: { surfaces: ["chain-observation", "chain-belief", "chain-decision", "chain-intervention", "chain-outcome", "chain-evidence"], lane: [L.RDY, L.SEL] },
  controls: { catalog: true },
  estimands: { surfaces: ["protocol"] },
  adversaries: { surfaces: ["fixtures"], catalog: true },
  chair: { surfaces: ["odi"], catalog: true },
  frontier: { surfaces: ["frontier"], catalog: true },
  contract: { surfaces: ["fixtures", "frontier", "mission"], schemas: true },
  measurement: { register: true, lane: [L.L, L.N, L.O, L.P, L.Q] },
  worstgroup: { lane: [L.WG, L.I] },
  windshield: { register: true, lane: [L.L, L.H1, L.H2, L.H3, L.H4, L.H5, L.H6, L.H7, L.S] },
  samehazard: { register: true, lane: [L.H5, L.H5MD, L.H3, L.P, L.H6] },
  law: { register: true, lane: [L.L, L.HI, L.H3, L.H5, L.H6, L.T, L.U, L.AC, L.H7] },
  monitor: { register: true, lane: [L.V, L.X, L.X2, L.Z, L.AA, L.AB] },
  reference: { register: true, lane: [L.AO, L.SEL, L.RDY, L.FRZ] },
};

const idle = (cb: () => void) => ((window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 400));
const done = new Set<string>();

/* fetch one station's declared bytes; every reader is memoised, so repeats
   are free and a station that later mounts finds its bytes already here */
export async function prefetchStation(id: string): Promise<void> {
  if (done.has(id)) return;
  done.add(id);
  const n = NEEDS[id];
  if (!n) return;
  const jobs: Promise<unknown>[] = [];
  if (n.catalog) jobs.push(fetchCatalog().catch(() => null));
  if (n.schemas) jobs.push(fetchSchemaIndex().catch(() => null));
  for (const s of n.surfaces ?? []) jobs.push(fetchSurface(s).catch(() => null));
  if (n.lane?.length || n.register) {
    jobs.push((async () => {
      const lane = await fetchLane().catch(() => null);
      if (!lane?.present) return;
      const paths = [...(n.lane ?? [])];
      if (n.register) paths.push(await registerPath());
      await Promise.all(paths.map((p) => fetchLaneText(p).catch(() => null)));
    })());
  }
  await Promise.all(jobs);
}

/* the station's code, split per station by the bundler; imported here so the
   neighbours' chunks are in the HTTP cache before they are pressed */
export const STATION_CODE: Record<string, () => Promise<unknown>> = {
  system: () => import("../stations/SystemAtlas"),
  ledger: () => import("../stations/Ledger"),
  lineage: () => import("../stations/Lineage"),
  encounter: () => import("../stations/Encounter"),
  controls: () => import("../stations/Controls"),
  estimands: () => import("../stations/Estimands"),
  adversaries: () => import("../stations/Adversaries"),
  chair: () => import("../stations/Chair"),
  frontier: () => import("../stations/Frontier"),
  contract: () => import("../stations/Contract"),
  measurement: () => import("../stations/Measurement"),
  worstgroup: () => import("../stations/WorstGroup"),
  windshield: () => import("../stations/Windshield"),
  samehazard: () => import("../stations/SameHazard"),
  law: () => import("../stations/Law"),
  monitor: () => import("../stations/Monitor"),
  reference: () => import("../stations/Reference"),
};

/* after a station has rendered: in idle time, warm its two dock neighbours
   (code first, then bytes), then the Harbor, and nothing else */
export function prefetchNeighbours(active: string): void {
  const i = STATIONS.findIndex((s) => s.id === active);
  if (i < 0) return;
  const targets = [STATIONS[(i + 1) % STATIONS.length].id, STATIONS[(i - 1 + STATIONS.length) % STATIONS.length].id, "harbor"].filter((t) => t !== active);
  idle(() => {
    for (const t of targets) {
      STATION_CODE[t]?.().catch(() => {});
      prefetchStation(t).catch(() => {});
    }
  });
}

/* after the first screen has settled: warm the whole field, gently. One
   station at a time, in dock order outward from the active one, each in idle
   time, so the network is never flooded and the first press of any station
   finds its code and bytes already here. The shared surfaces (index, fixture
   catalog, register) are memoised, so the remaining field costs about 600 KB
   over the wire in total. Skipped under a data-saver preference. */
let warmingAll = false;
export function warmFieldGently(active: string): void {
  if (warmingAll) return;
  warmingAll = true;
  const conn = (navigator as any).connection;
  if (conn?.saveData) return;
  const i = Math.max(0, STATIONS.findIndex((s) => s.id === active));
  const order: string[] = [];
  for (let k = 1; k < STATIONS.length; k++) { for (const j of [i + k, i - k]) { const s = STATIONS[(j + STATIONS.length) % STATIONS.length]; if (s && !order.includes(s.id) && s.id !== active) order.push(s.id); } }
  const step = (n: number) => {
    if (n >= order.length) return;
    idle(async () => {
      const id = order[n];
      try { await STATION_CODE[id]?.(); } catch { /* pressed later, fetched then */ }
      try { await prefetchStation(id); } catch { /* the station reports it */ }
      step(n + 1);
    });
  };
  setTimeout(() => step(0), 1200);
}
