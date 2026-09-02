/* Harbor GPU post-processing — a real deferred pipeline in WebGL2.

   The 2D engine renders the scene (premultiplied alpha) into an OffscreenCanvas;
   this uploads it as a texture and runs true material passes on the GPU:
     1. base     — composite the scene over the theme ground (premultiplied
                    over-operator), producing an opaque HDR-ish base.
     2. bright    — threshold bright-pass at half resolution.
     3. blur      — separable Gaussian, ping-ponged (H, V) x2 for a wide bloom.
     4. composite — radial chromatic dispersion of the base, additive bloom with
                    a soft highlight tone-map, radial vignette, and in-shader
                    procedural film grain. Output to the screen.

   Everything degrades: if a program fails to build the stage is skipped, down
   to a passthrough that simply composites the scene over the ground. Returns
   null only when WebGL2 itself is unusable, so the worker can fall back to the
   2D path before it commits the visible canvas. */

type GL = WebGL2RenderingContext;

export interface HarborGLOpts {
  dark: boolean;
  bloom: number;       // bloom intensity
  dispersion: number;  // chromatic aberration amount (uv units at the edge)
  vignette: number;    // 0..1
  grain: number;       // 0..~0.08
  time: number;        // seconds, for grain animation
}

export interface HarborGL {
  render(scene: TexImageSource, wDev: number, hDev: number, opts: HarborGLOpts): void;
  dispose(): void;
}

const VERT = `#version 300 es
out vec2 vUv;
void main(){
  vec2 uv = vec2((gl_VertexID == 1) ? 2.0 : 0.0, (gl_VertexID == 2) ? 2.0 : 0.0);
  vUv = uv;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`;

/* scene (premultiplied) over the theme ground -> opaque base */
const FRAG_BASE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene;
uniform vec3 uGround;
void main(){
  vec4 s = texture(uScene, vUv);      // premultiplied rgb, straight a
  vec3 base = s.rgb + uGround * (1.0 - s.a);
  o = vec4(base, 1.0);
}`;

const FRAG_BRIGHT = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
uniform vec3 uGround;
uniform float uThreshold;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float g = dot(uGround, vec3(0.2126, 0.7152, 0.0722));
  // bloom what is brighter than the ground by more than the threshold
  float k = smoothstep(g + uThreshold, g + uThreshold + 0.22, l);
  o = vec4(c * k, 1.0);
}`;

const FRAG_BLUR = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
uniform vec2 uDir;   // texel step * direction
void main(){
  vec3 s = texture(uTex, vUv).rgb * 0.227027;
  vec2 d1 = uDir * 1.3846153846;
  vec2 d2 = uDir * 3.2307692308;
  s += texture(uTex, vUv + d1).rgb * 0.3162162162;
  s += texture(uTex, vUv - d1).rgb * 0.3162162162;
  s += texture(uTex, vUv + d2).rgb * 0.0702702703;
  s += texture(uTex, vUv - d2).rgb * 0.0702702703;
  o = vec4(s, 1.0);
}`;

const FRAG_COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uBase;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform float uTime;
uniform float uBloomI;
uniform float uDisp;
uniform float uVig;
uniform float uGrain;
float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  // radial chromatic dispersion of the base — a real lens fringe
  vec2 off = c * uDisp;
  float r = texture(uBase, uv + off).r;
  float g = texture(uBase, uv).g;
  float b = texture(uBase, uv - off).b;
  vec3 base = vec3(r, g, b);
  vec3 bloom = texture(uBloom, uv).rgb;
  vec3 col = base + bloom * uBloomI;
  // soft-clip only the highlights, keep the body linear
  vec3 over = max(vec3(0.0), col - 1.0);
  col = min(col, 1.0) + over / (1.0 + over);
  // radial vignette
  float d2 = dot(c, c);
  float vig = smoothstep(0.62, 0.12, d2);
  col *= mix(1.0, vig, uVig);
  // procedural film grain (in-shader, animated)
  float n = hash(uv * uRes + uTime * 60.0);
  col += (n - 0.5) * uGrain;
  o = vec4(col, 1.0);
}`;

function makeProgram(gl: GL, frag: string): WebGLProgram | null {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  gl.shaderSource(vs, VERT); gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) return null;
  gl.shaderSource(fs, frag); gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  return p;
}

interface FBO { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

export function createHarborGL(gl: GL): HarborGL | null {
  try {
    const progBase = makeProgram(gl, FRAG_BASE);
    const progBright = makeProgram(gl, FRAG_BRIGHT);
    const progBlur = makeProgram(gl, FRAG_BLUR);
    const progComp = makeProgram(gl, FRAG_COMPOSITE);
    if (!progBase) return null; // even the passthrough failed -> unusable
    const bloomOk = !!(progBright && progBlur);

    const vao = gl.createVertexArray();       // empty VAO for the fullscreen triangle
    const sceneTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const makeFBO = (w: number, h: number): FBO => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { fb, tex, w, h };
    };

    let base: FBO | null = null;
    let bloomA: FBO | null = null;
    let bloomB: FBO | null = null;
    let vpW = 0, vpH = 0;

    const ensureSize = (wDev: number, hDev: number) => {
      if (wDev === vpW && hDev === vpH) return;
      vpW = wDev; vpH = hDev;
      for (const f of [base, bloomA, bloomB]) if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
      const hw = Math.max(1, wDev >> 1), hh = Math.max(1, hDev >> 1);
      base = makeFBO(wDev, hDev);
      bloomA = makeFBO(hw, hh);
      bloomB = makeFBO(hw, hh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    const drawTri = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

    const render = (scene: TexImageSource, wDev: number, hDev: number, opts: HarborGLOpts) => {
      ensureSize(wDev, hDev);
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.activeTexture(gl.TEXTURE0);

      // upload the scene (canvas is premultiplied; keep it premultiplied)
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);

      const ground: [number, number, number] = opts.dark ? [10 / 255, 11 / 255, 14 / 255] : [236 / 255, 234 / 255, 226 / 255];

      // 1 — base: scene over ground -> base FBO (full res)
      gl.useProgram(progBase);
      gl.bindFramebuffer(gl.FRAMEBUFFER, base!.fb);
      gl.viewport(0, 0, base!.w, base!.h);
      gl.uniform1i(gl.getUniformLocation(progBase, "uScene"), 0);
      gl.uniform3fv(gl.getUniformLocation(progBase, "uGround"), ground);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      drawTri();

      // 2..3 — bloom (bright-pass + separable blur) at half res
      if (bloomOk && opts.bloom > 0) {
        gl.useProgram(progBright!);
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA!.fb);
        gl.viewport(0, 0, bloomA!.w, bloomA!.h);
        gl.uniform1i(gl.getUniformLocation(progBright!, "uTex"), 0);
        gl.uniform3fv(gl.getUniformLocation(progBright!, "uGround"), ground);
        gl.uniform1f(gl.getUniformLocation(progBright!, "uThreshold"), 0.16);
        gl.bindTexture(gl.TEXTURE_2D, base!.tex);
        drawTri();

        gl.useProgram(progBlur!);
        const uTex = gl.getUniformLocation(progBlur!, "uTex");
        const uDir = gl.getUniformLocation(progBlur!, "uDir");
        const tx = 1 / bloomA!.w, ty = 1 / bloomA!.h;
        const passes: Array<[FBO, FBO, number, number]> = [
          [bloomA!, bloomB!, tx, 0], [bloomB!, bloomA!, 0, ty],
          [bloomA!, bloomB!, tx * 2, 0], [bloomB!, bloomA!, 0, ty * 2],
        ];
        for (const [src, dst, dx, dy] of passes) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
          gl.viewport(0, 0, dst.w, dst.h);
          gl.uniform1i(uTex, 0);
          gl.uniform2f(uDir, dx, dy);
          gl.bindTexture(gl.TEXTURE_2D, src.tex);
          drawTri();
        }
      } else {
        // no bloom: clear bloomA to black so the composite adds nothing
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA!.fb);
        gl.viewport(0, 0, bloomA!.w, bloomA!.h);
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      }

      // 4 — composite to screen
      if (progComp) {
        gl.useProgram(progComp);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, wDev, hDev);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, base!.tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomA!.tex);
        gl.uniform1i(gl.getUniformLocation(progComp, "uBase"), 0);
        gl.uniform1i(gl.getUniformLocation(progComp, "uBloom"), 1);
        gl.uniform2f(gl.getUniformLocation(progComp, "uRes"), wDev, hDev);
        gl.uniform1f(gl.getUniformLocation(progComp, "uTime"), opts.time);
        gl.uniform1f(gl.getUniformLocation(progComp, "uBloomI"), opts.bloom);
        gl.uniform1f(gl.getUniformLocation(progComp, "uDisp"), opts.dispersion);
        gl.uniform1f(gl.getUniformLocation(progComp, "uVig"), opts.vignette);
        gl.uniform1f(gl.getUniformLocation(progComp, "uGrain"), opts.grain);
        drawTri();
        gl.activeTexture(gl.TEXTURE0);
      } else {
        // passthrough: blit the base to the screen
        gl.useProgram(progBase);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, wDev, hDev);
        gl.uniform1i(gl.getUniformLocation(progBase, "uScene"), 0);
        gl.uniform3fv(gl.getUniformLocation(progBase, "uGround"), ground);
        gl.bindTexture(gl.TEXTURE_2D, sceneTex);
        drawTri();
      }
    };

    const dispose = () => {
      for (const f of [base, bloomA, bloomB]) if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
      gl.deleteTexture(sceneTex);
      if (vao) gl.deleteVertexArray(vao);
      for (const p of [progBase, progBright, progBlur, progComp]) if (p) gl.deleteProgram(p);
    };

    return { render, dispose };
  } catch {
    return null;
  }
}
