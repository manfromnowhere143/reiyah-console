/* Publish only public, authored records from one immutable engine commit.
   Never reads a mutable worktree or deletes the prior edition. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const [repo, commit] = process.argv.slice(2);
if (!repo || !/^[a-f0-9]{40}$/.test(commit ?? ""))
  throw Error("usage: node tools/publish-edition.mjs ENGINE_REPO EXACT_COMMIT");
const git = (...args) =>
  execFileSync("git", ["-C", repo, ...args], { maxBuffer: 32 << 20 });
if (git("rev-parse", `${commit}^{commit}`).toString().trim() !== commit)
  throw Error("commit mismatch");
const read = (p) => git("show", `${commit}:${p}`);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const continuation = JSON.parse(read("docs/CONTINUATION.json"));
const listed = git("ls-tree", "-r", "--name-only", commit)
  .toString()
  .trim()
  .split("\n");
const selected = new Set([
  "README.md",
  "LICENSE",
  "docs/CONTINUATION.json",
  ...continuation.evidence.map((x) => x.path),
  ...listed.filter((p) => /^research\/.*\/README\.md$/.test(p)),
  ...listed.filter((p) =>
    /^docs\/(PERCEPTION_.*|SCIENTIFIC_CHARTER|CLAIMS_AND_NONCLAIMS|SHARE_A_COMPARISON)\.md$/.test(
      p,
    ),
  ),
  "research/perception-revision/0.1.0/replacement-example.json",
  "research/perception-revision/0.1.0/audit-confirmed-example.json",
  "research/perception-revision/0.1.0/audit-insufficient-example.json",
]);
const out = `public/editions/${commit}`;
fs.mkdirSync(`${out}/raw`, { recursive: true });
const files = [...selected].sort().map((p) => {
  const bytes = read(p),
    digest = sha(bytes),
    binding = continuation.evidence.find((x) => x.path === p);
  if (binding && binding.sha256 !== digest)
    throw Error(`continuation binding mismatch: ${p}`);
  fs.writeFileSync(`${out}/raw/${digest}`, bytes);
  const title = p.endsWith(".md")
    ? bytes.toString().match(/^#\s+(.+)$/m)?.[1]
    : undefined;
  return {
    path: p,
    sha256: `sha256:${digest}`,
    bytes: bytes.length,
    ...(title ? { title } : {}),
    coverage: "local_document",
    continuation_bound: !!binding,
  };
});
const manifest = {
  kind: "reiyah.public-research-edition",
  version: "1.0.0",
  commit,
  as_of: continuation.as_of,
  source: `https://github.com/manfromnowhere143/reiyah/tree/${commit}`,
  authority: "Published evidence reader; no scientific or acceptance authority",
  files,
  catalog: listed
    .filter((p) =>
      /^(research|docs|human-channel|llm-generalization)\/.*\.(md|json|py)$/.test(
        p,
      ),
    )
    .map((p) => ({
      path: p,
      coverage: selected.has(p) ? "local_document" : "source_link",
    })),
};
const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync(`${out}/manifest.json`, bytes);
fs.writeFileSync(
  "src/lib/edition-binding.json",
  JSON.stringify(
    { commit, asOf: continuation.as_of, sha256: `sha256:${sha(bytes)}` },
    null,
    2,
  ) + "\n",
);
// Preserve the historical architecture and measurements. Apply the current
// interpretation register as a separately identified overlay, never relabel history.
const base = "public/snapshot";
const lane = JSON.parse(fs.readFileSync(`${base}/gateb/manifest.json`));
const registers = continuation.evidence.filter((f) =>
  /^evidence\/claim-status-register-.*\.json$/.test(f.path),
);
if (registers.length !== 1)
  throw Error("continuation must bind exactly one current claim register");
const registerPath = registers[0].path;
const rb = read(registerPath),
  id = registerPath.replaceAll("/", "__");
fs.writeFileSync(`${base}/gateb/raw/${id}`, rb);
lane.files = lane.files.filter((f) => f.id !== id);
lane.files.push({
  id,
  path: registerPath,
  bytes: rb.length,
  sha256: `sha256:${sha(rb)}`,
  source_commit: commit,
});
lane.interpretation_overlay = {
  commit,
  path: registerPath,
  as_of: continuation.as_of,
};
fs.writeFileSync(`${base}/gateb/manifest.json`, JSON.stringify(lane, null, 1));
const catalog = JSON.parse(fs.readFileSync(`${base}/catalog.json`));
for (const f of catalog.entries) {
  const b = fs.readFileSync(`${base}/p/${f.path.replaceAll("/", "__")}`);
  f.bytes = b.length;
  f.sha256 = `sha256:${sha(b)}`;
}
fs.writeFileSync(`${base}/catalog.json`, JSON.stringify(catalog, null, 1));
const root = JSON.parse(fs.readFileSync(`${base}/manifest.json`));
root.bindings = Object.fromEntries(
  ["catalog.json", "schemas-index.json", "gateb/manifest.json"].map((p) => [
    p,
    `sha256:${sha(fs.readFileSync(`${base}/${p}`))}`,
  ]),
);
root.research_edition = {
  commit,
  as_of: continuation.as_of,
  sha256: `sha256:${sha(bytes)}`,
};
fs.writeFileSync(`${base}/manifest.json`, JSON.stringify(root, null, 1));
console.log(
  JSON.stringify({
    commit,
    files: files.length,
    continuation: files.filter((x) => x.continuation_bound).length,
    catalog: manifest.catalog.length,
    manifest_sha256: sha(bytes),
  }),
);
