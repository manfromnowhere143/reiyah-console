/* The Gate B lane, read from one exact Git commit.
   One module shared by the sealer and the live server, so the two sources can
   never disagree about which files the lane contains or how they are read.

   Reading from a ref (not a checked-out worktree) is the honest choice: the
   bytes belong to an exact, immutable commit; the identity recorded beside
   them is that commit's; there is no dirty-tree ambiguity to report because
   nothing is read from disk. GATEB_REF names the ref inside the engine repo
   (REIYAH_ROOT). GATEB_ROOT keeps the older worktree path as a fallback. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const REPO = process.env.REIYAH_ROOT ?? "/Users/danielwahnich/workspace/reiyah";
export const GATEB_REF = process.env.GATEB_REF ?? "research/2026-09-07-physical-reference-transfer";
export const GATEB_ROOT = process.env.GATEB_ROOT ?? "/Users/danielwahnich/workspace/reiyah-gate-b";

/* which lane files the instrument may read: transcripts, aggregates, the
   registers, the narratives. Directory rules so a new result is sealed the
   moment it is committed; the fixed list carries the artifacts stations name.
   Sibling ledgers are excluded on purpose: this instrument renders Reiyah. */
const DIR_RULES = [
  ["evidence", /^claim-status-register-\d{4}-\d{2}-\d{2}\.json$/],
  ["evidence/measurement", /\.(txt|json|jsonl)$/],
  ["evidence/research-board", /\.json$/],
  ["evidence/reference-study", /\.json$/],
  ["evidence/developer-value", /^(?!sibling-).*\.json$/],
  ["human-channel/evidence", /\.txt$/],
  ["llm-generalization/evidence", /\.txt$/],
  ["human-channel", /\.md$/],
  ["llm-generalization", /\.md$/],
  ["docs", /^(RESULT_|GATE_B_|GENERAL_SYNTHESIS|RESEARCH_BOARD|RESEARCH_CONTINUATION|REFERENCE_|DEVELOPER_|M4_|PHYSICAL_REFERENCE|RSS_TRANSFER|SELECTION_POLICY|CACHE_SELECTION|OPPORTUNITY_CLOCK|INDEPENDENT_OPPORTUNITY|MEASUREMENT_CONSUMER|MEASUREMENT_THREATS|THREATS_HUMAN|ESTIMAND_RSS|EXTERNAL_REVIEW|CONTRACT_CAUGHT|FIRST_SEMANTICALLY|SCHEMA_1_3|AUDIT_INFERENCE|CLAIM_AUDIT|REVIEW_MODEL|PUBLIC_DATA_CUSTODY|PRIMARY_SOURCE|HUMAN_CHANNEL_FEASIBILITY|MONITOR_INTERFACE|PREREGISTRATION_MODALITY|INTERFACE_EVIDENCE|VISION_REVIEW).*\.md$/],
  ["docs/preregistrations", /\.md$/],
  ["docs/figures", /\.svg$/],
  ["research/reference-study/0.2.0", /\.(json|md)$/],
  ["research/reference-audit/0.1.0", /\.json$/],
];
const FIXED = [
  "docs/gate_b_robustness_figure.svg",
  "evidence/measurement/joint-performance-nuscenes-val.excerpt.json",
  "evidence/measurement/worst-group-records.jsonl",
];

/* ---- a lane source: ref-backed or worktree-backed, same interface ---- */
export function openLane() {
  const refSource = tryRef();
  if (refSource) return refSource;
  return tryWorktree();
}

function tryRef() {
  const g = (args) => execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", maxBuffer: 1 << 26 }).trim();
  let head;
  try { head = g(["rev-parse", "--verify", `${GATEB_REF}^{commit}`]); } catch { return null; }
  const tree = g(["rev-parse", `${head}^{tree}`]);
  const commitCount = Number(g(["rev-list", "--count", head]));
  const authored = g(["show", "-s", "--format=%cI", head]);
  const listed = new Set(g(["ls-tree", "-r", "--name-only", head]).split("\n").filter(Boolean));
  const files = selectFiles((dir, re) => [...listed].filter((p) => p.startsWith(dir + "/") && !p.slice(dir.length + 1).includes("/") && re.test(p.slice(dir.length + 1))).sort(), (rel) => listed.has(rel));
  const read = (rel) => execFileSync("git", ["-C", REPO, "show", `${head}:${rel}`], { maxBuffer: 1 << 26 });
  return {
    kind: "git_ref",
    identity: { state: "observed", head, tree, branch: GATEB_REF, ref: GATEB_REF, committed_at: authored, worktree_clean: true, source: "git_ref", commit_count: commitCount, root: REPO },
    files, read,
  };
}

function tryWorktree() {
  const g = (args) => execFileSync("git", ["-C", GATEB_ROOT, ...args], { encoding: "utf8" }).trim();
  const head = g(["rev-parse", "HEAD"]);
  const files = selectFiles((dir, re) => { try { return fs.readdirSync(path.join(GATEB_ROOT, dir)).filter((f) => re.test(f)).sort().map((f) => `${dir}/${f}`); } catch { return []; } }, (rel) => fs.existsSync(path.join(GATEB_ROOT, rel)));
  return {
    kind: "worktree",
    identity: { state: "observed", head, branch: g(["branch", "--show-current"]), worktree_clean: g(["status", "--porcelain=v1"]) === "", source: "worktree", commit_count: Number(g(["rev-list", "--count", "HEAD"])), root: GATEB_ROOT },
    files, read: (rel) => fs.readFileSync(path.join(GATEB_ROOT, rel)),
  };
}

function selectFiles(glob, exists) {
  const out = [];
  for (const [dir, re] of DIR_RULES) out.push(...glob(dir, re));
  for (const f of FIXED) if (exists(f)) out.push(f);
  return [...new Set(out)].sort();
}

export const laneId = (rel) => rel.replaceAll("/", "__");
export const sha256 = (bytes) => "sha256:" + createHash("sha256").update(bytes).digest("hex");

export const LANE_NONCLAIMS = { operator_accepted: false, scientific_support_claimed: false, externally_audited: false, lifecycle: "proposed", model_executed_by_this_lane: false };
