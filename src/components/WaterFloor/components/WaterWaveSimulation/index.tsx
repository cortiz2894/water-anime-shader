"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useControls, folder } from "leva";
import * as THREE from "three";
import { dragonBallsStore } from "../../dragonBallsStore";

// ─────────────────────────────────────────────────────────────────────────────
// WaterWaveSimulation — Part 2 of the Dynamic-Paint–style wave system.
//
// THREE render passes per frame:
//
//  1. INJECTION PASS
//     Top-down orthographic render of the DragonBalls geometry into a
//     WAVE_RES × WAVE_RES texture.  The fragment shader clips to a thin
//     band around waterY so only geometry actually crossing the water surface
//     writes into the texture.  This gives the exact intersection shape in
//     the simulation's UV space.
//
//  2. WAVE UPDATE PASS  (ping-pong)
//     A fullscreen quad runs the 2-D wave equation each frame:
//       h_next = 2·h_cur − h_prev + speed · ∇²h
//     Both h_cur and h_prev are packed into the RG channels of a single
//     HalfFloat texture so only 2 render targets are needed.
//     The injection texture adds energy where the mesh crosses the water.
//     Absorbing boundaries prevent edge reflections.
//
//  3. DISPLAY PASS
//     A large plane at the water surface maps world XZ → simulation UV and
//     computes the gradient magnitude of the wave height map.  High gradient
//     = ring edge → rendered as a bright additive overlay.
// ─────────────────────────────────────────────────────────────────────────────

const WAVE_RES = 512;
const TEXEL    = 1.0 / WAVE_RES;

// ── 1. Injection shaders ──────────────────────────────────────────────────────
const INJ_VERT = /* glsl */ `
  varying float vWorldY;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldY  = wp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const INJ_FRAG = /* glsl */ `
  uniform float uWaterY;
  uniform float uBandWidth;
  varying float vWorldY;
  void main() {
    float d = abs(vWorldY - uWaterY);
    if (d > uBandWidth) discard;
    float s = 1.0 - smoothstep(0.0, uBandWidth, d);
    gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
  }
`;

// ── 2. Wave update shaders ────────────────────────────────────────────────────
// Texel layout:  R = h(t),  G = h(t-1)
// uInjectAmp  — height value forced at the injection point (wave peak amplitude)
// uBorderWidth — fraction [0,1] of the texture used as absorbing boundary zone
const WAVE_VERT = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const WAVE_FRAG = /* glsl */ `
  uniform sampler2D uWaveTex;
  uniform sampler2D uInjection;
  uniform float     uTexelSize;
  uniform float     uResolution;
  uniform float     uSpeed;
  uniform float     uDamping;
  uniform float     uInjectStr;
  uniform float     uInjectAmp;
  uniform float     uBorderWidth;

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;

    float cur  = texture2D(uWaveTex, uv).r;
    float prev = texture2D(uWaveTex, uv).g;

    // Discrete Laplacian
    float left  = texture2D(uWaveTex, uv + vec2(-uTexelSize, 0.0)).r;
    float right = texture2D(uWaveTex, uv + vec2( uTexelSize, 0.0)).r;
    float up    = texture2D(uWaveTex, uv + vec2(0.0,  uTexelSize)).r;
    float down  = texture2D(uWaveTex, uv + vec2(0.0, -uTexelSize)).r;

    float laplacian = left + right + up + down - 4.0 * cur;

    // 2nd-order wave equation
    float next = 2.0 * cur - prev + uSpeed * laplacian;
    next *= uDamping;

    // Absorbing boundary — width controlled via uBorderWidth (0.01–0.2)
    float edge   = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float border = smoothstep(0.0, uBorderWidth, edge);
    next *= border;

    // Inject energy at the waterline intersection
    float inject = texture2D(uInjection, uv).r;
    next = mix(next, uInjectAmp, inject * uInjectStr);

    next = clamp(next, -1.0, 1.0);

    gl_FragColor = vec4(next, cur, 0.0, 1.0);
  }
`;

// ── 3. Display shaders ────────────────────────────────────────────────────────
// uRingThreshold — gradient magnitude at which a ring edge appears (tune visibility)
// uEdgeSharpness — 0=soft/realistic, 1=hard step (anime)
const DISP_VERT = /* glsl */ `
  varying vec2 vWorldXZ;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldXZ    = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const DISP_FRAG = /* glsl */ `
  uniform sampler2D uWaveTex;
  uniform vec2  uCenter;
  uniform float uWaveSize;
  uniform float uTexelSize;
  uniform float uGradScale;
  uniform float uRingThreshold;
  uniform float uEdgeSharpness;
  uniform vec3  uColor;
  uniform float uOpacity;

  varying vec2 vWorldXZ;

  void main() {
    float u =  (vWorldXZ.x - uCenter.x) / (uWaveSize * 2.0) + 0.5;
    float v = -(vWorldXZ.y - uCenter.y) / (uWaveSize * 2.0) + 0.5;
    vec2 uv = vec2(u, v);

    if (any(lessThan(uv, vec2(0.01))) || any(greaterThan(uv, vec2(0.99)))) discard;

    // Gradient magnitude
    float dx = texture2D(uWaveTex, uv + vec2( uTexelSize, 0.0)).r
             - texture2D(uWaveTex, uv - vec2( uTexelSize, 0.0)).r;
    float dy = texture2D(uWaveTex, uv + vec2(0.0,  uTexelSize)).r
             - texture2D(uWaveTex, uv - vec2(0.0,  uTexelSize)).r;
    float grad = length(vec2(dx, dy)) * uGradScale;

    // Threshold + sharpness: uRingThreshold shifts what gradient counts as a ring
    // uEdgeSharpness narrows the smoothstep window (1 = near hard step)
    float halfEdge = mix(0.35, 0.01, uEdgeSharpness);
    float ring     = smoothstep(uRingThreshold - halfEdge, uRingThreshold + halfEdge, grad);

    if (ring < 0.01) discard;
    gl_FragColor = vec4(uColor, ring * uOpacity);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────

export default function WaterWaveSimulation() {
  const { gl } = useThree();
  const { nodes } = useGLTF("/assets/dragon-balls-model.glb") as {
    nodes: Record<string, THREE.Mesh>;
  };
  const displayRef      = useRef<THREE.Mesh>(null!);
  const pingIdx         = useRef(0);
  const needsInit       = useRef(true);
  const lastInjectTime  = useRef(-Infinity);

  // ── Leva controls ──────────────────────────────────────────────────────────
  const {
    enabled,
    speed, damping, borderWidth,
    injectStr, injectAmp, injectInterval, bandWidth,
    gradScale, ringThreshold, edgeSharpness, waveSizeMul, color, opacity,
  } = useControls("Wave Simulation", {
    enabled: { value: true, label: "Enabled" },

    Propagation: folder({
      speed:       { value: 0.08,  min: 0.005,  max: 0.49,   step: 0.001,  label: "Wave Speed" },
      damping:     { value: 0.993, min: 0.90,   max: 0.9999, step: 0.0001, label: "Damping" },
      borderWidth: { value: 0.06,  min: 0.01,   max: 0.25,   step: 0.005,  label: "Border Absorption" },
    }, { collapsed: false }),

    Injection: folder({
      injectStr:      { value: 0.21, min: 0.0, max: 1.0, step: 0.01, label: "Strength" },
      injectAmp:      { value: 1,  min: 0.1, max: 1.0, step: 0.01, label: "Amplitude" },
      injectInterval: { value: 0.8,  min: 0.1, max: 5.0, step: 0.1,  label: "Interval (s)" },
      bandWidth:      { value: 5.0,  min: 0.1, max: 5.0, step: 0.1,  label: "Band Width (world)" },
    }, { collapsed: false }),

    Display: folder({
      gradScale:      { value: 1.0, min: 0.5,  max: 60.0, step: 0.5,  label: "Grad Scale" },
      ringThreshold:  { value: 0.54, min: 0.05, max: 1.0,  step: 0.01, label: "Ring Threshold" },
      edgeSharpness:  { value: 0.91, min: 0.0,  max: 1.0,  step: 0.01, label: "Edge Sharpness (1=anime)" },
      waveSizeMul:    { value: 2.7, min: 1.0,  max: 10.0, step: 0.1,  label: "Region Size (× scale)" },
      color:          { value: "#ffffff", label: "Color" },
      opacity:        { value: 0.75, min: 0.0, max: 1.0, step: 0.01, label: "Opacity" },
    }, { collapsed: false }),
  }, { collapsed: true });

  // ── Injection RT ───────────────────────────────────────────────────────────
  const injRT = useMemo(() => new THREE.WebGLRenderTarget(WAVE_RES, WAVE_RES, {
    format:    THREE.RGBAFormat,
    type:      THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  }), []);

  // ── Injection ortho camera (top-down, up = world -Z) ──────────────────────
  const injCamera = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    cam.up.set(0, 0, -1);
    return cam;
  }, []);

  // ── Injection material + scene ─────────────────────────────────────────────
  const injMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   INJ_VERT,
    fragmentShader: INJ_FRAG,
    side:           THREE.DoubleSide,
    uniforms: {
      uWaterY:    { value: -0.1 },
      uBandWidth: { value: 1.0 },
    },
  }), []);

  const { injScene, injGroup } = useMemo(() => {
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(nodes.Object_0.geometry,   injMat),
      new THREE.Mesh(nodes.Object_0_2.geometry, injMat),
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.add(group);
    return { injScene: scene, injGroup: group };
  }, [nodes, injMat]);

  // ── Ping-pong wave RTs ─────────────────────────────────────────────────────
  const waveRTs = useMemo(() => [
    new THREE.WebGLRenderTarget(WAVE_RES, WAVE_RES, {
      format:    THREE.RGBAFormat,
      type:      THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    }),
    new THREE.WebGLRenderTarget(WAVE_RES, WAVE_RES, {
      format:    THREE.RGBAFormat,
      type:      THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    }),
  ], []);

  // ── Wave update material ───────────────────────────────────────────────────
  const waveUpdateMat = useMemo(() => new THREE.ShaderMaterial({
    depthTest:      false,
    depthWrite:     false,
    vertexShader:   WAVE_VERT,
    fragmentShader: WAVE_FRAG,
    uniforms: {
      uWaveTex:     { value: null },
      uInjection:   { value: null },
      uTexelSize:   { value: TEXEL },
      uResolution:  { value: WAVE_RES },
      uSpeed:       { value: 0.04 },
      uDamping:     { value: 0.993 },
      uInjectStr:   { value: 0.25 },
      uInjectAmp:   { value: 0.7 },
      uBorderWidth: { value: 0.06 },
    },
  }), []);

  const { waveScene, waveCamera } = useMemo(() => {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), waveUpdateMat));
    return { waveScene: scene, waveCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [waveUpdateMat]);

  // ── Display material ───────────────────────────────────────────────────────
  const displayMat = useMemo(() => new THREE.ShaderMaterial({
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
    vertexShader:   DISP_VERT,
    fragmentShader: DISP_FRAG,
    uniforms: {
      uWaveTex:       { value: null },
      uCenter:        { value: new THREE.Vector2() },
      uWaveSize:      { value: 20 },
      uTexelSize:     { value: TEXEL },
      uGradScale:     { value: 1.0 },
      uRingThreshold: { value: 0.4 },
      uEdgeSharpness: { value: 1.0 },
      uColor:         { value: new THREE.Color("#ffffff") },
      uOpacity:       { value: 0.8 },
    },
  }), []);

  useEffect(() => () => {
    injRT.dispose();
    waveRTs.forEach(rt => rt.dispose());
    injMat.dispose();
    waveUpdateMat.dispose();
    displayMat.dispose();
  }, [injRT, waveRTs, injMat, waveUpdateMat, displayMat]);

  // ── Per-frame ──────────────────────────────────────────────────────────────
  useFrame(({ gl, camera, clock }) => {
    const store    = dragonBallsStore;
    const waveSize = store.scale * waveSizeMul;
    const elapsed  = clock.getElapsedTime();

    const prevRT = gl.getRenderTarget();
    const prevAC = gl.autoClear;
    gl.autoClear = true;

    // ── 0. One-time init ────────────────────────────────────────────────────
    if (needsInit.current) {
      const prevCC = gl.getClearColor(new THREE.Color());
      const prevCA = gl.getClearAlpha();
      gl.setClearColor(0, 0, 0, 0);
      waveRTs.forEach(rt => { gl.setRenderTarget(rt); gl.clear(true, false, false); });
      gl.setClearColor(prevCC, prevCA);
      needsInit.current = false;
    }

    if (enabled) {
      // ── 1. INJECTION — pulsed ───────────────────────────────────────────
      const shouldInject = (elapsed - lastInjectTime.current) >= injectInterval;
      if (shouldInject) {
        injGroup.position.set(store.posX, store.posY, store.posZ);
        injGroup.rotation.set(0, store.rotY, 0);
        injGroup.scale.setScalar(store.scale);
        injMat.uniforms.uBandWidth.value = bandWidth;

        injCamera.left   = -waveSize;
        injCamera.right  =  waveSize;
        injCamera.top    =  waveSize;
        injCamera.bottom = -waveSize;
        injCamera.updateProjectionMatrix();
        injCamera.position.set(store.posX, 100, store.posZ);
        injCamera.lookAt(store.posX, 0, store.posZ);

        gl.setRenderTarget(injRT);
        gl.render(injScene, injCamera);
        lastInjectTime.current = elapsed;
      }

      // ── 2. WAVE UPDATE ─────────────────────────────────────────────────
      const readRT  = waveRTs[pingIdx.current];
      const writeRT = waveRTs[1 - pingIdx.current];

      waveUpdateMat.uniforms.uWaveTex.value     = readRT.texture;
      waveUpdateMat.uniforms.uInjection.value   = injRT.texture;
      waveUpdateMat.uniforms.uSpeed.value       = speed;
      waveUpdateMat.uniforms.uDamping.value     = damping;
      waveUpdateMat.uniforms.uBorderWidth.value = borderWidth;
      waveUpdateMat.uniforms.uInjectAmp.value   = injectAmp;
      waveUpdateMat.uniforms.uInjectStr.value   = shouldInject ? injectStr : 0.0;

      gl.setRenderTarget(writeRT);
      gl.render(waveScene, waveCamera);

      pingIdx.current = 1 - pingIdx.current;
    }

    gl.setRenderTarget(prevRT);
    gl.autoClear = prevAC;

    // ── 3. Display uniforms ────────────────────────────────────────────────
    const u = displayMat.uniforms;
    u.uWaveTex.value        = waveRTs[pingIdx.current].texture;
    u.uCenter.value.set(store.posX, store.posZ);
    u.uWaveSize.value       = waveSize;
    u.uGradScale.value      = gradScale;
    u.uRingThreshold.value  = ringThreshold;
    u.uEdgeSharpness.value  = edgeSharpness;
    u.uColor.value.set(color);
    u.uOpacity.value        = opacity;

    if (displayRef.current) {
      displayRef.current.position.x = camera.position.x;
      displayRef.current.position.z = camera.position.z;
    }
  });

  return (
    <mesh
      ref={displayRef}
      visible={enabled}
      rotation-x={-Math.PI / 2}
      position={[0, -0.092, 0]}
      renderOrder={6}
      frustumCulled={false}
    >
      <planeGeometry args={[600, 600]} />
      <primitive object={displayMat} attach="material" />
    </mesh>
  );
}

useGLTF.preload("/assets/dragon-balls-model.glb");
