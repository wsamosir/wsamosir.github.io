<script lang="ts">

    import { onMount } from "svelte";
    import vertexShaderSource from './source.vert?raw';
    import fragmentShaderSource from './source.frag?raw';
    import blendShaderSource from './blend.frag?raw';
    

    // --- Variables ---

    // References to the canvas and input
    let canvas: HTMLCanvasElement;
    
    // Offscreen canvas used to render text
    let textCanvas: HTMLCanvasElement;
    let textCanvasContext: CanvasRenderingContext2D | null;
    let textTexture: WebGLTexture; // texture for the text canvas

    let userText: string = ""; // user input text
    let textDirty = false; // flag: new text typed
  
    // WebGL variables
    let gl: WebGLRenderingContext;
    let textureA: WebGLTexture, textureB: WebGLTexture;
    let fbA: WebGLFramebuffer, fbB: WebGLFramebuffer;
    let readTexture: WebGLTexture, writeFramebuffer: WebGLFramebuffer;

    // --- Utility functions ---
    
    // Create an NPOT-safe texture with given width and height.
    function createTexture(gl: WebGLRenderingContext, width: number, height: number): WebGLTexture {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
    }
    
    // Create a framebuffer attaching the given texture.
    function createFramebuffer(gl: WebGLRenderingContext, tex: WebGLTexture): WebGLFramebuffer {
        const fb = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return fb;
    }
    
    // Create an offscreen canvas for drawing text.
    function createTextCanvas(width: number, height: number): HTMLCanvasElement {
        const offCanvas = document.createElement("canvas");
        offCanvas.width = width;
        offCanvas.height = height;
        return offCanvas;
    }
    
    // Render the text (from userText) onto textCanvas.
    function updateTextCanvas(text: string) {

        const ctx = textCanvasContext
        if (!ctx) return;
        textCanvas.width = canvas.width;
        textCanvas.height = canvas.height;

        ctx.setTransform(1, 0, 0, -1, 0, textCanvas.height);

        // Clear with transparent background (so that only text is drawn)
        ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);

        // Configure text appearance
        // randomize size and color and location for fun
        const randomSize = Math.floor(Math.random() * 1000) + 20; // Random size between 20 and 70
        // const randomColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        // rgb random color
        const randomColor = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
        // const randomColor = `hsl(${Math.floor(Math.random() * 360)}, ${Math.floor(Math.random() * 100)}%, ${Math.floor(Math.random() * 100)}%)`;
        const randomX = Math.floor(Math.random() * textCanvas.width - textCanvas.width / 2);
        const randomY = Math.floor(Math.random() * textCanvas.height - textCanvas.height / 2);
        ctx.translate(randomX, randomY); // Randomize position
        ctx.font = `${randomSize}px sans-serif`;
        ctx.fillStyle = randomColor;
        // ctx.font = "48px sans-serif";
        // ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);

    }

    function updateTextTexture(textTexture: WebGLTexture) {
        // Assuming updateTextCanvas() already draws your text onto textCanvas.
        gl.bindTexture(gl.TEXTURE_2D, textTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            textCanvas
        );
    }
    
    // Stamp the text into the current simulation texture.
    function stampTextToTexture(targetTexture: WebGLTexture) {

        if (!textCanvasContext) return; // Safety check

        const imageData = textCanvasContext.getImageData(0, 0, textCanvas.width, textCanvas.height);

        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0, 0,
            textCanvas.width,
            textCanvas.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            imageData.data 
        );
     
    }

    function saveTextureAsImage(gl: WebGLRenderingContext, texture: WebGLTexture, width: number, height: number) {
        // 1. Create a framebuffer and attach the texture
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        // 2. Read the pixels from the framebuffer
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // 3. Unbind the framebuffer so we don't interfere with normal rendering
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // 4. Create a 2D canvas to write the pixels into
        const canvas2D = document.createElement("canvas");
        canvas2D.width = width;
        canvas2D.height = height;
        const ctx = canvas2D.getContext("2d")!;
        const imageData = ctx.createImageData(width, height);

        // 5. WebGL's origin is bottom-left, canvas is top-left — flip Y
        for (let y = 0; y < height; y++) {
            const flippedRow = height - y - 1;
            for (let x = 0; x < width; x++) {
                const srcIndex = (flippedRow * width + x) * 4;
                const dstIndex = (y * width + x) * 4;
                imageData.data.set(pixels.subarray(srcIndex, srcIndex + 4), dstIndex);
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // 6. Trigger a download
        const link = document.createElement("a");
        link.download = "texture-output.png";
        link.href = canvas2D.toDataURL("image/png");
        link.click();
    }

    // --- End Utilities --- 
    
    onMount(() => {

        if (!canvas) {
            console.error("Canvas not found");
            return;
        }

        // Initialize WebGL and canvas sizes.
        gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
        if (!gl) {
            console.error("WebGL not supported");
            return;
        }
        

        // Compile and link our shader programs.
        const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
        if (!program) return;

        const blendProgram = createProgram(gl, vertexShaderSource, blendShaderSource);
        if (!blendProgram) return;

        gl.useProgram(program);
        
        // initialize textTexture
        textTexture = createTexture(gl, canvas.width, canvas.height);

        // Set up the vertex data for a full-screen quad.
        const positions = new Float32Array([
            -1, -1, 
             1, -1, 
            -1,  1, 
            -1,  1,
             1, -1, 
             1,  1,
        ]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const aPosition = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);


        // Uniform locations.
        const uTimeLocation = gl.getUniformLocation(program, "u_time");
        const uResolutionLocation = gl.getUniformLocation(program, "u_resolution");
        const uImageLocation = gl.getUniformLocation(program, "u_image");
    

        // Ensure the canvas drawing dimensions match the display size
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        
        // Create ping-pong textures & framebuffers at canvas size.
        textureA = createTexture(gl, canvas.width, canvas.height);
        textureB = createTexture(gl, canvas.width, canvas.height);
        fbA = createFramebuffer(gl, textureA);
        fbB = createFramebuffer(gl, textureB);
      
        // Initially, use textureA as the read texture and fbB as write target.
        readTexture = textureA;
        writeFramebuffer = fbB;
        
        // Create our offscreen text canvas for stamping text (same size as simulation).
        textCanvas = createTextCanvas(canvas.width, canvas.height);
        textCanvasContext = textCanvas.getContext("2d", { willReadFrequently: true });

        // Utility function: compile a shader.
        function compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
            const shader = gl.createShader(type);
            if (!shader) {
                console.error("Unable to create shader");
                return null;
            }
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error("Shader compile error:", gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }
    
        // Utility function: create a WebGL program.
        function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
            const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
            const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
            if (!vertexShader || !fragmentShader) {
                return null;
            }
            const program = gl.createProgram();
            if (!program) {
                console.error("Unable to create program");
                return null;
            }
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error("Program link error:", gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                return null;
            }
            return program;
        }
      
        let startTime = performance.now();
        
        function render() {

            if (!gl) return; // Safety check
            if (!canvas) return; // Safety check
            if (!textCanvas) return; // Safety check
            if (!blendProgram) return; // Safety check

            const currentTime = performance.now();
            const elapsed = (currentTime - startTime) / 1000; // seconds
            
            // 1. Simulation Pass: Render update to the write framebuffer.
            gl.bindFramebuffer(gl.FRAMEBUFFER, writeFramebuffer);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT); // ← this is what applies the clear color

            // Provide time and resolution uniforms.
            if (uTimeLocation) gl.uniform1f(uTimeLocation, elapsed);
            if (uResolutionLocation) gl.uniform2f(uResolutionLocation, canvas.width, canvas.height);
            
            // Bind the readTexture as the current u_image.
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, readTexture);
            if (uImageLocation) gl.uniform1i(uImageLocation, 0);

            // Render your full-screen quad so that the simulation shader processes readTexture
            // and writes the updated state into the write framebuffer.
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            // 2. If new text is available (textDirty flag set), stamp it onto the simulation output.
            if (textDirty) {
                // First, update the text texture from your textCanvas.
                updateTextTexture(textTexture);
                // saveTextureAsImage(gl, textTexture, canvas.width, canvas.height); // Save the text texture as an image

                // Then blend the text texture over your simulation texture.
                gl.bindFramebuffer(gl.FRAMEBUFFER, writeFramebuffer);
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.useProgram(blendProgram);

                // Bind simulation texture as u_simulation...
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, readTexture);
                gl.uniform1i(gl.getUniformLocation(blendProgram, "u_simulation"), 0);

                // Bind text texture as u_text...
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, textTexture);
                gl.uniform1i(gl.getUniformLocation(blendProgram, "u_text"), 1);

                // Render the full-screen quad: this writes the blended result into your writeFramebuffer.
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                textDirty = false;

                // saveTextureAsImage(gl, (writeFramebuffer === fbB) ? textureB : textureA, canvas.width, canvas.height);


            }


            // 3. Final Pass: Render the updated simulation to the screen.
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);
            // gl.clear(gl.COLOR_BUFFER_BIT);
            
            // Now, display the texture that was just written to.
            gl.useProgram(program); // Switch back to the main program for rendering    
            let displayTexture = (writeFramebuffer === fbB) ? textureB : textureA;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, displayTexture);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            
            // 4. Swap read and write buffers for next frame.
            if (writeFramebuffer === fbB) {
                readTexture = textureB;
                writeFramebuffer = fbA;
            } else {
                readTexture = textureA;
                writeFramebuffer = fbB;
            }
            
            requestAnimationFrame(render);
        }
      
        requestAnimationFrame(render);
    });

</script>

<!-- A text input; as the user types, we update the offscreen text canvas -->
<input
    type="text"
    bind:value={userText}
    on:input={() => {
    updateTextCanvas(userText);
    textDirty = true; // mark that we want to stamp the text this frame
    }}
    placeholder="Type something..."
    style="position: absolute; z-index: 1; top: 10px; left: 10px; font-size: 20px; padding: 5px;"
/>

<canvas bind:this={canvas} style="width: 100vw; height: 100vh; display: block;"></canvas>
