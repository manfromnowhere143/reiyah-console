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
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
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
const near = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

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
  const counts = { width: 0, height: 0 }, calls = [], state = { globalCompositeOperation: "source-over" }, stack = [];
  const context = new Proxy(state, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => {
        calls.push({ name, args, state: { ...state } });
        if (name === "save") stack.push({ ...state });
        if (name === "restore") { for (const key of Object.keys(state)) delete state[key]; Object.assign(state, stack.pop()); }
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
  // One assembled presentation per frame; trails are painted inside the
  // material scene, after its background and before record identities.
  assert.equal(canvases[0].calls.filter(c => c.name === "drawImage").length, 3);
  assert.equal(canvases[2].calls.filter(c => c.name === "drawImage" && c.args[0] === canvases[1]).length, 3);
  assert.ok(canvases[1].calls.some(c => c.name === "clearRect"));
});

test("Harbor road projection shares a vanishing point and reciprocal depth scale", () => {
  const { harborRoadPoint } = moduleAt("src/lib/roadScene.ts", { Path2D: RecordedPath });
  for (const [w, h] of [[320, 568], [390, 844], [1440, 900], [1920, 1080]]) {
    const horizon = h * 0.38;
    let previousY = Infinity;
    for (const z of [1, 2, 4, 8, 16, 1000]) {
      const left = harborRoadPoint(w, h, horizon, z, -1), right = harborRoadPoint(w, h, horizon, z, 1);
      near(left.x + right.x, w);
      near(left.y, right.y);
      // Subtracting screen origins then rescaling distant points loses a few
      // double-precision ULPs; 1e-9 CSS px remains far below raster precision.
      near((left.y - horizon) * z, h - horizon, 1e-9);
      near((right.x - w / 2) * z, w * 0.64, 1e-9);
      assert.ok(left.y <= previousY);
      previousY = left.y;
    }
  }
});

test("Harbor detail emits finite geometry on both grounds and remains an explicit opt-in", () => {
  const { drawWorld } = moduleAt("src/lib/roadScene.ts", { Path2D: RecordedPath });
  for (const [w, h] of [[320, 420], [390, 844], [1440, 720]]) {
    for (const dark of [true, false]) {
      for (const phase of [0, 0.5, 0.999]) {
        const canvas = recordedCanvas();
        drawWorld(canvas.getContext(), { w, h, horizon: h * 0.38, dark, phase, travel: 10 + phase, detail: "harbor" });
        for (const call of canvas.calls) {
          for (const arg of call.args) if (typeof arg === "number") assert.ok(Number.isFinite(arg), `${call.name}: ${arg}`);
        }
        assert.equal(canvas.calls.filter(c => c.name === "save").length, canvas.calls.filter(c => c.name === "restore").length);
        assert.ok(canvas.calls.some(c => c.name === "fillRect" && c.args[1] === 0 && c.args[3] === h * 0.38 + 1));
      }
    }
  }
  const legacy = recordedCanvas();
  drawWorld(legacy.getContext(), { w: 390, h: 660, horizon: 250, dark: true });
  assert.ok(!legacy.calls.some(c => c.name === "scale"));
});

test("Pause preserves the trail layer without opaque fade or fresh streaks", () => {
  const { engine, canvases } = recordedEngine();
  const env = { w: 390, h: 660, dpr: 2, dark: true, reduced: false };
  engine.frame(5000, env); engine.frame(5016, env);
  const trail = canvases[1], before = trail.calls.length;
  engine.frame(5032, { ...env, reduced: true });
  const pausedCalls = trail.calls.slice(before);
  assert.ok(!pausedCalls.some(c => ["fillRect", "clearRect", "stroke"].includes(c.name)));
  const decays = trail.calls.filter(c => c.name === "fillRect");
  assert.ok(decays.length > 0);
  assert.ok(decays.every(c => c.state.globalCompositeOperation === "destination-out"));
  const main = canvases[2].calls;
  const firstTrail = main.findIndex(c => c.name === "drawImage" && c.args[0] === trail);
  assert.ok(firstTrail > main.findIndex(c => c.name === "fillRect"));
  assert.ok(firstTrail < main.findIndex(c => c.name === "fillText"));
});

test("A new illustration does not announce a rejection before one has occurred", () => {
  const { engine, canvases } = recordedEngine();
  engine.frame(0, { w: 390, h: 660, dpr: 2, dark: true, reduced: true });
  assert.ok(!canvases[2].calls.some(c => c.name === "fillText" && String(c.args[0]).includes("expected rejection")));
});

function recordedEncounter(reduced, width = 391, height = 667) {
  const canvas = recordedCanvas(), queue = new Map(), effects = [], resize = [];
  Object.assign(canvas, { clientWidth: width, clientHeight: height });
  let stateIndex = 0, refIndex = 0, serial = 0, now = 1000;
  const react = {
    useState(initial) { const i = stateIndex++; return [i === 3 ? "ready" : initial, () => {}]; },
    useRef(initial) { return { current: refIndex++ === 0 ? canvas : initial }; },
    useEffect(effect) { effects.push(effect); },
  };
  const jsx = (type, props) => ({ type, props });
  const road = moduleAt("src/lib/roadScene.ts", { Path2D: RecordedPath });
  const document = { hidden: false, documentElement: { dataset: { ground: "dark" } }, addEventListener() {}, removeEventListener() {} };
  const { Encounter } = moduleAt("src/stations/Encounter.tsx", {
    require: name => name === "react" ? react : name === "react/jsx-runtime" ? { jsx, jsxs: jsx, Fragment: "fragment" } : name === "../lib/roadScene" ? road : name.endsWith("StationFrame") ? { useStationReadiness() {} } : {},
    Path2D: RecordedPath, document,
    window: { devicePixelRatio: 1.25, addEventListener() {}, removeEventListener() {} },
    performance: { now: () => now },
    requestAnimationFrame: fn => { queue.set(++serial, fn); return serial; },
    cancelAnimationFrame: id => queue.delete(id),
    matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }),
    ResizeObserver: class { constructor(fn) { resize.push(fn); } observe() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
  });
  const tree = Encounter();
  const descendants = (node) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(descendants)];
  const nodes = descendants(tree);
  // Run only the real scene effect. Network-read effects remain outside this
  // controlled rendering test; their actual-byte checks have a separate suite.
  const cleanup = effects[3]();
  const tick = () => { now += 16; const [id, fn] = queue.entries().next().value; queue.delete(id); fn(); };
  return { canvas, nodes, tick, cleanup, redrawLater() { now += 30000; resize[0](); tick(); } };
}

test("Encounter pause fixes the entire scene clock and avoids fractional-DPR resets", () => {
  for (const reduced of [false, true]) {
    const x = recordedEncounter(reduced);
    const stage = x.nodes.find(n => n.type === "button" && n.props["aria-label"]?.startsWith("BELIEF ·"));
    assert.ok(stage);
    stage.props.onClick(); x.tick();
    const geometry = calls => calls.filter(c => ["fillText", "moveTo", "lineTo", "arc", "translate", "scale", "fillRect", "rect"].includes(c.name)).map(c => [c.name, c.args]);
    let start = x.canvas.calls.length;
    x.redrawLater();
    const first = geometry(x.canvas.calls.slice(start));
    start = x.canvas.calls.length;
    x.redrawLater();
    assert.deepEqual(geometry(x.canvas.calls.slice(start)), first);
    assert.deepEqual(x.canvas.counts, { width: 1, height: 1 });
    assert.equal(x.canvas.width, 489); assert.equal(x.canvas.height, 834);
    x.cleanup();
  }
});

test("Encounter stage controls remain separate from its accessible clock slider", () => {
  const x = recordedEncounter(true);
  const slider = x.nodes.find(n => n.props?.role === "slider");
  assert.ok(slider);
  assert.ok(![slider.props.children].flat(Infinity).some(n => n?.type === "button"));
  const journey = x.nodes.find(n => n.type === "nav" && n.props["aria-label"] === "Encounter stages");
  assert.equal(journey.props.children.length, 7);
  const joint = journey.props.children.find(n => n.props["data-jsm"] === "true");
  joint.props.onClick(); x.tick();
  // The synthetic joint-miss illustration never silently becomes measurement.
  assert.ok(x.canvas.calls.some(c => c.name === "fillText" && String(c.args[0]).includes("not measured in this fixture")));
  x.cleanup();
});

test("Every paused Encounter boundary displays its selected record instead of a partial previous transition", () => {
  const titles = [/^OBSERVATION ·/, /^BELIEF ·/, /^DECISION ·/, /^INTERVENTION ·/, /^OUTCOME WINDOW ·/, /^JOINT BLIND$/, /^EVIDENCE ·/];
  for (const reduced of [false, true]) for (const [width, height] of [[375, 410], [420, 227]]) {
    const x = recordedEncounter(reduced, width, height);
    const journey = x.nodes.find(n => n.type === "nav" && n.props["aria-label"] === "Encounter stages");
    journey.props.children.forEach((stage, i) => {
      const start = x.canvas.calls.length;
      stage.props.onClick(); x.tick();
      const labels = x.canvas.calls.slice(start).filter(c => c.name === "fillText");
      const headings = labels.filter(c => titles.some(p => p.test(String(c.args[0]))));
      assert.equal(headings.length, 1, `stage ${i + 1} must have one current disclosure`);
      assert.match(headings[0].args[0], titles[i]);
      near(headings[0].state.globalAlpha ?? 1, 1);
      for (const c of labels) assert.ok(c.args[2] >= 0 && c.args[2] <= height, `text ${c.args[0]} leaves the scene vertically`);
      if (i === 3) for (const field of ["assigned ", "delivered ", "received ", "adherence ", "physical control "]) {
        assert.ok(labels.some(c => String(c.args[0]).startsWith(field)), `intervention retains ${field}`);
      }
    });
    x.cleanup();
  }
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
