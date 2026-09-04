/* Seal a snapshot: copy the exact evidence surface bytes out of the Reiyah
   repository into public/snapshot/, with a manifest recording the identity
   and digest of every file at seal time. The client's WebCrypto verification
   works unchanged on a sealed bundle — a static deploy still proves itself.
   The seal is honest about what it is: a snapshot of one commit at one time,
   never presented as live. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.REIYAH_ROOT ?? "/Users/danielwahnich/workspace/reiyah";
const OUT = new URL("../public/snapshot", import.meta.url).pathname;

const SURFACES = new Map(
  Object.entries({
    index: "gate/GATE_A_EVIDENCE_INDEX.json",
    "index-sidecar": "gate/GATE_A_EVIDENCE_INDEX.sha256",
    protocol: "manifests/protocol/harbor-gate-a-protocol-1.2.0.json",
    mission: "manifests/mission/reiyah-mission-1.1.0.json",
    fixtures: "fixtures/fixture-catalog.json",
    frontier: "evidence/frontier-discovery-register-1.2.0.json",
    "decision-template": "gate/decisions/OPERATOR_DECISION-1.2.5.template.json",
    odi: "gate/operator-decision-interfaces/reiyah.operator-decision-interface-1.2.4.json",
    "chain-observation": "manifests/examples/object-chain/observation.json",
    "chain-belief": "manifests/examples/object-chain/latent-belief.json",
    "chain-decision": "manifests/examples/object-chain/decision.json",
    "chain-intervention": "manifests/examples/object-chain/intervention.json",
    "chain-outcome": "manifests/examples/object-chain/outcome.json",
    "chain-evidence": "manifests/examples/object-chain/evidence.json",
  })
);
for (const f of fs.readdirSync(path.join(REPO, "gate/validation-reports"))) {
  if (f.endsWith(".json")) SURFACES.set(`report-${f.replace(/^gate-a-validation-|\.json$/g, "")}`, `gate/validation-reports/${f}`);
}
for (const d of fs.readdirSync(path.join(REPO, "history"))) {
  const p = `history/${d}/RECOVERY.json`;
  if (fs.existsSync(path.join(REPO, p))) SURFACES.set(`recovery-${d.replace(/^gate-a-/, "")}`, p);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "raw"), { recursive: true });

const opt = { cwd: REPO, encoding: "utf8" };
const identity = {
  state: "observed",
  head: execFileSync("git", ["rev-parse", "HEAD"], opt).trim(),
  branch: execFileSync("git", ["branch", "--show-current"], opt).trim(),
  worktree_clean: execFileSync("git", ["status", "--porcelain=v1"], opt).trim() === "",
  root: REPO,
};

const surfaces = [];
for (const [id, rel] of SURFACES) {
  const bytes = fs.readFileSync(path.join(REPO, rel));
  const sha256 = "sha256:" + createHash("sha256").update(bytes).digest("hex");
  fs.writeFileSync(path.join(OUT, "raw", id), bytes);
  surfaces.push({ id, path: rel, bytes: bytes.length, sha256, state: "observed" });
}

/* path-addressed extras: the correction saga and every governed plan/report,
   so the sealed static deploy can render the full living state */
const EXTRA_GLOBS = [
  "gate/operator-decision-interface-corrections",
  "gate/operator-decision-interface-incidents",
  "gate/operator-decision-interface-reviews",
  "gate/operator-decision-interfaces",
  "gate/operator-decision-inventories",
  "gate/decisions",
  "gate/validation-reports",
  "gate/public-distribution-receipts",
  "validation",
  "evidence",
  "manifests/mission",
  "manifests/protocol",
  "manifests/scientific",
  ...(() => { try { return fs.readdirSync(path.join(REPO, "fixtures")).filter((d) => /^v\d/.test(d)).map((d) => `fixtures/${d}`); } catch { return []; } })(),
];
fs.mkdirSync(path.join(OUT, "p"), { recursive: true });
const catalogEntries = [];
for (const dir of EXTRA_GLOBS) {
  let files = [];
  try { files = fs.readdirSync(path.join(REPO, dir)); } catch { continue; }
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const rel = `${dir}/${f}`;
    try {
      const bytes = fs.readFileSync(path.join(REPO, rel));
      fs.writeFileSync(path.join(OUT, "p", rel.replaceAll("/", "__")), bytes);
      catalogEntries.push({ path: rel, bytes: bytes.length });
    } catch { /* transient */ }
  }
}
fs.writeFileSync(path.join(OUT, "catalog.json"), JSON.stringify({ entries: catalogEntries }, null, 1));

/* the contract layer: an index of every schema, digest-bound at seal time.
   Bodies are not shipped (5.9 MB); each row carries path, bytes, sha256, $id,
   dialect, title and family, computed from the repository bytes. */
const schemaRows = [];
try {
  for (const f of fs.readdirSync(path.join(REPO, "schemas")).sort()) {
    if (!f.endsWith(".json")) continue;
    const rel = `schemas/${f}`;
    const bytes = fs.readFileSync(path.join(REPO, rel));
    let j = {};
    try { j = JSON.parse(bytes.toString("utf8")); } catch { /* recorded as unparsed */ }
    const m = f.match(/^(.*?)-(\d+\.\d+\.\d+)\.schema\.json$/);
    schemaRows.push({
      path: rel, bytes: bytes.length,
      sha256: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
      id: j.$id ?? null, dialect: j.$schema ?? null, title: j.title ?? null,
      family: m ? m[1] : f.replace(/\.schema\.json$/, ""), version: m ? m[2] : null,
      additional_properties_closed: j.additionalProperties === false,
      required_count: Array.isArray(j.required) ? j.required.length : null,
      property_count: j.properties && typeof j.properties === "object" ? Object.keys(j.properties).length : null,
    });
  }
} catch { /* no schemas directory */ }
fs.writeFileSync(path.join(OUT, "schemas-index.json"), JSON.stringify({ kind: "schema_index", sealedFrom: "schemas/", rows: schemaRows }, null, 1));
console.log(`[seal] ${schemaRows.length} schemas indexed`);

const manifest = {
  kind: "sealed_snapshot",
  sealedAt: new Date().toISOString(),
  identity,
  authority_nonclaims: {
    holds_authority_over_reiyah: false,
    creates_operator_acceptance: false,
    creates_scientific_evidence: false,
    is_driver_monitoring_system: false,
  },
  surfaces,
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`[seal] ${surfaces.length} surfaces sealed at ${manifest.sealedAt}`);
console.log(`[seal] identity ${identity.branch} ${identity.head.slice(0, 12)} clean=${identity.worktree_clean}`);
console.log(`[seal] wrote ${OUT}`);
