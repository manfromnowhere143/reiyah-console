/* Actual renderer and worker code with recorded graphics/RAF calls. The alpha
   oracle implements the WebGL upload contract and source-over independently.
   This does not execute GPU shaders or establish a browser visual pass. */
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

const results = [];
function test(name, run) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); process.exitCode = 1; }
}
function moduleAt(file, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, console, ...globals });
  return exports;
}

function recordedGL() {
  const shaders = [], uploads = [], uniforms = new Map(), storage = new Map();
  const methods = {
    createShader(type) { const shader = { type }; shaders.push(shader); return shader; },
    shaderSource(shader, source) { shader.source = source; },
    getShaderParameter() { return true; },
    createProgram() { return {}; },
    getProgramParameter() { return true; },
    createVertexArray() { return {}; },
    createTexture() { return {}; },
    createFramebuffer() { return {}; },
    getUniformLocation(_p, name) { return name; },
    uniform3fv(name, values) { uniforms.set(name, [...values]); },
    pixelStorei(name, value) { storage.set(name, value); },
    texImage2D(...args) {
      if (args.length === 6) uploads.push({ source: args[5], premultiplied: storage.get("UNPACK_PREMULTIPLY_ALPHA_WEBGL") });
    },
  };
  const gl = new Proxy(methods, {
    get(target, key) { return target[key] ?? (/^[A-Z0-9_]+$/.test(key) ? key : () => {}); },
  });
  const { createHarborGL } = moduleAt("src/stations/harborGL.ts");
  const renderer = createHarborGL(gl);
  assert.ok(renderer);
  return { renderer, shaders, uploads, uniforms };
}
const options = { dark: true, bloom: 0.32, dispersion: 0.00035, vignette: 0.42, grain: 0.022, time: 0 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test("Translucent headlight pixels obey source-over in dark and paper themes", () => {
  const x = recordedGL();
  // Confirm which representation the real base shader consumes; the independent
  // oracle below uses the upload flag recorded from the real render method.
  const base = x.shaders.find(s => s.source?.includes("uniform sampler2D uScene"));
  assert.match(base.source, /s\.rgb\s*\+\s*uGround\s*\*\s*\(1\.0\s*-\s*s\.a\)/);
  for (const dark of [true, false]) {
    for (const alpha of [0, 0.01, 0.04, 0.17, 0.5, 1]) {
      const source = { rgba: [1, 1, 1, alpha] };
      x.renderer.render(source, 390, 660, { ...options, dark });
      const upload = x.uploads.at(-1), ground = x.uniforms.get("uGround");
      // Uploading Canvas with false yields straight RGB; true yields RGB * A.
      const rgb = upload.premultiplied ? alpha : (alpha === 0 ? 0 : 1);
      for (let c = 0; c < 3; c++) {
        const actual = rgb + ground[c] * (1 - alpha);
        const expected = alpha + ground[c] * (1 - alpha);
        near(actual, expected);
        assert.ok(actual <= 1);
      }
    }
  }
  x.renderer.dispose();
});

test("A stopped transparent scene matches the same scene over an opaque trail", () => {
  const x = recordedGL(), g = 5 / 255, a = 0.04;
  const opaqueMoving = a + g * (1 - a);
  x.renderer.render({ rgba: [opaqueMoving, opaqueMoving, opaqueMoving, 1] }, 390, 660, options);
  x.renderer.render({ rgba: [1, 1, 1, a] }, 390, 660, options);
  const still = (x.uploads.at(-1).premultiplied ? a : 1) + g * (1 - a);
  near(still, opaqueMoving);
  // This counterfactual must remain distinguishable: old false upload creates
  // >1.0 white before the bright pass. The fix is not simply reducing bloom.
  assert.ok(1 + g * (1 - a) > 1);
  assert.ok(still < 0.06);
});

test("The vignette uses a defined increasing GLSL ramp and bounded falloff", () => {
  const x = recordedGL();
  const source = x.shaders.find(s => s.source?.includes("uniform float uVig")).source;
  const match = source.match(/float vig = 1\.0 - smoothstep\(([\d.]+), ([\d.]+), d2\)/);
  assert.ok(match);
  const lower = Number(match[1]), upper = Number(match[2]);
  assert.ok(lower < upper);
  let previous = 1;
  for (let d2 = 0; d2 <= 0.5; d2 += 0.01) {
    const t = Math.max(0, Math.min(1, (d2 - lower) / (upper - lower)));
    const v = 1 - t * t * (3 - 2 * t);
    assert.ok(v >= 0 && v <= previous);
    previous = v;
  }
});

class RecordedPath {}
for (const key of ["moveTo", "lineTo", "closePath", "quadraticCurveTo"]) RecordedPath.prototype[key] = () => {};
function recordedCanvas(w = 2, h = 2) {
  let width = w, height = h;
  const counts = { width: 0, height: 0 }, calls = [];
  const context = new Proxy({}, {
    get(_target, name) {
      return (...args) => {
        calls.push({ name, args });
        if (name === "createLinearGradient" || name === "createRadialGradient") return { addColorStop() {} };
        if (name === "measureText") return { width: 100 };
      };
    },
  });
  return {
    counts, calls,
    get width() { return width; },
    set width(n) { width = Math.trunc(n); counts.width++; },
    get height() { return height; },
    set height(n) { height = Math.trunc(n); counts.height++; },
    getContext() { return context; },
  };
}
function recordedEngine() {
  const road = moduleAt("src/lib/roadScene.ts", { Path2D: RecordedPath });
  const { createHarborEngine } = moduleAt("src/stations/harborEngine.ts", {
    require: () => road, Path2D: RecordedPath,
  });
  const output = recordedCanvas(), canvases = [output];
  const artifacts = [{ artifact: { path: "fixture.json", sha256: "a".repeat(64) }, byte_size: 1024, role: "fixture" }];
  const engine = createHarborEngine(output, artifacts, 0, (w, h) => {
    const canvas = recordedCanvas(w, h); canvases.push(canvas); return canvas;
  });
  return { engine, canvases };
}

test("Fractional DPR allocates one integer grid without resetting every frame", () => {
  for (const dpr of [1, 1.25, 1.5, 2]) {
    const { engine, canvases } = recordedEngine();
    const env = { w: 391, h: 667, dpr, dark: true, reduced: false };
    engine.frame(5000, env);
    for (let i = 1; i <= 10; i++) engine.frame(5000 + i * 16, env);
    for (const canvas of canvases) {
      assert.equal(canvas.width, Math.round(env.w * dpr));
      assert.equal(canvas.height, Math.round(env.h * dpr));
      assert.deepEqual(canvas.counts, { width: 1, height: 1 });
    }
    const transform = canvases[1].calls.find(c => c.name === "setTransform").args;
    near(transform[0] * env.w, canvases[1].width);
    near(transform[3] * env.h, canvases[1].height);
  }
});

test("The 2D engine redraws a paused scene after theme and viewport changes", () => {
  const { engine, canvases } = recordedEngine();
  let env = { w: 391, h: 667, dpr: 1.25, dark: true, reduced: false, dash: 80 };
  engine.frame(5000, env);
  env = { ...env, reduced: true };
  engine.frame(5016, env);
  const before = canvases[0].calls.length;
  engine.frame(10000, { ...env, dark: false, w: 667, h: 391 });
  assert.ok(canvases[0].calls.length > before);
  for (const canvas of canvases) {
    assert.equal(canvas.width, Math.round(667 * 1.25));
    assert.equal(canvas.height, Math.round(391 * 1.25));
    assert.deepEqual(canvas.counts, { width: 2, height: 2 });
  }
  assert.equal(canvases[0].calls.filter(c => c.name === "drawImage").length, 6);
  assert.ok(canvases[1].calls.some(c => c.name === "clearRect"));
});

test("Both worker modes stop after pause and redraw once on a paused environment change", () => {
  for (const glMode of [true, false]) {
    const frames = [], composites = [], queue = new Map(), messages = [];
    let next = 0, disposed = false;
    const self = { postMessage: m => messages.push(m) };
    const engine = { frame: (t, env) => frames.push({ t, ...env }), setRuleMap() {}, setMouse() {}, setPulse() {} };
    const glPost = { render: (...args) => composites.push(args), dispose() { disposed = true; } };
    class Offscreen {
      constructor(w, h) { this.width = w; this.height = h; }
      getContext(kind) { return kind === "webgl2" && glMode ? {} : null; }
      addEventListener() {}
    }
    moduleAt("src/stations/harbor.worker.ts", {
      self, OffscreenCanvas: Offscreen,
      requestAnimationFrame: fn => { queue.set(++next, fn); return next; },
      cancelAnimationFrame: id => queue.delete(id),
      require: name => name === "./harborEngine" ? { createHarborEngine: () => engine } : { createHarborGL: () => glPost },
    });
    const send = data => self.onmessage({ data });
    const tick = at => { const [id, fn] = queue.entries().next().value; queue.delete(id); fn(at); };
    let env = { w: 391, h: 667, dpr: 1.25, dark: true, reduced: false };
    send({ type: "init", canvas: new Offscreen(2, 2), artifacts: [], badTotal: 0, env });
    tick(1000);
    assert.equal(messages[0].mode, glMode ? "gl" : "2d");
    assert.equal(queue.size, 1);
    env = { ...env, reduced: true };
    send({ type: "env", env }); tick(1016);
    assert.equal(queue.size, 0);
    for (const update of [{ dark: false }, { w: 667, h: 391 }]) {
      env = { ...env, ...update };
      send({ type: "env", env }); assert.equal(queue.size, 1); tick(2000);
      assert.equal(queue.size, 0);
      assert.equal(frames.at(-1).dark, env.dark);
      assert.equal(frames.at(-1).w, env.w);
      assert.equal(frames.at(-1).post, glMode ? "none" : "canvas");
    }
    assert.equal(frames.length, 4);
    assert.equal(composites.length, glMode ? 4 : 0);
    if (glMode) assert.deepEqual(composites.at(-1).slice(1, 3), [834, 489]);
    send({ type: "stop" });
    assert.equal(queue.size, 0);
    assert.equal(disposed, glMode);
  }
});

console.log(JSON.stringify({
  kind: "controlled_graphics_contract_regressions",
  browser_test: false, gpu_shader_execution: false,
  passed: results.filter(r => r.passed).length, total: results.length, results,
}, null, 2));
