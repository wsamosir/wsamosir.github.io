<script lang="ts">
  import { onMount } from 'svelte';
  import { drawGlyph } from '$lib/generativeFont';

  let canvas: HTMLCanvasElement;

  const TEXT = 'WILLSAMOSIR';
  const N = TEXT.length;
  const SUBSTEPS = 1;

  // ── Eye state ─────────────────────────────────────────────────────────────
  let eyeActive = $state(false);
  let eyeNX     = $state(0.5);
  let eyeNY     = $state(0.5);

  // ── Exposed uniforms (bound to sliders) ──────────────────────────────────
  let funcView     = $state(false);

  let saturation   = $state(1.0);

  let damping      = $state(0.9981);
  let srcAmp       = $state(1.0);
  let speedScale   = $state(1.55);
  let freqScale    = $state(0.1);
  let threshold    = $state(0.12);
  const outlineW = 1.0;

  // ── Shaders ───────────────────────────────────────────────────────────────

  const VERT = /* glsl */ `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const DISPLAY_FRAG = /* glsl */ `
    precision highp float;
    uniform sampler2D u_wave;
    uniform vec2  u_res;
    uniform float u_threshold;
    uniform float u_time;
    uniform int   u_funcView;
    uniform float u_saturation;
    varying vec2 v_uv;

    float wv(vec2 uv) {
      return texture2D(u_wave, clamp(uv, 0.001, 0.999)).r;
    }

    // ── Colormaps ─────────────────────────────────────────────────────────────

    vec3 viridis(float t) {
      return clamp(
        vec3(0.2777,0.0054,0.3341)
        +t*(vec3(0.1051,1.4046,1.3846)
        +t*(vec3(-0.3309,0.2148,0.0951)
        +t*(vec3(-4.6342,-5.7991,-19.3324)
        +t*(vec3(6.2283,14.1799,56.6906)
        +t*(vec3(4.7764,-13.7451,-65.3530)
        +t*vec3(-5.4355,4.6459,26.3124)))))),
        0.0, 1.0);
    }

    vec3 turbo(float t) {
      t = clamp(t, 0.0, 1.0);
      vec4 v4 = vec4(1.0, t, t*t, t*t*t);
      vec2 v2 = v4.zw * v4.z;
      return clamp(vec3(
        dot(v4, vec4(0.13572,4.61539,-42.66032,132.13108)) + dot(v2, vec2(-152.94239,59.28638)),
        dot(v4, vec4(0.09140,2.19419,  4.84297,-14.18655)) + dot(v2, vec2(   4.27730, 2.82957)),
        dot(v4, vec4(0.10667,12.64195,-60.58205,110.36277)) + dot(v2, vec2( -89.90311,27.34825))
      ), 0.0, 1.0);
    }

    vec3 blues(float t) {
      float u = t*t*(3.0 - 2.0*t);
      return mix(vec3(0.97,0.98,1.00), vec3(0.03,0.19,0.42), u);
    }

    vec3 reds(float t) {
      float u = t*t*(3.0 - 2.0*t);
      return mix(vec3(1.00,0.96,0.94), vec3(0.40,0.00,0.05), u);
    }

    vec3 coolwarm(float t) {
      return t < 0.5
        ? mix(vec3(0.23,0.30,0.75), vec3(0.87,0.87,0.87), t*2.0)
        : mix(vec3(0.87,0.87,0.87), vec3(0.71,0.11,0.11), t*2.0-1.0);
    }

    vec3 pinkgreen(float t) {
      return t < 0.5
        ? mix(vec3(0.76,0.10,0.36), vec3(0.97,0.97,0.97), t*2.0)
        : mix(vec3(0.97,0.97,0.97), vec3(0.13,0.53,0.21), t*2.0-1.0);
    }

    vec3 phase(float t) {
      float a = t * 6.28318;
      return clamp(vec3(
        0.5 + 0.5*sin(a + 0.000),
        0.5 + 0.5*sin(a + 2.094),
        0.5 + 0.5*sin(a + 4.189)
      ), 0.0, 1.0);
    }

    vec3 spectral(float t) {
      t = clamp(t, 0.0, 0.9999);
      float s = t * 9.0; float i = floor(s); float f = fract(s);
      vec3 a, b;
      if      (i < 1.0) { a=vec3(0.62,0.00,0.26); b=vec3(0.84,0.19,0.15); }
      else if (i < 2.0) { a=vec3(0.84,0.19,0.15); b=vec3(0.96,0.43,0.26); }
      else if (i < 3.0) { a=vec3(0.96,0.43,0.26); b=vec3(0.99,0.68,0.38); }
      else if (i < 4.0) { a=vec3(0.99,0.68,0.38); b=vec3(1.00,0.88,0.55); }
      else if (i < 5.0) { a=vec3(1.00,0.88,0.55); b=vec3(0.90,0.96,0.60); }
      else if (i < 6.0) { a=vec3(0.90,0.96,0.60); b=vec3(0.67,0.87,0.64); }
      else if (i < 7.0) { a=vec3(0.67,0.87,0.64); b=vec3(0.40,0.76,0.64); }
      else if (i < 8.0) { a=vec3(0.40,0.76,0.64); b=vec3(0.20,0.53,0.74); }
      else               { a=vec3(0.20,0.53,0.74); b=vec3(0.37,0.31,0.64); }
      return mix(a, b, f);
    }

    vec3 rainbow(float t) {
      float h = t * 6.0;
      return clamp(vec3(
        abs(h - 3.0) - 1.0,
        2.0 - abs(h - 2.0),
        2.0 - abs(h - 4.0)
      ), 0.0, 1.0);
    }

    vec3 jet(float t) {
      return clamp(vec3(
        1.5 - abs(4.0*t - 3.0),
        1.5 - abs(4.0*t - 2.0),
        1.5 - abs(4.0*t - 1.0)
      ), 0.0, 1.0);
    }

    vec3 palette(int idx, float t) {
      vec3 c = turbo(t);
      if      (idx == 0) c = viridis(t);
      else if (idx == 1) c = blues(t);
      else if (idx == 2) c = reds(t);
      else if (idx == 3) c = coolwarm(t);
      else if (idx == 4) c = pinkgreen(t);
      else if (idx == 5) c = phase(t);
      else if (idx == 6) c = spectral(t);
      else if (idx == 7) c = rainbow(t);
      else if (idx == 8) c = jet(t);
      return c;
    }

    // ── Size levels (all multiples of 8 → boundaries always globally align) ──

    float sizeAt(int i) {
      if (i == 0) return 128.0;
      if (i == 1) return 96.0;
      if (i == 2) return 64.0;
      if (i == 3) return 48.0;
      if (i == 4) return 32.0;
      if (i == 5) return 24.0;
      if (i == 6) return 16.0;
      if (i == 7) return 12.0;
      return 8.0;
    }

    // One level down in the hierarchy
    float nextSize(float s) {
      if (s > 96.0) return 96.0;
      if (s > 64.0) return 64.0;
      if (s > 48.0) return 48.0;
      if (s > 32.0) return 32.0;
      if (s > 24.0) return 24.0;
      if (s > 16.0) return 16.0;
      if (s > 12.0) return 12.0;
      return 8.0;
    }

    // ── Main ──────────────────────────────────────────────────────────────────

    void main() {
      if (u_funcView == 1) {
        float w = wv(v_uv) * 2.0 - 1.0; // -1..1
        float bright = w * 0.5 + 0.5;
        gl_FragColor = vec4(vec3(bright), 1.0);
        return;
      }

      vec2 pp = v_uv * u_res;

      float chosen = 8.0;
      bool found   = false;
      for (int i = 0; i < 9; i++) {
        if (!found) {
          float s  = sizeAt(i);
          vec2 bc  = (floor(pp / s) + 0.5) * s / u_res;
          float dx = s / u_res.x;
          float dy = s / u_res.y;
          float a = wv(bc);
          float b = wv(bc + vec2( dx,  0.0));
          float c = wv(bc + vec2(-dx,  0.0));
          float d = wv(bc + vec2(0.0,  dy));
          float e = wv(bc + vec2(0.0, -dy));
          float hi = max(a, max(b, max(c, max(d, e))));
          float lo = min(a, min(b, min(c, min(d, e))));
          if (hi - lo < u_threshold) { chosen = s; found = true; }
        }
      }

      // t: large block (128) → 0, small block (8) → 1
      float t = 1.0 - (log2(chosen) - 3.0) / 4.0;

      // Use the wave amplitude at this block's centre to spatially offset the
      // colormap cycle — wave crests lead, troughs trail, calm areas are neutral.
      vec2 blockCen = (floor(pp / chosen) + 0.5) * chosen / u_res;
      float waveAmp = wv(blockCen) * 2.0 - 1.0; // decode R channel → -1..1
      float localTime = u_time + waveAmp * 5.0;  // ±1 full colormap slot offset

      // Cycle through 10 colormaps, 5 s each, blend over last 30% of each slot
      float pos   = mod(localTime / 5.0, 10.0);
      int   mapA  = int(pos);
      int   mapB  = (mapA == 9) ? 0 : mapA + 1;
      float blend = smoothstep(0.7, 1.0, fract(pos));
      vec3  col   = mix(palette(mapA, t), palette(mapB, t), blend);

      vec2 cell = fract(pp / chosen);
      vec2 cc   = cell - 0.5;    // centred cell coords ∈ [-0.5, 0.5]
      float bw  = 0.07;

      // ── Shape: star ↔ square ↔ circle driven by gradient structure ──────────
      float gdx = chosen / u_res.x;
      float gdy = chosen / u_res.y;
      float gx  = wv(blockCen + vec2(gdx, 0.0))  - wv(blockCen - vec2(gdx, 0.0));
      float gy  = wv(blockCen + vec2(0.0, gdy))  - wv(blockCen - vec2(0.0, gdy));
      float gne = wv(blockCen + vec2(gdx,  gdy)) - wv(blockCen - vec2(gdx,  gdy));
      float gnw = wv(blockCen + vec2(-gdx, gdy)) - wv(blockCen - vec2(-gdx, gdy));
      float gxx = gx * gx, gyy = gy * gy;
      float EA  = gxx + gyy;
      float ED  = gne * gne + gnw * gnw;

      // axis isotropy → circle (same as before)
      float circleBlend = smoothstep(0.2, 0.8,
        1.0 - abs(gxx - gyy) / (EA + 0.0001));

      // diagonal dominance → star/plus; exponent drops toward 0.1 as signal strengthens
      float diagRatio = clamp((ED - EA) / (ED + EA + 0.0001), 0.0, 1.0);
      float axisWeight = 1.0 - smoothstep(0.1, 0.6, diagRatio);
      float starP  = mix(0.667, 0.1, smoothstep(0.1, 0.9, diagRatio));

      float sqSdf  = max(abs(cc.x), abs(cc.y));
      float cirSdf = length(cc);
      // Lp norm with variable p: 2/3 → astroid, ~0.1 → plus sign
      float astSdf = pow(pow(abs(cc.x), starP) + pow(abs(cc.y), starP), 1.0 / starP);
      float sdf    = mix(astSdf, mix(sqSdf, cirSdf, circleBlend), axisWeight);

      bool outside = sdf > 0.5;
      bool edge    = !outside && sdf > (0.5 - bw);

      vec3 fillCol = clamp(col * 0.55, 0.0, 1.0);
      vec3 edgeCol = clamp(col * 1.5,  0.0, 1.0);

      // Corners of circular blocks: show the next smaller block level as a square
      float chosenSub = nextSize(chosen);
      float tSub      = 1.0 - (log2(chosenSub) - 3.0) / 4.0;
      vec3  colSub    = mix(palette(mapA, tSub), palette(mapB, tSub), blend);
      vec2  cc2       = fract(pp / chosenSub) - 0.5;
      float sqSdf2    = max(abs(cc2.x), abs(cc2.y));
      vec3  subRgb    = (sqSdf2 > 0.5 - bw)
                          ? clamp(colSub * 1.5, 0.0, 1.0)
                          : colSub * 0.55;

      vec3 rgb = edge ? edgeCol : fillCol;
      vec3 finalRgb = outside ? subRgb : rgb;
      float luma = dot(finalRgb, vec3(0.299, 0.587, 0.114));
      finalRgb = mix(vec3(luma), finalRgb, u_saturation);
      gl_FragColor = vec4(finalRgb, 1.0);
    }
  `;

  // ── Mount ─────────────────────────────────────────────────────────────────

  onMount(() => {
    const glCtx = canvas.getContext('webgl', { antialias: false });
    if (!glCtx) return () => {};
    const gl = glCtx;

    const glyphSeed  = Array.from({ length: N }, () => (Math.random() * 0xffffffff) | 0);
    const fontNextMs = Array.from({ length: N }, () => performance.now() + Math.random() * 12000);

    const omega     = new Float32Array(N);
    const c2        = new Float32Array(N);
    const omegaNext = new Float32Array(N);
    const c2Next    = new Float32Array(N);
    const now0 = performance.now();
    for (let i = 0; i < N; i++) {
      omega[i]     = 0.06 + Math.random() * 0.16;
      c2[i]        = 0.08 + Math.random() * 0.32;
      omegaNext[i] = now0 + Math.random() * 16000;
      c2Next[i]    = now0 + Math.random() * 16000;
    }

    const unroll = (arr: string) =>
      Array.from({ length: N }, (_, k) =>
        k === 0
          ? `float val = ${arr}[0];`
          : `if (li == ${k}) val = ${arr}[${k}];`
      ).join(' ');

    const WAVE_FRAG = /* glsl */ `
      precision highp float;
      uniform sampler2D u_wave;
      uniform sampler2D u_text;
      uniform vec2  u_texel;
      uniform float u_simStep;
      uniform float u_gridX0;
      uniform float u_gridY0;
      uniform float u_cellFracX;
      uniform float u_cellFracY;
      uniform float u_numCols;
      uniform float u_damping;
      uniform float u_srcAmp;
      uniform float u_speedScale;
      uniform float u_freqScale;
      uniform float u_omega[${N}];
      uniform float u_c2[${N}];
      uniform float u_eyeX;
      uniform float u_eyeY;
      uniform float u_eyeActive;
      uniform float u_eyeOmega;
      uniform float u_eyeRadius;
      varying vec2 v_uv;
      void main() {
        float curr = texture2D(u_wave, v_uv).r * 2.0 - 1.0;
        float prev = texture2D(u_wave, v_uv).g * 2.0 - 1.0;
        float n = texture2D(u_wave, v_uv + vec2(       0.0,  u_texel.y)).r * 2.0 - 1.0;
        float s = texture2D(u_wave, v_uv + vec2(       0.0, -u_texel.y)).r * 2.0 - 1.0;
        float e = texture2D(u_wave, v_uv + vec2( u_texel.x,        0.0)).r * 2.0 - 1.0;
        float w = texture2D(u_wave, v_uv + vec2(-u_texel.x,        0.0)).r * 2.0 - 1.0;

        // v_uv.y=0 is bottom of screen; canvas y=0 is top — flip y for grid lookup
        float colF = floor((v_uv.x - u_gridX0) / u_cellFracX);
        float rowF = floor(((1.0 - v_uv.y) - u_gridY0) / u_cellFracY);
        int li = int(clamp(rowF * u_numCols + colF, 0.0, ${N - 1}.0));
        ${unroll('u_c2')}
        float localC2 = val;

        // clamp effective c2 to 0.49 to stay numerically stable regardless of slider
        float effectiveC2 = min(localC2 * u_speedScale, 0.49);
        vec2  eyeVec  = v_uv - vec2(u_eyeX, 1.0 - u_eyeY);
        float rawDist = length(eyeVec);
        float angle   = atan(eyeVec.y, eyeVec.x);
        float ts      = float(u_simStep) * 0.007;
        float blob    = 1.0
          + 0.28 * sin(angle * 3.0 + ts * 0.6)
          + 0.16 * sin(angle * 5.0 - ts * 0.4)
          + 0.10 * sin(angle * 7.0 + ts * 0.9);
        float eyeDist = u_eyeActive > 0.5 ? rawDist / max(blob, 0.3) : 1.0;
        float eyeZone = smoothstep(u_eyeRadius + 0.4, 0.0, eyeDist);
        float activeC2   = mix(effectiveC2, 0.49, eyeZone);
        float activeDamping = mix(u_damping, 1.0, eyeZone);
        float next = (2.0*curr - prev + activeC2*(n + s + e + w - 4.0*curr)) * activeDamping;
        next = clamp(next, -1.0, 1.0);

        float isText = texture2D(u_text, v_uv).r;
        if (isText > 0.5) {
          ${unroll('u_omega')}
          float localOmega = val;
          next = sin(u_simStep * localOmega * u_freqScale) * u_srcAmp;
        }

        if (u_eyeActive > 0.5 && eyeDist < u_eyeRadius) {
          next = sin(u_simStep * u_eyeOmega) * 1.0;
        }
gl_FragColor = vec4(next * 0.5 + 0.5, curr * 0.5 + 0.5, 0.0, 1.0);
      }
    `;

    function makeProgram(vert: string, frag: string) {
      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          console.error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram()!;
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vert));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(p);
      return p;
    }

    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    function bindQuad(prog: WebGLProgram) {
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      const loc = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }

    function makeWaveFBO(w: number, h: number) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0.5, 0.5, 0.5, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fbo };
    }

    const waveProg    = makeProgram(VERT, WAVE_FRAG);
    const displayProg = makeProgram(VERT, DISPLAY_FRAG);

    const wLoc = {
      wave:      gl.getUniformLocation(waveProg, 'u_wave'),
      text:      gl.getUniformLocation(waveProg, 'u_text'),
      texel:     gl.getUniformLocation(waveProg, 'u_texel'),
      simStep:   gl.getUniformLocation(waveProg, 'u_simStep'),
      gridX0:    gl.getUniformLocation(waveProg, 'u_gridX0'),
      gridY0:    gl.getUniformLocation(waveProg, 'u_gridY0'),
      cellFracX: gl.getUniformLocation(waveProg, 'u_cellFracX'),
      cellFracY: gl.getUniformLocation(waveProg, 'u_cellFracY'),
      numCols:   gl.getUniformLocation(waveProg, 'u_numCols'),
      damping:    gl.getUniformLocation(waveProg, 'u_damping'),
      srcAmp:     gl.getUniformLocation(waveProg, 'u_srcAmp'),
      speedScale: gl.getUniformLocation(waveProg, 'u_speedScale'),
      freqScale:  gl.getUniformLocation(waveProg, 'u_freqScale'),
      omega:      gl.getUniformLocation(waveProg, 'u_omega'),
      c2:         gl.getUniformLocation(waveProg, 'u_c2'),
      eyeX:      gl.getUniformLocation(waveProg, 'u_eyeX'),
      eyeY:      gl.getUniformLocation(waveProg, 'u_eyeY'),
      eyeActive: gl.getUniformLocation(waveProg, 'u_eyeActive'),
      eyeOmega:  gl.getUniformLocation(waveProg, 'u_eyeOmega'),
      eyeRadius: gl.getUniformLocation(waveProg, 'u_eyeRadius'),
    };
    const dLoc = {
      wave:      gl.getUniformLocation(displayProg, 'u_wave'),
      res:       gl.getUniformLocation(displayProg, 'u_res'),
      threshold: gl.getUniformLocation(displayProg, 'u_threshold'),
      time:      gl.getUniformLocation(displayProg, 'u_time'),
      funcView:    gl.getUniformLocation(displayProg, 'u_funcView'),
      saturation:  gl.getUniformLocation(displayProg, 'u_saturation'),
    };
    const startTime = performance.now();


let W = 0, H = 0;
    let gridX0 = 0, gridY0 = 0, cellFracX = 1, cellFracY = 1, numCols = N;
    let textTex!: WebGLTexture;
    let waveBufs!: [{ tex: WebGLTexture; fbo: WebGLFramebuffer }, { tex: WebGLTexture; fbo: WebGLFramebuffer }];
    let waveIdx = 0;
    let simStep = 0;

    function bestGrid(n: number, w: number, h: number) {
      let best = 0, bestC = n, bestR = 1;
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const sz = Math.min(w / c, h / r);
        if (sz > best) { best = sz; bestC = c; bestR = r; }
      }
      return { cols: bestC, rows: bestR, cellSize: best };
    }

    function buildTextTex() {
      if (W === 0 || H === 0) return;
      const { cols, rows, cellSize } = bestGrid(N, W, H);
      numCols = cols;

      const gridW = cols * cellSize;
      const gridH = rows * cellSize;
      const startX = (W - gridW) / 2;
      const startY = (H - gridH) / 2;
      gridX0    = startX / W;
      gridY0    = startY / H;
      cellFracX = cellSize / W;
      cellFracY = cellSize / H;

      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const ctx = off.getContext('2d')!;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < N; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = startX + (col + 0.5) * cellSize;
        const cy = startY + (row + 0.5) * cellSize;
        drawGlyph(ctx, TEXT[i], cx, cy, cellSize, cellSize, glyphSeed[i]);
      }

      if (textTex) gl.deleteTexture(textTex);
      textTex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // ── Eye ───────────────────────────────────────────────────────────────────
    let eyeOmegaVal  = 0.3;
    let eyeRadiusVal = 0.008;
    let eyeTimeout: ReturnType<typeof setTimeout> | null = null;
    let pressStart   = 0;

    const ro = new ResizeObserver(() => {
      W = canvas.width  = Math.round(canvas.clientWidth  * devicePixelRatio);
      H = canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
      waveBufs = [makeWaveFBO(W, H), makeWaveFBO(W, H)];
      waveIdx = 0; simStep = 0;
      buildTextTex();
    });
    ro.observe(canvas);

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      eyeNX        = (e.clientX - rect.left) / rect.width;
      eyeNY        = (e.clientY - rect.top)  / rect.height;
      eyeRadiusVal = 0.008;
      eyeOmegaVal  = 0.25 + Math.random() * 0.25;
      eyeActive    = true;
      pressStart   = performance.now();
      if (eyeTimeout) { clearTimeout(eyeTimeout); eyeTimeout = null; }
    });

    canvas.addEventListener('mouseup', () => {
      pressStart = 0;
      eyeActive  = false;
    });

    let raf: number;

    function frame() {
      if (!textTex || !waveBufs) { raf = requestAnimationFrame(frame); return; }

      const nowMs = performance.now();

      if (pressStart > 0) {
        const t = Math.min((nowMs - pressStart) / 2000, 1);
        eyeRadiusVal = 0.008 + t * (0.3 - 0.008);
      }

      let fontChanged = false;
      for (let i = 0; i < N; i++) {
        if (nowMs > fontNextMs[i]) {
          glyphSeed[i]  = (Math.random() * 0xffffffff) | 0;
          fontNextMs[i] = nowMs + 2400 + Math.random() * 9600;
          fontChanged   = true;
        }
      }
      if (fontChanged) buildTextTex();

      for (let i = 0; i < N; i++) {
        if (nowMs > omegaNext[i]) {
          omega[i]     = 0.06 + Math.random() * 0.16;
          omegaNext[i] = nowMs + 4000 + Math.random() * 16000;
        }
        if (nowMs > c2Next[i]) {
          c2[i]     = 0.08 + Math.random() * 0.32;
          c2Next[i] = nowMs + 4000 + Math.random() * 16000;
        }
      }

      for (let sub = 0; sub < SUBSTEPS; sub++) {
        const src = waveIdx;
        const dst = 1 - waveIdx;

        gl.bindFramebuffer(gl.FRAMEBUFFER, waveBufs[dst].fbo);
        gl.viewport(0, 0, W, H);
        gl.useProgram(waveProg);
        bindQuad(waveProg);

        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, waveBufs[src].tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textTex);

        gl.uniform1i(wLoc.wave, 0);
        gl.uniform1i(wLoc.text, 1);
        gl.uniform2f(wLoc.texel, 1 / W, 1 / H);
        gl.uniform1f(wLoc.simStep, simStep);
        gl.uniform1f(wLoc.gridX0,    gridX0);
        gl.uniform1f(wLoc.gridY0,    gridY0);
        gl.uniform1f(wLoc.cellFracX, cellFracX);
        gl.uniform1f(wLoc.cellFracY, cellFracY);
        gl.uniform1f(wLoc.numCols,   numCols);
        gl.uniform1f(wLoc.damping,    damping);
        gl.uniform1f(wLoc.srcAmp,     srcAmp);
        gl.uniform1f(wLoc.speedScale, speedScale);
        gl.uniform1f(wLoc.freqScale,  freqScale);
        gl.uniform1fv(wLoc.omega, omega);
        gl.uniform1fv(wLoc.c2, c2);
        gl.uniform1f(wLoc.eyeX,      eyeNX);
        gl.uniform1f(wLoc.eyeY,      eyeNY);
        gl.uniform1f(wLoc.eyeActive, eyeActive ? 1.0 : 0.0);
        gl.uniform1f(wLoc.eyeOmega,  eyeOmegaVal);
        gl.uniform1f(wLoc.eyeRadius, eyeRadiusVal);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        waveIdx = dst;
        simStep++;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(displayProg);
      bindQuad(displayProg);

      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, waveBufs[waveIdx].tex);

      gl.uniform1i(dLoc.wave, 0);
      gl.uniform2f(dLoc.res, W, H);
      gl.uniform1f(dLoc.threshold, threshold);
      gl.uniform1f(dLoc.time, (performance.now() - startTime) / 1000.0);
      gl.uniform1i(dLoc.funcView,   funcView ? 1 : 0);
      gl.uniform1f(dLoc.saturation, saturation);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  });
</script>

<div class="wrap">
  <canvas bind:this={canvas}></canvas>

  <div class="controls">
    <button class="view-toggle" onclick={() => funcView = !funcView}>
      {funcView ? 'function' : 'shape'}
    </button>
    <label>
      <span class="name">saturation</span>
      <input type="range" min="0" max="2" step="0.01" bind:value={saturation} />
      <span class="val">{saturation.toFixed(2)}</span>
    </label>
    <label>
      <span class="name">damping</span>
      <input type="range" min="0.990" max="0.9999" step="0.0001" bind:value={damping} />
      <span class="val">{damping.toFixed(4)}</span>
    </label>
    <label>
      <span class="name">source amp</span>
      <input type="range" min="0.05" max="1.5" step="0.01" bind:value={srcAmp} />
      <span class="val">{srcAmp.toFixed(2)}</span>
    </label>
    <label>
      <span class="name">speed</span>
      <input type="range" min="0.1" max="4.0" step="0.05" bind:value={speedScale} />
      <span class="val">{speedScale.toFixed(2)}</span>
    </label>
    <label>
      <span class="name">frequency</span>
      <input type="range" min="0.1" max="6.0" step="0.1" bind:value={freqScale} />
      <span class="val">{freqScale.toFixed(1)}</span>
    </label>
    <label>
      <span class="name">threshold</span>
      <input type="range" min="0.002" max="0.12" step="0.001" bind:value={threshold} />
      <span class="val">{threshold.toFixed(3)}</span>
    </label>
  </div>
</div>

<style>
  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .controls {
    position: absolute;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid #222;
    border-radius: 4px;
    padding: 0.9rem 1rem;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  label {
    display: grid;
    grid-template-columns: 6.5rem 1fr 3rem;
    align-items: center;
    gap: 0.6rem;
  }

  .name {
    font-size: 0.7rem;
    color: #666;
    letter-spacing: 0.05em;
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 2px;
    background: #333;
    outline: none;
    cursor: pointer;
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  input[type='range']::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    border: none;
    cursor: pointer;
  }


  .view-toggle {
    font-size: 0.68rem;
    padding: 0.2rem 0.6rem;
    border: 1px solid #555;
    border-radius: 3px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    align-self: flex-end;
    margin-bottom: 0.4rem;
  }

  .view-toggle:hover {
    border-color: #fff;
    color: #fff;
  }

  .val {
    font-size: 0.68rem;
    color: #555;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

</style>
