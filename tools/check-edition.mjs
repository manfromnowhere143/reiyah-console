import fs from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const read = (p) => fs.readFileSync(p),
  json = (p) => JSON.parse(read(p)),
  sha = (b) => "sha256:" + createHash("sha256").update(b).digest("hex");
let checked = 0;
function check(p, row) {
  const b = read(p);
  assert.equal(sha(b), row.sha256, p);
  if (row.bytes !== undefined) assert.equal(b.length, row.bytes, p);
  checked++;
}
const root = json("public/snapshot/manifest.json");
for (const f of root.surfaces)
  if (f.state === "observed") check(`public/snapshot/raw/${f.id}`, f);
for (const [p, s] of Object.entries(root.bindings))
  check("public/snapshot/" + p, { sha256: s });
for (const f of json("public/snapshot/catalog.json").entries)
  check(`public/snapshot/p/${f.path.replaceAll("/", "__")}`, f);
for (const f of json("public/snapshot/gateb/manifest.json").files)
  if (f.state !== "absent") check(`public/snapshot/gateb/raw/${f.id}`, f);
const binding = json("src/lib/edition-binding.json"),
  base = `public/editions/${binding.commit}`;
check(base + "/manifest.json", binding);
const m = json(base + "/manifest.json");
for (const f of m.files) check(`${base}/raw/${f.sha256.slice(7)}`, f);
const get = (p) => {
  const f = m.files.find((f) => f.path === p);
  assert.ok(f, p);
  return json(`${base}/raw/${f.sha256.slice(7)}`);
};
const c = get("docs/CONTINUATION.json");
assert.equal(c.evidence.length, 52);
for (const f of c.evidence)
  assert.equal(
    m.files.find((x) => x.path === f.path)?.sha256,
    "sha256:" + f.sha256,
    f.path,
  );
assert.equal(c.production_ready, false);
assert.equal(c.work_saving_established, false);
const fixtures = get("research/metric-aggregation-control/0.1.0/fixtures.json");
const rat = (s) => {
  const [a, b = 1] = String(s).split("/").map(Number);
  return a / b;
};
for (const candidate of ["A", "B"]) {
  const row = fixtures.cases.find((c) => c.id === `primary_${candidate}`);
  const values = row.images
    .map((im) => im.detections.map((d) => 1 - rat(d.probability)))
    .flat();
  const expected = values.reduce((a, b) => a + b, 0) / values.length;
  assert.equal(
    expected,
    rat(c.metric_aggregation_control.corrected_primary_TVD[candidate]),
  );
  assert.equal(
    expected,
    rat(c.metric_aggregation_control.native_primary_TVD.chunk_1[candidate]),
  );
  assert.equal(
    values.at(-1),
    rat(
      c.metric_aggregation_control.native_primary_TVD.chunk_2_or_64_order_1_2[
        candidate
      ],
    ),
  );
}
const claims = get("evidence/claim-status-register-2026-10-10.json");
assert.equal(claims.version, "0.2.30");
assert.equal(claims.claims.length, 60);
for (const suffix of [
  "selected-coincidence-population-bound",
  "universal-kind-independence-law",
  "cross-agent-safety-evidence-credit",
]) {
  const cl = claims.claims.find((c) => c.claim_id.endsWith(suffix));
  assert.equal(cl.status, "withdrawn_as_stated");
  assert.equal(cl.current_scientific_use, "forbidden");
}
const example = json("src/lib/example-binding.json");
check("public" + example.base + "/manifest.json", {
  sha256: example.manifest_sha256,
});
for (const f of example.files) check("public" + example.base + "/" + f.name, f);
console.log(
  JSON.stringify(
    {
      kind: "console_edition_integrity",
      checked_files: checked,
      local_research_records: m.files.length,
      continuation_bindings: c.evidence.length,
      claim_count: claims.claims.length,
      batch_figure_arithmetic: "matches_authored_fixtures",
      historical_experiments_replayed: false,
      browser_review: false,
      passed: true,
    },
    null,
    2,
  ),
);
