"use client";

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Domain-warped fBm smoke. One full-screen pass -> no layer seams, and the
// warping turns the noise into continuous wisps instead of blob "spots".
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++){
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0) * 3.0;

  float t = u_time * 0.05;

  // two stages of domain warping -> drifting, billowing smoke
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + 0.10 * t),
    fbm(p + vec2(5.2, 1.3) - 0.08 * t)
  );
  vec2 r = vec2(
    fbm(p + 1.3 * q + vec2(1.7, 9.2) + 0.15 * t),
    fbm(p + 1.3 * q + vec2(8.3, 2.8) + 0.126 * t)
  );
  float f = fbm(p + 1.6 * r);

  // shape into smoke; push contrast so wisps separate from deep black
  float smoke = clamp(f * 1.25 - 0.18, 0.0, 1.0);
  smoke = pow(smoke, 2.3);
  float wisp = clamp(length(r) * 0.5, 0.0, 1.0);

  vec3 col = vec3(0.0);
  col += vec3(0.60) * smoke;
  col += vec3(0.95) * wisp * smoke * 0.5;

  // overall intensity — clearly black dominant, smoke still reads
  col *= 0.5;

  // vignette so the frame melts into pure black (no visible edges)
  float vig = smoothstep(1.15, 0.22, length(uv - 0.5));
  col *= vig;

  // keep the very center calmer for headline legibility
  float clear = smoothstep(0.0, 0.42, length(uv - vec2(0.5, 0.46)));
  col *= mix(0.55, 1.0, clear);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function Smoke() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext("webgl", {
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null) ??
      (canvas.getContext(
        "experimental-webgl",
      ) as WebGLRenderingContext | null);

    if (!gl) {
      // Graceful fallback: a faint static radial so it isn't flat black.
      canvas.style.background =
        "radial-gradient(120% 90% at 50% 45%, #161616 0%, #0a0a0a 45%, #000 80%)";
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // full-screen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");

    // Render below native res; smoke is soft so upscaling is invisible.
    const SCALE = 0.6;

    function resize() {
      if (!canvas) return;
      const w = Math.max(1, Math.floor(window.innerWidth * SCALE));
      const h = Math.max(1, Math.floor(window.innerHeight * SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl!.viewport(0, 0, w, h);
      gl!.uniform2f(uRes, w, h);
    }
    resize();
    window.addEventListener("resize", resize);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const start = performance.now();
    let raf = 0;
    let running = true;

    function frame(now: number) {
      if (!running) return;
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }

    if (reduce) {
      // one static frame
      gl.uniform1f(uTime, 12.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, []);

  return (
    <div className="smoke-bg" aria-hidden>
      <canvas ref={canvasRef} className="smoke-canvas" />
    </div>
  );
}
