"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { waterObjectsRegistry } from "../../stores/waterObjectsRegistry";
import { INJ_VERT, INJ_FRAG } from "./shaders/injection";
import { WAVE_VERT, WAVE_FRAG } from "./shaders/wave";
import { DISP_VERT, DISP_FRAG } from "./shaders/display";
import { useWaveSimulationControls } from "./utils/controls";

// ─────────────────────────────────────────────────────────────────────────────
// WaterWaveSimulation — Part 2 of the Dynamic-Paint–style wave system.
//
// THREE render passes per frame:
//
//  1. INJECTION PASS
//     Top-down orthographic render of registered geometry into a
//     WAVE_RES × WAVE_RES texture. Only geometry crossing the water surface
//     writes into the texture, giving the exact intersection shape.
//
//  2. WAVE UPDATE PASS  (ping-pong)
//     A fullscreen quad runs the 2-D wave equation each frame:
//       h_next = 2·h_cur − h_prev + speed · ∇²h
//     Absorbing boundaries prevent edge reflections.
//
//  3. DISPLAY PASS
//     A large plane at the water surface maps world XZ → simulation UV and
//     computes the gradient magnitude of the wave height map.
//     High gradient = ring edge → rendered as a bright additive overlay.
//
// HOW TO ADD A MODEL
//   Call useWaterObject(id, ref, geometries) in your model component.
//   This component will pick it up automatically — no changes needed here.
// ─────────────────────────────────────────────────────────────────────────────

const WAVE_RES = 512;
const TEXEL    = 1.0 / WAVE_RES;

export default function WaterWaveSimulation() {
  const { gl } = useThree();
  const displayRef      = useRef<THREE.Mesh>(null!);
  const pingIdx         = useRef(0);
  const needsInit       = useRef(true);
  const lastInjectTime  = useRef(-Infinity);
  // Fixed-timestep accumulator — wave PDE runs at 60 Hz regardless of monitor
  const timeAccum       = useRef(0);
  const FIXED_STEP      = 1 / 60;

  const {
    enabled,
    speed, damping, borderWidth,
    injectStr, injectAmp, injectInterval, bandWidth,
    gradScale, ringThreshold, edgeSharpness, waveSizeMul, color, opacity,
  } = useWaveSimulationControls();

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

  // ── Injection material ─────────────────────────────────────────────────────
  const injMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   INJ_VERT,
    fragmentShader: INJ_FRAG,
    side:           THREE.DoubleSide,
    uniforms: {
      uWaterY:    { value: -0.1 },
      uBandWidth: { value: 1.0 },
    },
  }), []);

  // ── Injection scene — populated dynamically from waterObjectsRegistry ──────
  const injScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    return scene;
  }, []);
  const injGroups = useRef(new Map<string, THREE.Group>());

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
  useFrame(({ gl, camera, clock }, delta) => {
    const elapsed = clock.getElapsedTime();

    // ── Sync injection scene from registry ───────────────────────────────────
    const objects = waterObjectsRegistry.getAll();

    for (const obj of objects) {
      if (!obj.ref.current) continue;
      if (!injGroups.current.has(obj.id)) {
        const group = new THREE.Group();
        obj.geometries.forEach(geo => group.add(new THREE.Mesh(geo, injMat)));
        injScene.add(group);
        injGroups.current.set(obj.id, group);
      }
      const group = injGroups.current.get(obj.id)!;
      group.position.copy(obj.ref.current.position);
      group.rotation.copy(obj.ref.current.rotation);
      group.scale.copy(obj.ref.current.scale);
    }

    // Remove groups for unregistered objects
    for (const [id, group] of injGroups.current) {
      if (!objects.find(o => o.id === id)) {
        injScene.remove(group);
        injGroups.current.delete(id);
      }
    }

    // ── Compute centroid + wave region from all active objects ───────────────
    const active = objects.filter(o => o.ref.current);
    let cx = 0, cz = 0, maxScale = 5;
    if (active.length > 0) {
      cx       = active.reduce((s, o) => s + o.ref.current!.position.x, 0) / active.length;
      cz       = active.reduce((s, o) => s + o.ref.current!.position.z, 0) / active.length;
      maxScale = Math.max(...active.map(o => o.ref.current!.scale.x));
    }
    const waveSize = maxScale * waveSizeMul;

    const prevRT = gl.getRenderTarget();
    const prevAC = gl.autoClear;
    gl.autoClear = true;

    // ── 0. One-time init ────────────────────────────────────────────────────
    if (needsInit.current) {
      const prevCC = gl.getClearColor(new THREE.Color());
      const prevCA = gl.getClearAlpha();
      gl.setClearColor(0x000000, 0);
      waveRTs.forEach(rt => { gl.setRenderTarget(rt); gl.clear(true, false, false); });
      gl.setClearColor(prevCC, prevCA);
      needsInit.current = false;
    }

    if (enabled) {
      timeAccum.current += delta;
      const shouldStep = timeAccum.current >= FIXED_STEP;
      if (shouldStep) timeAccum.current -= FIXED_STEP;

      // ── 1. INJECTION ──────────────────────────────────────────────────────
      const shouldInject = shouldStep && (elapsed - lastInjectTime.current) >= injectInterval;
      if (shouldInject) {
        injMat.uniforms.uBandWidth.value = bandWidth;

        injCamera.left   = -waveSize;
        injCamera.right  =  waveSize;
        injCamera.top    =  waveSize;
        injCamera.bottom = -waveSize;
        injCamera.updateProjectionMatrix();
        injCamera.position.set(cx, 100, cz);
        injCamera.lookAt(cx, 0, cz);

        gl.setRenderTarget(injRT);
        gl.render(injScene, injCamera);
        lastInjectTime.current = elapsed;
      }

      // ── 2. WAVE UPDATE ────────────────────────────────────────────────────
      if (shouldStep) {
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
    }

    gl.setRenderTarget(prevRT);
    gl.autoClear = prevAC;

    // ── 3. Display uniforms ───────────────────────────────────────────────
    const u = displayMat.uniforms;
    u.uWaveTex.value        = waveRTs[pingIdx.current].texture;
    u.uCenter.value.set(cx, cz);
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
