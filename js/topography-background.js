(() => {
    let canvas = document.getElementById("topography-canvas");
    if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "topography-canvas";
        canvas.className = "topography-canvas";
        canvas.setAttribute("aria-hidden", "true");
        document.body.prepend(canvas);
    }

    const gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power"
    });

    if (!gl) return;

    gl.getExtension("OES_standard_derivatives");

    const vertexShaderSource = `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
            vUv = (aPosition + 1.0) * 0.5;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `;

    const fragmentShaderSource = `
        #ifdef GL_OES_standard_derivatives
        #extension GL_OES_standard_derivatives : enable
        #endif

        precision highp float;
        uniform float uTime;
        uniform vec2 uResolution;
        varying vec2 vUv;

        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

        float snoise(vec3 v){
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);

            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - 1.0 + C.yyy + C.xxx;

            i = mod(i, 289.0);
            vec4 p = permute(permute(permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);

            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);

            vec4 s0 = floor(b0) * 2.0 + 1.0;
            vec4 s1 = floor(b1) * 2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);

            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        float terrain(vec2 p, float time) {
            vec2 pos = p + vec2(67.43, 28.19);
            float n = 0.0;
            n += snoise(vec3(pos * 0.70, time * 0.030 + 14.2)) * 0.52;
            n += snoise(vec3(pos * 1.48, time * 0.048 + 48.7)) * 0.32;
            n += snoise(vec3(pos * 2.95, time * 0.075 + 81.5)) * 0.16;
            return n;
        }

        float drawPoint(vec2 uv, vec2 pos, vec2 aspect, vec2 res, float pulse) {
            vec2 pointUv = pos / (aspect * 2.8) + 0.5;
            if (pointUv.x < 0.01 || pointUv.x > 0.99 || pointUv.y < 0.01 || pointUv.y > 0.99) {
                return 0.0;
            }
            vec2 diff = (uv - pointUv) * res;
            float distSq = dot(diff, diff);
            if (distSq > 9.0) {
                return 0.0;
            }
            float dist = sqrt(distSq);
            float circle = 1.0 - smoothstep(1.5, 2.5, dist);
            float alpha = smoothstep(0.08, 0.28, pulse);
            return circle * alpha;
        }

        void main() {
            vec2 aspect = vec2(uResolution.x / min(uResolution.x, uResolution.y),
                               uResolution.y / min(uResolution.x, uResolution.y));
            vec2 p = (vUv - 0.5) * aspect * 2.8;

            float t = uTime * 0.20;

            float elevation = terrain(p, t) * 0.45 + 0.45;

            vec2 pos1 = vec2(0.80, 0.55) + vec2(cos(t * 0.16 + 0.5), sin(t * 0.13)) * 0.15;
            float pulse1 = sin(t * 0.28) * 0.5 + 0.5;
            float dome1 = pulse1 * 0.50 * exp(-dot(p - pos1, p - pos1) * 2.3);

            vec2 pos2 = vec2(0.42, 0.30) + vec2(sin(t * 0.20 + 1.2), cos(t * 0.15)) * 0.16;
            float pulse2 = sin(t * 0.25 + 1.8) * 0.5 + 0.5;
            float dome2 = pulse2 * 0.46 * exp(-dot(p - pos2, p - pos2) * 2.5);

            vec2 pos3 = vec2(-0.85, 0.10) + vec2(cos(t * 0.14 + 2.4), sin(t * 0.18 + 0.7)) * 0.18;
            float pulse3 = sin(t * 0.22 + 3.1) * 0.5 + 0.5;
            float dome3 = pulse3 * 0.52 * exp(-dot(p - pos3, p - pos3) * 1.8);

            vec2 pos4 = vec2(-0.55, 0.75) + vec2(sin(t * 0.18 + 0.9), cos(t * 0.16 + 1.5)) * 0.14;
            float pulse4 = sin(t * 0.30 + 0.7) * 0.5 + 0.5;
            float dome4 = pulse4 * 0.44 * exp(-dot(p - pos4, p - pos4) * 2.7);

            vec2 pos5 = vec2(-0.70, -0.55) + vec2(cos(t * 0.17 + 3.8), sin(t * 0.21)) * 0.16;
            float pulse5 = sin(t * 0.26 + 4.0) * 0.5 + 0.5;
            float dome5 = pulse5 * 0.48 * exp(-dot(p - pos5, p - pos5) * 2.2);

            vec2 pos6 = vec2(0.75, -0.50) + vec2(sin(t * 0.15 + 2.1), cos(t * 0.19 + 2.7)) * 0.15;
            float pulse6 = sin(t * 0.32 + 2.5) * 0.5 + 0.5;
            float dome6 = pulse6 * 0.42 * exp(-dot(p - pos6, p - pos6) * 2.6);

            vec2 pos7 = vec2(0.05, 0.80) + vec2(cos(t * 0.19 + 1.7), sin(t * 0.15 + 3.2)) * 0.12;
            float pulse7 = sin(t * 0.24 + 1.2) * 0.5 + 0.5;
            float dome7 = pulse7 * 0.38 * exp(-dot(p - pos7, p - pos7) * 2.9);

            vec2 pos8 = vec2(-0.10, -0.35) + vec2(sin(t * 0.22 + 4.5), cos(t * 0.18 + 0.4)) * 0.14;
            float pulse8 = sin(t * 0.29 + 5.1) * 0.5 + 0.5;
            float dome8 = pulse8 * 0.40 * exp(-dot(p - pos8, p - pos8) * 2.8);

            float totalH = elevation + dome1 + dome2 + dome3 + dome4 + dome5 + dome6 + dome7 + dome8;

            float level = totalH * 16.0;
            float lineDist = abs(fract(level) - 0.5);

            #ifdef GL_OES_standard_derivatives
                float lineFilter = fwidth(level);
                float line1 = 1.0 - smoothstep(0.0, lineFilter * 1.35, lineDist);
            #else
                float line1 = 1.0 - smoothstep(0.0, 0.05, lineDist);
            #endif

            float indexLevel = level / 4.0;
            float indexDist = abs(fract(indexLevel) - 0.5);

            #ifdef GL_OES_standard_derivatives
                float indexFilter = fwidth(indexLevel);
                float line2 = 1.0 - smoothstep(0.0, indexFilter * 1.75, indexDist);
            #else
                float line2 = 1.0 - smoothstep(0.0, 0.04, indexDist);
            #endif

            float dots = 0.0;
            dots += drawPoint(vUv, pos1, aspect, uResolution, pulse1);
            dots += drawPoint(vUv, pos2, aspect, uResolution, pulse2);
            dots += drawPoint(vUv, pos3, aspect, uResolution, pulse3);
            dots += drawPoint(vUv, pos4, aspect, uResolution, pulse4);
            dots += drawPoint(vUv, pos5, aspect, uResolution, pulse5);
            dots += drawPoint(vUv, pos6, aspect, uResolution, pulse6);
            dots += drawPoint(vUv, pos7, aspect, uResolution, pulse7);
            dots += drawPoint(vUv, pos8, aspect, uResolution, pulse8);

            vec2 pos9 = vec2(1.25, 0.70) + vec2(cos(t * 0.13 + 1.0), sin(t * 0.16)) * 0.10;
            dots += drawPoint(vUv, pos9, aspect, uResolution, sin(t * 0.31 + 0.3) * 0.5 + 0.5);

            vec2 pos10 = vec2(1.30, 0.05) + vec2(sin(t * 0.15 + 2.5), cos(t * 0.12)) * 0.12;
            dots += drawPoint(vUv, pos10, aspect, uResolution, sin(t * 0.27 + 2.8) * 0.5 + 0.5);

            vec2 pos11 = vec2(1.15, -0.65) + vec2(cos(t * 0.17 + 4.1), sin(t * 0.14)) * 0.11;
            dots += drawPoint(vUv, pos11, aspect, uResolution, sin(t * 0.33 + 4.6) * 0.5 + 0.5);

            vec2 pos12 = vec2(0.18, -0.05) + vec2(sin(t * 0.21 + 0.8), cos(t * 0.17)) * 0.10;
            dots += drawPoint(vUv, pos12, aspect, uResolution, sin(t * 0.26 + 1.5) * 0.5 + 0.5);

            vec2 pos13 = vec2(-0.25, 0.70) + vec2(cos(t * 0.18 + 3.3), sin(t * 0.15)) * 0.09;
            dots += drawPoint(vUv, pos13, aspect, uResolution, sin(t * 0.28 + 3.7) * 0.5 + 0.5);

            vec2 pos14 = vec2(0.48, 0.85) + vec2(sin(t * 0.14 + 1.6), cos(t * 0.20)) * 0.11;
            dots += drawPoint(vUv, pos14, aspect, uResolution, sin(t * 0.35 + 0.9) * 0.5 + 0.5);

            vec2 pos15 = vec2(-1.15, 0.65) + vec2(cos(t * 0.16 + 5.0), sin(t * 0.19)) * 0.12;
            dots += drawPoint(vUv, pos15, aspect, uResolution, sin(t * 0.25 + 5.4) * 0.5 + 0.5);

            vec2 pos16 = vec2(-1.35, -0.15) + vec2(sin(t * 0.19 + 2.2), cos(t * 0.13)) * 0.10;
            dots += drawPoint(vUv, pos16, aspect, uResolution, sin(t * 0.30 + 2.0) * 0.5 + 0.5);

            vec2 pos17 = vec2(-1.10, -0.70) + vec2(cos(t * 0.15 + 0.6), sin(t * 0.17)) * 0.11;
            dots += drawPoint(vUv, pos17, aspect, uResolution, sin(t * 0.27 + 1.1) * 0.5 + 0.5);

            vec2 pos18 = vec2(-0.45, -0.75) + vec2(sin(t * 0.20 + 3.5), cos(t * 0.16)) * 0.10;
            dots += drawPoint(vUv, pos18, aspect, uResolution, sin(t * 0.34 + 3.9) * 0.5 + 0.5);

            vec2 pos19 = vec2(0.35, -0.65) + vec2(cos(t * 0.18 + 1.9), sin(t * 0.22)) * 0.11;
            dots += drawPoint(vUv, pos19, aspect, uResolution, sin(t * 0.26 + 2.3) * 0.5 + 0.5);

            vec2 pos20 = vec2(-0.15, 0.28) + vec2(sin(t * 0.17 + 4.7), cos(t * 0.14)) * 0.12;
            dots += drawPoint(vUv, pos20, aspect, uResolution, sin(t * 0.31 + 4.9) * 0.5 + 0.5);

            vec2 pos21 = vec2(0.95, 0.15) + vec2(cos(t * 0.21 + 2.8), sin(t * 0.18)) * 0.10;
            dots += drawPoint(vUv, pos21, aspect, uResolution, sin(t * 0.29 + 3.2) * 0.5 + 0.5);

            vec2 pos22 = vec2(-0.50, -0.10) + vec2(sin(t * 0.16 + 1.1), cos(t * 0.19)) * 0.11;
            dots += drawPoint(vUv, pos22, aspect, uResolution, sin(t * 0.24 + 1.6) * 0.5 + 0.5);

            float allDots = clamp(dots, 0.0, 1.0);

            vec3 bg = vec3(3.0 / 255.0, 3.0 / 255.0, 7.0 / 255.0);
            vec3 valley = vec3(0.012, 0.014, 0.028);
            vec3 ridge = vec3(0.018, 0.035, 0.065);
            vec3 relief = mix(valley, ridge, clamp(totalH * 0.7, 0.0, 1.0)) - bg;

            vec3 colLine1 = vec3(0.38, 0.52, 0.68) * 0.38;
            vec3 colLine2 = vec3(0.44, 0.32, 0.52);
            vec3 colDot = vec3(0.78, 0.90, 1.0);

            float vignette = smoothstep(2.5, 0.7, length(p * 0.55));

            vec3 color = bg + relief * vignette;
            color += colLine1 * (line1 * 0.65 * vignette);
            color = mix(color, colLine2, line2 * 0.75 * vignette);
            color = mix(color, colDot, allDots * 0.95 * vignette);

            float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            color += (dither - 0.5) * (1.2 / 255.0);

            gl_FragColor = vec4(color, 1.0);
        }
    `;

    function createShader(glCtx, type, source) {
        const shader = glCtx.createShader(type);
        glCtx.shaderSource(shader, source);
        glCtx.compileShader(shader);
        if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
            console.error(glCtx.getShaderInfoLog(shader));
            glCtx.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, "uTime");
    const uResLoc = gl.getUniformLocation(program, "uResolution");

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.floor(window.innerWidth * dpr);
        const h = Math.floor(window.innerHeight * dpr);
        if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(uResLoc, w, h);
        }
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();

    let startTime = performance.now();
    let isPaused = false;
    let animId;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function render(now) {
        if (isPaused || prefersReducedMotion.matches) return;
        const elapsed = (now - startTime) * 0.001;
        gl.uniform1f(uTimeLoc, elapsed);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        animId = requestAnimationFrame(render);
    }

    if (!prefersReducedMotion.matches) {
        animId = requestAnimationFrame(render);
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            isPaused = true;
            cancelAnimationFrame(animId);
        } else {
            isPaused = false;
            animId = requestAnimationFrame(render);
        }
    });
})();
