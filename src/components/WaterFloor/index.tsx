"use client";

import { useRef, useMemo, useEffect } from "react";
import { rippleStore } from "./rippleStore";
import { useFrame } from "@react-three/fiber";
import { useControls, folder } from "leva";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// WaterFloor — cel-shaded / anime water using Voronoi F1 − SmoothF1
//
// Replicates the Blender node graph:
//   TextureCoord → Mapping (Y offset) → Voronoi F1
//                                      → Voronoi SmoothF1
//   Subtract (F1 − SF1) → ColorRamp → color
//
// World-space XZ coordinates so the pattern is world-anchored (not UV-based).
// Plane follows the camera like GridFloor for an infinite-floor look.
// ─────────────────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos     = worldPos.xz;
    gl_Position   = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uSmoothness;
  uniform float uEdgeThreshold;
  uniform float uEdgeSoftness;
  uniform float uFlowX;
  uniform float uFlowZ;
  uniform float uCellSpeed;
  uniform float uNoiseScale;
  uniform float uNoiseFlowSpeed;
  uniform float uDistortAmount;
  uniform vec3  uDeepColor;
  uniform vec3  uMidColor;
  uniform float uMidPos;
  uniform vec3  uHighlight;
  uniform float uOpacity;
  uniform float uDeepOpacity;
  uniform float uFadeDistance;
  uniform float uFadeStrength;
  uniform vec2  uCamXZ;

  // ── Ripple uniforms ────────────────────────────────────────────────────────
  uniform vec2  uRippleCenters[8];
  uniform float uRippleTimes[8];
  uniform int   uRippleCount;
  uniform float uRippleSpeed;
  uniform float uRippleAtten;
  uniform float uRippleStrength;
  uniform float uRippleDecay;
  uniform float uRippleWaves;    // angular frequency for ring distortion
  uniform float uRippleNoise;    // distortion amplitude
  uniform int   uRippleRings;    // concentric rings per event
  uniform float uRippleSpacing;  // time offset between concentric rings

  varying vec2 vWorldPos;

  // ── Helpers ────────────────────────────────────────────────────────────────
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  // Polynomial smooth-min (k = blend radius)
  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k / 6.0;
  }

  // Animated cell position — shared between F1 and SmoothF1 so subtraction
  // produces correct cell-edge values (same random offsets in both passes).
  vec2 cellPt(vec2 seed) {
    return 0.5 + 0.5 * sin(uTime * uCellSpeed + 6.2831 * seed);
  }

  // Voronoi F1 — nearest-cell Euclidean distance
  float voronoiF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float md = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        md = min(md, length(n + pt - f));
      }
    return md;
  }

  // Voronoi SmoothF1 — smooth-min over all cell distances
  float voronoiSF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float res = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        res = smin(res, length(n + pt - f), uSmoothness);
      }
    return res;
  }
  // ── fBm noise (Blender: Noise Texture Scale=1.52, Detail=2, Roughness=0.5) ─
  float nHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(nHash(i),                  nHash(i + vec2(1.0, 0.0)), f.x),
      mix(nHash(i + vec2(0.0, 1.0)), nHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 2; i++) { v += a * vnoise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
  // ──────────────────────────────────────────────────────────────────────────

  void main() {
    // Noise distortion (Blender: Noise Texture → Mapping location offset)
    // Object X coord / 100 scroll → here: world XZ + time * noiseFlowSpeed
    vec2 noiseUV  = vWorldPos * uNoiseScale + vec2(uTime * uNoiseFlowSpeed, 0.0);
    float noiseFac = fbm(noiseUV);
    // noiseFac ∈ [0,1] → center at 0.5 → symmetric distortion offset
    vec2 distort   = vec2(noiseFac - 0.5) * uDistortAmount;

    // Voronoi UV: base flow + noise distortion
    vec2 uv = vWorldPos * uScale + vec2(uFlowX, uFlowZ) * uTime + distort;

    float f1   = voronoiF1(uv);
    float sf1  = voronoiSF1(uv);

    // F1 − SmoothF1: 0 at cell centers → positive at boundaries
    // Matches Blender "Subtract" node output → fed into ColorRamp
    float edge = f1 - sf1;

    // Cel-shaded ColorRamp: hard step at threshold (Blender pos = 0.067)
    float t = smoothstep(
      uEdgeThreshold - uEdgeSoftness,
      uEdgeThreshold + uEdgeSoftness,
      edge
    );
    // 3-stop ColorRamp: deepColor → midColor → highlight
    // Mirrors Blender's ColorRamp with stops at 0, uMidPos, and 1
    float safeMP = max(uMidPos, 1e-4);
    float seg0   = clamp(t / safeMP, 0.0, 1.0);
    float seg1   = clamp((t - safeMP) / max(1.0 - safeMP, 1e-4), 0.0, 1.0);
    float inSeg1 = step(safeMP, t);
    vec3 color   = mix(
      mix(uDeepColor, uMidColor, seg0),
      mix(uMidColor,  uHighlight, seg1),
      inSeg1
    );

    // ── Ripple rings — expanding gaussian ring per impact event ───────────────
    // Multiple concentric rings with angular distortion per impact event.
    float rippleAcc = 0.0;
    for (int i = 0; i < 8; i++) {
      float isOn    = step(float(i), float(uRippleCount) - 0.5);
      float elapsed = max(uTime - uRippleTimes[i], 0.0);

      // Distorted distance: add angular harmonics that fade as ring expands
      vec2  toFrag  = vWorldPos - uRippleCenters[i];
      float d       = length(toFrag);
      float angle   = atan(toFrag.y, toFrag.x);
      float distort = sin(angle * uRippleWaves) * 0.65
                    + sin(angle * uRippleWaves * 2.3 + elapsed * 2.0) * 0.35;
      float noisyD  = d + distort * uRippleNoise * exp(-elapsed * uRippleDecay * 0.35);

      // Inner loop: concentric rings offset in time
      for (int r = 0; r < 4; r++) {
        float rIsOn = step(float(r), float(uRippleRings) - 0.5);
        float rOff  = float(r) * uRippleSpacing;
        float re    = max(elapsed - rOff, 0.0);
        float ring  = exp(-pow(noisyD - re * uRippleSpeed, 2.0) * uRippleAtten);
        float rfade = exp(-re * uRippleDecay);
        rippleAcc  += ring * rfade * isOn * rIsOn;
      }
    }
    float ripple = clamp(rippleAcc * uRippleStrength, 0.0, 1.0);

    // Brighten toward highlight color at ring location
    color = mix(color, uHighlight, ripple);

    // Distance fade (mirrors GridFloor fade for visual consistency)
    float dist = length(vWorldPos - uCamXZ);
    float fade = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

    // Ripple also lifts alpha so rings are fully visible even in deep areas
    float alpha = mix(uDeepOpacity, 1.0, max(t, ripple)) * uOpacity * fade;
    gl_FragColor = vec4(color, alpha);
  }
`;

interface WaterFloorProps {
  deepOpacityOverride?: number;
}

export default function WaterFloor({ deepOpacityOverride }: WaterFloorProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const {
    waterScale,
    cellSmoothness,
    edgeThreshold,
    edgeSoftness,
    flowX,
    flowZ,
    cellSpeed,
    noiseScale,
    noiseFlowSpeed,
    distortAmount,
    deepColor,
    midColor,
    midPos,
    highlightColor,
    opacity,
    deepOpacity,
    fadeDistance,
    fadeStrength,
    rippleSpeed,
    rippleAtten,
    rippleStrength,
    rippleDecay,
    rippleWaves,
    rippleNoise,
    rippleRings,
    rippleSpacing,
  } = useControls(
    "Water Floor",
    {
      waterScale:     { value: 0.23,  min: 0.01, max: 1.5,  step: 0.01,  label: "Scale" },
      cellSmoothness: { value: 0.46,  min: 0,    max: 2,    step: 0.01,  label: "Cell Smoothness" },
      edgeThreshold:  { value: 0.09, min: 0,    max: 0.3,  step: 0.005, label: "Edge Threshold" },
      edgeSoftness:   { value: 0.10,  min: 0,    max: 0.1,  step: 0.005, label: "Edge Softness" },
      flowX:          { value: 0.07,     min: -0.5, max: 0.5,  step: 0.01,  label: "Flow X" },
      flowZ:          { value: -0.23,  min: -0.5, max: 0.5,  step: 0.01,  label: "Flow Z" },
      cellSpeed:      { value: 0.55,  min: 0,    max: 3,    step: 0.05,  label: "Cell Anim Speed" },
      noiseScale:     { value: 0.87,  min: 0.1,  max: 10,   step: 0.01,  label: "Noise Scale" },
      noiseFlowSpeed: { value: 0.11,  min: 0,    max: 2,    step: 0.01,  label: "Noise Flow Speed" },
      distortAmount:  { value: 0.26,  min: 0,    max: 3,    step: 0.01,  label: "Distort Amount" },
      deepColor:      { value: "#27a3d8",  label: "Deep Color" },
      midColor:       { value: "#59c0e8",  label: "Mid Color" },
      midPos:         { value: 0.31, min: 0.001, max: 0.999, step: 0.001, label: "Mid Pos" },
      highlightColor: { value: "#ffffff",  label: "Highlight Color" },
      opacity:        { value: 1.0,   min: 0,    max: 1,    step: 0.01,  label: "Opacity" },
      deepOpacity:    { value: 0.37,  min: 0,    max: 1,    step: 0.01,  label: "Deep Opacity" },
      fadeDistance:   { value: 275,    min: 10,   max: 300,  step: 5,     label: "Fade Distance" },
      fadeStrength:   { value: 1.3,   min: 0.1,  max: 5,    step: 0.1,   label: "Fade Strength" },
      Ripples: folder({
        rippleSpeed:    { value: 1.5,  min: 0.1,  max: 20,   step: 0.1,  label: "Ring Speed" },
        rippleAtten:    { value: 60, min: 0.1,  max: 60,   step: 0.1,  label: "Ring Width" },
        rippleStrength: { value: 5.5,  min: 0,    max: 8,    step: 0.1,  label: "Strength" },
        rippleDecay:    { value: 1.60,  min: 0.05, max: 5,    step: 0.05, label: "Decay Speed" },
        rippleRings:    { value: 2,    min: 1,    max: 4,    step: 1,    label: "Ring Count" },
        rippleSpacing:  { value: 1.03, min: 0.05, max: 2,    step: 0.05, label: "Ring Spacing" },
        rippleWaves:    { value: 5,    min: 1,    max: 20,   step: 1,    label: "Wave Freq" },
        rippleNoise:    { value: 0.05, min: 0,    max: 2,    step: 0.05, label: "Distortion" },
      }, { collapsed: false }),
    },
    { collapsed: true }
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite:  false,
        side:        THREE.FrontSide,
        vertexShader:   VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime:          { value: 0 },
          uScale:         { value: 0.30 },
          uSmoothness:    { value: 0.55 },
          uEdgeThreshold: { value: 0.067 },
          uEdgeSoftness:  { value: 0.01 },
          uFlowX:         { value: 0 },
          uFlowZ:         { value: 0.05 },
          uCellSpeed:       { value: 0.30 },
          uNoiseScale:      { value: 1.52 },
          uNoiseFlowSpeed:  { value: 0.20 },
          uDistortAmount:   { value: 0.30 },
          uDeepColor:       { value: new THREE.Color("#1a3a5c") },
          uMidColor:        { value: new THREE.Color("#59c0e8") },
          uMidPos:          { value: 0.084 },
          uHighlight:       { value: new THREE.Color("#ffffff") },
          uOpacity:       { value: 1.0 },
          uDeepOpacity:   { value: 0.45 },
          uFadeDistance:    { value: 90.0 },
          uFadeStrength:    { value: 1.4 },
          uCamXZ:           { value: new THREE.Vector2() },
          // ripple uniforms — count=0 means all slots inactive
          uRippleCenters:   { value: Array.from({ length: 8 }, () => new THREE.Vector2()) },
          uRippleTimes:     { value: new Array(8).fill(0) },
          uRippleCount:     { value: 0 },
          uRippleSpeed:     { value: 3.8 },
          uRippleAtten:     { value: 26.8 },
          uRippleStrength:  { value: 4.0 },
          uRippleDecay:     { value: 5.0 },
          uRippleWaves:     { value: 5.0 },
          uRippleNoise:     { value: 0.35 },
          uRippleRings:     { value: 3 },
          uRippleSpacing:   { value: 0.28 },
        },
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock }) => {
    const u = material.uniforms;
    // Use absolute clock time so ripple startTimes (from same clock) are comparable
    u.uTime.value           = clock.getElapsedTime();
    u.uScale.value          = waterScale;
    u.uSmoothness.value     = cellSmoothness;
    u.uEdgeThreshold.value  = edgeThreshold;
    u.uEdgeSoftness.value   = edgeSoftness;
    u.uFlowX.value          = flowX;
    u.uFlowZ.value          = flowZ;
    u.uCellSpeed.value        = cellSpeed;
    u.uNoiseScale.value       = noiseScale;
    u.uNoiseFlowSpeed.value   = noiseFlowSpeed;
    u.uDistortAmount.value    = distortAmount;
    u.uDeepColor.value.set(deepColor);
    u.uMidColor.value.set(midColor);
    u.uMidPos.value = midPos;
    u.uHighlight.value.set(highlightColor);
    u.uOpacity.value        = opacity;
    u.uDeepOpacity.value    = deepOpacityOverride ?? deepOpacity;
    u.uFadeDistance.value   = fadeDistance;
    u.uFadeStrength.value   = fadeStrength;
    u.uCamXZ.value.set(camera.position.x, camera.position.z);

    // ── Ripple sync ──────────────────────────────────────────────────────────
    u.uRippleSpeed.value    = rippleSpeed;
    u.uRippleAtten.value    = rippleAtten;
    u.uRippleStrength.value = rippleStrength;
    u.uRippleDecay.value    = rippleDecay;
    u.uRippleWaves.value    = rippleWaves;
    u.uRippleNoise.value    = rippleNoise;
    u.uRippleRings.value    = rippleRings;
    u.uRippleSpacing.value  = rippleSpacing;
    const ripples = rippleStore.get();
    u.uRippleCount.value    = ripples.length;
    for (let i = 0; i < ripples.length; i++) {
      u.uRippleCenters.value[i].set(ripples[i].x, ripples[i].z);
      u.uRippleTimes.value[i] = ripples[i].t;
    }

    // Follow camera in XZ → infinite tiling (same pattern as GridFloor)
    meshRef.current.position.x = camera.position.x;
    meshRef.current.position.z = camera.position.z;
  });

  return (
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      position={[0, -0.1, 0]}
      frustumCulled={false}
      renderOrder={2}
    >
      <planeGeometry args={[600, 600]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
