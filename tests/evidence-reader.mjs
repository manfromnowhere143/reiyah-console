/* Behavioral regression tests against the actual TypeScript modules.
   Controlled byte transports; no browser or engine source changes. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import ts from "typescript";
const read = (p) => fs.readFileSync(p),
  sha = (b) => "sha256:" + crypto.createHash("sha256").update(b).digest("hex");
const root = JSON.parse(read("public/snapshot/manifest.json")),
  lane = JSON.parse(read("public/snapshot/gateb/manifest.json"));
const binding = JSON.parse(read("src/lib/edition-binding.json"));
const json = (j) => new Response(JSON.stringify(j));
const results = [];
async function test(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
  } catch (e) {
    results.push({ name, passed: false, error: e.stack });
    process.exitCode = 1;
  }
}
async function instance(transport) {
  const context = vm.createContext({
    fetch: transport,
    crypto: crypto.webcrypto,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    Response,
    console,
    setTimeout,
    clearTimeout,
    location: { search: "" },
    __BUILD_ID__: "test",
    __SNAPSHOT_SHA__: sha(read("public/snapshot/manifest.json")),
  });
  const modules = new Map();
  async function module(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file);
    let m;
    if (file.endsWith(".json")) {
      const data = JSON.parse(read(file));
      m = new vm.SyntheticModule(
        ["default"],
        function () {
          this.setExport("default", data);
        },
        { context, identifier: file },
      );
    } else {
      const text = ts.transpileModule(read(file).toString(), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText;
      m = new vm.SourceTextModule(text, {
        context,
        identifier: file,
        importModuleDynamically: async (spec, ref) => {
          const dep = await resolve(spec, ref);
          if (dep.status === "unlinked") await dep.link(resolve);
          if (dep.status === "linked") await dep.evaluate();
          return dep;
        },
      });
    }
    modules.set(file, m);
    return m;
  }
  async function resolve(spec, ref) {
    const p = path.resolve(path.dirname(ref.identifier), spec);
    return module(path.extname(p) ? p : p + ".ts");
  }
  const m = await module("src/lib/gateb.ts");
  await m.link(resolve);
  await m.evaluate();
  const e = await module("src/lib/evidence.ts");
  return {
    e: e.namespace,
    l: m.namespace,
    load: async (p) => {
      const a = await module(p);
      if (a.status === "unlinked") await a.link(resolve);
      if (a.status === "linked") await a.evaluate();
      return a.namespace;
    },
  };
}
function sealed(overrides = {}) {
  return async (url) => {
    const p = new URL(url, "https://test.invalid").pathname;
    if (p in overrides) return overrides[p]();
    if (p === "/api/summary") return new Response("", { status: 404 });
    if (
      p.startsWith("/snapshot/") ||
      p.startsWith("/editions/") ||
      p.startsWith("/examples/")
    )
      return new Response(read("public" + p));
    throw Error("unexpected route " + p);
  };
}
await test("Valid sealed bytes load and receipts match displayed digest", async () => {
  const { e } = await instance(sealed());
  await e.fetchSummary();
  for (const id of ["protocol", "fixtures"]) {
    const s = await e.fetchSurface(id);
    assert.equal(s.state, "observed");
    assert.equal((await e.prove(id, s.meta.sha256)).equal, true);
  }
});
await test("Equal-length non-index alteration blocks before parsing", async () => {
  const row = root.surfaces.find((x) => x.id === "protocol");
  const b = Buffer.from(read("public/snapshot/raw/protocol"));
  b[b.indexOf("proposed")] = 120;
  const { e } = await instance(
    sealed({ "/snapshot/raw/protocol": () => new Response(b) }),
  );
  await e.fetchSummary();
  assert.equal((await e.fetchSurface("protocol")).state, "blocked");
});
await test("Path records use expected catalog digests and support receipts", async () => {
  const rel = JSON.parse(read("public/snapshot/catalog.json")).entries[0].path;
  const { e } = await instance(sealed());
  await e.fetchSummary();
  const s = await e.fetchSurfaceByPath(rel);
  assert.equal(s.state, "observed");
  assert.equal((await e.prove(`p/${rel}`, s.meta.sha256)).equal, true);
});
await test("Altered path bytes and catalog index both fail closed", async () => {
  const row = JSON.parse(read("public/snapshot/catalog.json")).entries[0];
  for (const target of [
    `/snapshot/p/${row.path.replaceAll("/", "__")}`,
    "/snapshot/catalog.json",
  ]) {
    const { e } = await instance(
      sealed({ [target]: () => json({ altered: true }) }),
    );
    await e.fetchSummary();
    assert.equal((await e.fetchSurfaceByPath(row.path)).state, "blocked");
  }
});
await test("Altered root manifest cannot establish a sealed source", async () => {
  const { e } = await instance(
    sealed({
      "/snapshot/manifest.json": () =>
        json({ ...root, sealedAt: "2099-01-01" }),
    }),
  );
  await assert.rejects(e.fetchSummary());
});
await test("Altered lane and schema manifests reject their root bindings", async () => {
  for (const rel of ["gateb/manifest.json", "schemas-index.json"]) {
    const { e, l } = await instance(
      sealed({ ["/snapshot/" + rel]: () => json({ files: [], rows: [] }) }),
    );
    await e.fetchSummary();
    await assert.rejects(
      rel.startsWith("gateb") ? l.fetchLane() : e.fetchSchemaIndex(),
    );
  }
});
await test("Measurement reader retains equal-length tamper rejection", async () => {
  const row = lane.files.find(
      (x) => x.path === "evidence/measurement/result_l.txt",
    ),
    b = read(`public/snapshot/gateb/raw/${row.id}`);
  b[0] ^= 1;
  const { e, l } = await instance(
    sealed({ [`/snapshot/gateb/raw/${row.id}`]: () => new Response(b) }),
  );
  await e.fetchSummary();
  await assert.rejects(l.fetchLaneText(row.path), /lane_digest_mismatch/);
});
await test("Live measurement and catalog readers observe new generations", async () => {
  let gen = 1;
  const p = "evidence/measurement/result_l.txt",
    id = p.replaceAll("/", "__");
  const { e, l } = await instance(async (url) => {
    const b = Buffer.from(`generation ${gen}`);
    if (url === "/api/gateb/manifest")
      return json({
        present: true,
        identity: { head: `g${gen}` },
        files: [{ id, path: p, bytes: b.length, sha256: sha(b) }],
      });
    if (url === "/api/gateb/raw/" + id) return new Response(b);
    if (url === "/api/catalog")
      return json({ entries: [{ path: `g${gen}`, bytes: 10 }] });
    throw Error(url);
  });
  assert.equal((await l.fetchLaneText(p)).text, "generation 1");
  assert.equal((await e.fetchCatalog())[0].path, "g1");
  gen = 2;
  assert.equal((await l.fetchLaneText(p)).text, "generation 2");
  assert.equal((await e.fetchCatalog())[0].path, "g2");
});
await test("Receipt retains the exact displayed generation after live change", async () => {
  let gen = 1;
  const p = "evidence/measurement/result_l.txt",
    id = p.replaceAll("/", "__");
  const { e, l } = await instance(async (url) => {
    const b = Buffer.from(`generation ${gen}`);
    if (url === "/api/gateb/manifest")
      return json({
        present: true,
        files: [{ id, path: p, bytes: b.length, sha256: sha(b) }],
      });
    if (url === "/api/gateb/raw/" + id) return new Response(b);
    throw Error(url);
  });
  const s = await l.fetchLaneText(p);
  gen = 2;
  const receipt = await e.prove(`gateb/${id}`, s.file.sha256);
  assert.equal(receipt.equal, true);
  assert.equal(receipt.clientSha256, sha(Buffer.from("generation 1")));
});
await test("A receipt cannot certify newer unseen bytes for an old displayed digest", async () => {
  const p = "evidence/measurement/result_l.txt",
    id = p.replaceAll("/", "__"),
    b = Buffer.from("new generation");
  const { e } = await instance(async (url) => {
    if (url === "/api/gateb/manifest")
      return json({
        present: true,
        files: [{ id, path: p, bytes: b.length, sha256: sha(b) }],
      });
    if (url === "/api/gateb/raw/" + id) return new Response(b);
    throw Error(url);
  });
  const r = await e.prove(`gateb/${id}`, sha(Buffer.from("old generation")));
  assert.equal(r.equal, false);
  await assert.rejects(
    e.prove(`gateb/${id}`, undefined),
    /displayed_digest_required/,
  );
});
await test("Current edition matches all 52 continuation bindings and the source receipt", async () => {
  const x = await instance(sealed()),
    ed = await x.load("src/lib/edition.ts");
  const m = await ed.editionManifest();
  assert.equal(m.files.filter((f) => f.continuation_bound).length, 52);
  const c = await ed.editionJson("docs/CONTINUATION.json");
  for (const f of c.data.evidence) {
    assert.equal(
      m.files.find((r) => r.path === f.path).sha256,
      "sha256:" + f.sha256,
    );
  }
  assert.equal(
    (await x.e.prove("edition/docs/CONTINUATION.json", c.file.sha256)).equal,
    true,
  );
});
await test("Altered edition manifest and record are rejected", async () => {
  const m = JSON.parse(read(`public/editions/${binding.commit}/manifest.json`)),
    f = m.files.find((x) => x.path === "docs/CONTINUATION.json");
  for (const target of [
    `/editions/${binding.commit}/manifest.json`,
    `/editions/${binding.commit}/raw/${f.sha256.slice(7)}`,
  ]) {
    const x = await instance(
        sealed({ [target]: () => json({ altered: true }) }),
      ),
      ed = await x.load("src/lib/edition.ts");
    await assert.rejects(ed.editionJson(f.path), /digest_mismatch/);
  }
});
await test("Synthetic packets preserve sufficiency versus counterexample-only scope", async () => {
  const x = await instance(sealed()),
    ex = await x.load("src/lib/example.ts");
  const a = (await ex.exampleJson("confirmed.json")).data.payload.result,
    b = (await ex.exampleJson("insufficient.json")).data.payload.result;
  assert.equal(a.sufficiency, "sufficient");
  assert.equal(a.bounds.lower.numerator, "2");
  assert.equal(b.sufficiency, "insufficient");
  assert.equal(b.bounds, null);
  assert.equal(b.enclosure_kind, "counterexample_only");
  assert.equal(b.counterexample_value.numerator, "1");
});
await test("Live-to-sealed fallback discards live manifest and catalog caches", async () => {
  let live = true;
  const p = "evidence/measurement/result_l.txt",
    id = p.replaceAll("/", "__"),
    b = Buffer.from("local-only generation");
  const fallback = sealed();
  const x = await instance(async (url) => {
    if (live) {
      if (url === "/api/gateb/manifest")
        return json({
          present: true,
          identity: { head: "local" },
          files: [{ id, path: p, bytes: b.length, sha256: sha(b) }],
        });
      if (url === "/api/gateb/raw/" + id) return new Response(b);
      if (url === "/api/catalog")
        return json({ entries: [{ path: "local-only", bytes: 1 }] });
    }
    return fallback(url);
  });
  assert.equal((await x.l.fetchLaneText(p)).text, b.toString());
  await x.e.fetchCatalog();
  live = false;
  await x.e.fetchSummary();
  assert.equal((await x.l.fetchLane()).identity.head, lane.identity.head);
  assert.equal(
    (await x.l.fetchLaneText(p)).text,
    read(`public/snapshot/gateb/raw/${id}`).toString(),
  );
  assert.notEqual((await x.e.fetchCatalog())[0].path, "local-only");
});
console.log(
  JSON.stringify(
    {
      kind: "console_reader_regression",
      browser_testing: false,
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      results,
    },
    null,
    2,
  ),
);
