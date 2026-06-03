<script lang="ts">
  import { onMount } from 'svelte';
  import { drawGlyph } from '$lib/generativeFont';

  let canvas: HTMLCanvasElement;

  const TEXT = 'WILLSAMOSIR';
  const N = TEXT.length;
  const SUBSTEPS = 1;

  // ── Exposed uniforms (bound to sliders) ──────────────────────────────────
  let damping    = $state(0.9985);
  let srcAmp     = $state(0.88);
  let gamma      = $state(0.65);
  let brightness = $state(0.85);
  let speedScale = $state(1.0);   // scales per-letter c2 (wave propagation speed)
  let freqScale  = $state(1.0);   // scales per-letter omega (source frequency → wavelength)

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
    uniform sampler2D u_text;
    uniform float u_gamma;
    uniform float u_brightness;
    varying vec2 v_uv;
    void main() {
      float waveH = texture2D(u_wave, v_uv).r * 2.0 - 1.0;
      float wave  = pow(max(0.0, waveH), u_gamma) * u_brightness;
      gl_FragColor = vec4(vec3(wave), 1.0);
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
        float next = (2.0*curr - prev + effectiveC2*(n + s + e + w - 4.0*curr)) * u_damping;
        next = clamp(next, -1.0, 1.0);

        float isText = texture2D(u_text, v_uv).r;
        if (isText > 0.5) {
          ${unroll('u_omega')}
          float localOmega = val;
          next = sin(u_simStep * localOmega * u_freqScale) * u_srcAmp;
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
    };
    const dLoc = {
      wave:       gl.getUniformLocation(displayProg, 'u_wave'),
      text:       gl.getUniformLocation(displayProg, 'u_text'),
      gamma:      gl.getUniformLocation(displayProg, 'u_gamma'),
      brightness: gl.getUniformLocation(displayProg, 'u_brightness'),
    };

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

    const ro = new ResizeObserver(() => {
      W = canvas.width  = Math.round(canvas.clientWidth  * devicePixelRatio);
      H = canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
      waveBufs = [makeWaveFBO(W, H), makeWaveFBO(W, H)];
      waveIdx = 0; simStep = 0;
      buildTextTex();
    });
    ro.observe(canvas);

    let raf: number;

    function frame() {
      if (!textTex || !waveBufs) { raf = requestAnimationFrame(frame); return; }

      const nowMs = performance.now();

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

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        waveIdx = dst;
        simStep++;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(displayProg);
      bindQuad(displayProg);

      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, waveBufs[waveIdx].tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textTex);

      gl.uniform1i(dLoc.wave, 0);
      gl.uniform1i(dLoc.text, 1);
      gl.uniform1f(dLoc.gamma,      gamma);
      gl.uniform1f(dLoc.brightness, brightness);

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
      <span class="name">gamma</span>
      <input type="range" min="0.1" max="2.0" step="0.05" bind:value={gamma} />
      <span class="val">{gamma.toFixed(2)}</span>
    </label>
    <label>
      <span class="name">brightness</span>
      <input type="range" min="0.1" max="3.0" step="0.05" bind:value={brightness} />
      <span class="val">{brightness.toFixed(2)}</span>
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

  .val {
    font-size: 0.68rem;
    color: #555;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
