<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  const TEXT = 'WILLSAMOSIR';
  const N = TEXT.length;

  const SUBSTEPS = 1;
  const DAMPING  = 0.9985;
  const SRC_AMP  = 0.88;

  const STYLES = [
    'normal 400 1em "Courier New", monospace',
    'normal 700 1em "Courier New", monospace',
    'italic 400 1em "Courier New", monospace',
    'italic 700 1em "Courier New", monospace',
    'normal 400 1em Georgia, serif',
    'normal 700 1em Georgia, serif',
    'italic 400 1em Georgia, serif',
    'italic 700 1em Georgia, serif',
    'normal 400 1em "Times New Roman", serif',
    'italic 400 1em "Times New Roman", serif',
    'normal 700 1em Arial, sans-serif',
    'normal 900 1em Arial, sans-serif',
    'normal 400 1em "Palatino Linotype", Palatino, serif',
    'italic 400 1em "Palatino Linotype", Palatino, serif',
  ] as const;

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
    varying vec2 v_uv;
    void main() {
      float waveH = texture2D(u_wave, v_uv).r * 2.0 - 1.0;
      float wave  = pow(max(0.0, waveH), 0.65) * 0.85;
      gl_FragColor = vec4(vec3(wave), 1.0);
    }
  `;

  // ── Mount ─────────────────────────────────────────────────────────────────

  onMount(() => {
    const glCtx = canvas.getContext('webgl', { antialias: false });
    if (!glCtx) return () => {};
    const gl = glCtx;

    // ── Per-letter state ──
    // Font style: affects glyph shape → requires textTex rebuild
    const fontStyle   = Array.from({ length: N }, () => Math.floor(Math.random() * STYLES.length));
    const fontNextMs  = Array.from({ length: N }, () => performance.now() + Math.random() * 12000);

    // Wave params: affect simulation uniforms only, no rebuild needed
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

    // ── Wave shader — generated so the if-else unrolls are N-specific ──
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
      uniform float u_padFrac;
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

        // Per-letter wave speed from x position
        float lx = (v_uv.x - u_padFrac) / (1.0 - 2.0 * u_padFrac);
        int li = int(clamp(floor(lx * ${N}.0), 0.0, ${N - 1}.0));
        ${unroll('u_c2')}
        float localC2 = val;

        float next = (2.0*curr - prev + localC2*(n + s + e + w - 4.0*curr)) * ${DAMPING};
        next = clamp(next, -1.0, 1.0);

        // Source pixels: force oscillation at per-letter frequency
        float isText = texture2D(u_text, v_uv).r;
        if (isText > 0.5) {
          ${unroll('u_omega')}
          float localOmega = val;
          next = sin(u_simStep * localOmega) * ${SRC_AMP};
        }

        gl_FragColor = vec4(next * 0.5 + 0.5, curr * 0.5 + 0.5, 0.0, 1.0);
      }
    `;

    // ── GL helpers ──

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
      wave:    gl.getUniformLocation(waveProg, 'u_wave'),
      text:    gl.getUniformLocation(waveProg, 'u_text'),
      texel:   gl.getUniformLocation(waveProg, 'u_texel'),
      simStep: gl.getUniformLocation(waveProg, 'u_simStep'),
      padFrac: gl.getUniformLocation(waveProg, 'u_padFrac'),
      omega:   gl.getUniformLocation(waveProg, 'u_omega'),
      c2:      gl.getUniformLocation(waveProg, 'u_c2'),
    };
    const dLoc = {
      wave: gl.getUniformLocation(displayProg, 'u_wave'),
      text: gl.getUniformLocation(displayProg, 'u_text'),
    };

    let W = 0, H = 0, padFrac = 0;
    let textTex!: WebGLTexture;
    let waveBufs!: [{ tex: WebGLTexture; fbo: WebGLFramebuffer }, { tex: WebGLTexture; fbo: WebGLFramebuffer }];
    let waveIdx = 0;
    let simStep = 0;

    function buildTextTex() {
      if (W === 0 || H === 0) return;
      const paddingX = W * 0.028;
      padFrac        = paddingX / W;
      const slotW    = (W - 2 * paddingX) / N;
      const fontSize = Math.min(H * 0.6, slotW * 1.4);

      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const ctx = off.getContext('2d')!;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < N; i++) {
        ctx.font = STYLES[fontStyle[i]].replace('1em', `${fontSize}px`);
        ctx.fillText(TEXT[i], paddingX + (i + 0.5) * slotW, H / 2);
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

      // Font style changes → rebuild text mask only
      let fontChanged = false;
      for (let i = 0; i < N; i++) {
        if (nowMs > fontNextMs[i]) {
          let next: number;
          do { next = Math.floor(Math.random() * STYLES.length); }
          while (next === fontStyle[i]);
          fontStyle[i]  = next;
          fontNextMs[i] = nowMs + 2400 + Math.random() * 9600;
          fontChanged   = true;
        }
      }
      if (fontChanged) buildTextTex();

      // Wave param changes → just update the Float32Arrays, uploaded below
      for (let i = 0; i < N; i++) {
        if (nowMs > omegaNext[i]) {
          omega[i]     = 0.06 + Math.random() * 0.16;
          omegaNext[i] = nowMs + 4000 + Math.random() * 16000;
        }
        if (nowMs > c2Next[i]) {
          c2[i]    = 0.08 + Math.random() * 0.32;
          c2Next[i] = nowMs + 4000 + Math.random() * 16000;
        }
      }

      // Simulation substeps
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
        gl.uniform1f(wLoc.padFrac, padFrac);
        gl.uniform1fv(wLoc.omega, omega);
        gl.uniform1fv(wLoc.c2, c2);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        waveIdx = dst;
        simStep++;
      }

      // Display
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(displayProg);
      bindQuad(displayProg);

      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, waveBufs[waveIdx].tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textTex);

      gl.uniform1i(dLoc.wave, 0);
      gl.uniform1i(dLoc.text, 1);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  });
</script>

<canvas bind:this={canvas}></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
