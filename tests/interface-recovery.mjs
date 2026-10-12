/* Actual recovery, input-intent and worker code under controlled transports.
   These tests do not claim a real-browser layout or accessibility pass. */
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
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
function moduleAt(file, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    Error,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    __BUILD_ID__: "aaaaaaaaaa",
    ...globals,
  });
  return exports;
}
function recovery({
  body = { build: "bbbbbbbbbb" },
  type = "application/json",
  status = 200,
  offline = false,
  href = "https://test.invalid/?st=findings&at=batching&view=batch2",
  saved = new Map(),
  storageBroken = false,
} = {}) {
  const navigations = [],
    requests = [];
  const api = moduleAt("src/lib/deploymentRecovery.ts", {
    location: { href, replace: (url) => navigations.push(url) },
    sessionStorage: {
      getItem: (k) => {
        if (storageBroken) throw Error("disabled");
        return saved.get(k);
      },
      setItem: (k, v) => saved.set(k, v),
    },
    fetch: async (url, opts) => {
      requests.push({ url, opts });
      if (offline) throw Error("offline");
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": type },
      });
    },
  });
  return { api, navigations, requests, saved };
}
await test("Changed build recovers the requested station without obsolete reading state", async () => {
  const x = recovery();
  assert.equal(await x.api.recoverFromDeployment("encounter"), true);
  assert.deepEqual(x.navigations, ["https://test.invalid/?st=encounter"]);
  assert.equal(x.requests[0].opts.cache, "no-store");
});
await test("Receipt recovery preserves the exact reading URL", async () => {
  const x = recovery();
  await x.api.recoverFromDeployment();
  assert.equal(
    x.navigations[0],
    "https://test.invalid/?st=findings&at=batching&view=batch2",
  );
});
await test("The same build, offline state and invalid markers do not trigger reloads", async () => {
  for (const opts of [
    { body: { build: "aaaaaaaaaa" } },
    { offline: true },
    { type: "text/html" },
    { status: 404 },
    { body: { build: "not-a-build" } },
  ]) {
    const x = recovery(opts);
    assert.equal(await x.api.recoverFromDeployment(), false);
    assert.equal(x.navigations.length, 0);
  }
});
await test("A canceled navigation cannot reload a superseded destination", async () => {
  const x = recovery();
  assert.equal(
    await x.api.recoverFromDeployment("encounter", () => false),
    false,
  );
  assert.equal(x.navigations.length, 0);
});
await test("The durable guard stops repeated reloads across instances", async () => {
  const saved = new Map();
  const first = recovery({ saved });
  assert.equal(await first.api.recoverFromDeployment(), true);
  const retry = recovery({ saved });
  assert.equal(await retry.api.recoverFromDeployment(), false);
  assert.equal(retry.navigations.length, 0);
});
await test("Unavailable session storage disables automatic recovery", async () => {
  const x = recovery({ storageBroken: true });
  assert.equal(await x.api.recoverFromDeployment(), false);
  assert.equal(x.navigations.length, 0);
});
await test("Concurrent module failures share one probe and one navigation", async () => {
  const x = recovery();
  await Promise.all([
    x.api.recoverFromDeployment(),
    x.api.recoverFromDeployment(),
  ]);
  assert.equal(x.requests.length, 1);
  assert.equal(x.navigations.length, 1);
});
await test("Module errors remain distinct from integrity and arithmetic errors", async () => {
  const { api } = recovery();
  for (const text of [
    "Failed to fetch dynamically imported module: /assets/old.js",
    "Importing a module script failed.",
    "error loading dynamically imported module",
    "Unable to preload CSS for /assets/old.css",
  ])
    assert.equal(api.isModuleLoadError(new Error(text)), true);
  for (const text of [
    "sha256 mismatch",
    "Invalid Merkle leaf",
    "Cannot read properties of undefined",
  ])
    assert.equal(api.isModuleLoadError(new Error(text)), false);
});
await test("Pointer autofocus and keyboard navigation retain distinct focus intent", async () => {
  const listeners = new Map();
  const doc = {
    documentElement: { dataset: {} },
    addEventListener: (k, fn) => listeners.set(k, fn),
    removeEventListener: (k) => listeners.delete(k),
  };
  const { installInputModality } = moduleAt("src/lib/inputModality.ts");
  const cleanup = installInputModality(doc);
  assert.equal(doc.documentElement.dataset.inputModality, "keyboard");
  listeners.get("pointerdown")({});
  assert.equal(doc.documentElement.dataset.inputModality, "pointer");
  listeners.get("click")({ detail: 0, isTrusted: false });
  assert.equal(doc.documentElement.dataset.inputModality, "pointer");
  listeners.get("keydown")({ key: "Shift" });
  assert.equal(doc.documentElement.dataset.inputModality, "pointer");
  listeners.get("keydown")({ key: "Tab" });
  assert.equal(doc.documentElement.dataset.inputModality, "keyboard");
  listeners.get("pointerdown")({});
  listeners.get("click")({ detail: 0, isTrusted: true });
  assert.equal(doc.documentElement.dataset.inputModality, "keyboard");
  cleanup();
  assert.equal(listeners.size, 0);
  assert.equal(doc.documentElement.dataset.inputModality, undefined);
});
function worker({
  cached,
  network,
  status = 200,
  type = "application/javascript",
  storageBroken = false,
} = {}) {
  const listeners = new Map(),
    saved = new Map();
  if (cached) saved.set("https://test.invalid/assets/test.js", cached);
  let requests = 0,
    deletes = 0;
  const cache = {
    match: async (req) => saved.get(req.url),
    delete: async (req) => {
      deletes++;
      saved.delete(req.url);
    },
    put: async (req, res) => saved.set(req.url, res),
  };
  const globals = {
    self: { addEventListener: (key, fn) => listeners.set(key, fn) },
    location: { origin: "https://test.invalid" },
    URL,
    Response,
    caches: {
      open: async () => {
        if (storageBroken) throw Error("storage disabled");
        return cache;
      },
    },
    fetch: async () => {
      requests++;
      return new Response(network ?? "export default 1", {
        status,
        headers: { "Content-Type": type },
      });
    },
  };
  vm.runInNewContext(fs.readFileSync("public/sw.js", "utf8"), globals);
  return {
    saved,
    counts: () => ({ requests, deletes }),
    get: async (path = "/assets/test.js") => {
      let response;
      listeners.get("fetch")({
        request: new Request("https://test.invalid" + path),
        respondWith: (p) => (response = p),
      });
      return await response;
    },
  };
}
await test("An HTML response at a JavaScript URL is not cached", async () => {
  const x = worker({ network: "<!doctype html>", type: "text/html" });
  await x.get();
  assert.equal(x.saved.size, 0);
});
await test("A missing code response is not cached", async () => {
  const x = worker({ status: 404, type: "text/plain" });
  assert.equal((await x.get()).status, 404);
  assert.equal(x.saved.size, 0);
});
await test("A poisoned old asset entry is discarded and replaced with JavaScript", async () => {
  const x = worker({
    cached: new Response("<html/>", {
      headers: { "Content-Type": "text/html" },
    }),
  });
  assert.equal(
    (await x.get()).headers.get("Content-Type"),
    "application/javascript",
  );
  assert.deepEqual(x.counts(), { requests: 1, deletes: 1 });
  assert.equal(x.saved.size, 1);
});
await test("A valid cached module remains available without a network request", async () => {
  const x = worker({
    cached: new Response("export default 2", {
      headers: { "Content-Type": "application/javascript" },
    }),
  });
  assert.equal(await (await x.get()).text(), "export default 2");
  assert.equal(x.counts().requests, 0);
});
await test("Cache storage failure does not prevent loading a valid module", async () => {
  const x = worker({ storageBroken: true });
  assert.equal((await x.get()).status, 200);
  assert.equal(x.counts().requests, 1);
});
await test("Release probes use the network rather than a cached marker", async () => {
  const x = worker({
    network: '{"build":"bbbbbbbbbb"}',
    type: "application/json",
  });
  assert.equal(
    await (await x.get("/build.json")).text(),
    '{"build":"bbbbbbbbbb"}',
  );
  assert.equal(x.counts().requests, 1);
  assert.equal(x.saved.size, 0);
});
console.log(
  JSON.stringify(
    {
      kind: "controlled_runtime_regressions",
      browser_test: false,
      passed: results.filter((x) => x.passed).length,
      total: results.length,
      results,
    },
    null,
    2,
  ),
);
