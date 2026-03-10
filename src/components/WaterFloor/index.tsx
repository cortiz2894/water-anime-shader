"use client";

import { useRef, useMemo, useEffect } from "react";
import { rippleStore } from "./stores/rippleStore";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VERT } from "./shaders/vertex";
import { FRAG } from "./shaders/fragment";
import { useWaterFloorControls } from "./utils/controls";

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
  } = useWaterFloorControls();

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
          // ripple uniforms — visual config comes from rippleStore (set by useWaterRipple)
          uRippleCenters:  { value: Array.from({ length: 8 }, () => new THREE.Vector2()) },
          uRippleTimes:    { value: new Array(8).fill(0) },
          uRippleCount:    { value: 0 },
          uRippleSpeed:    { value: 1.5 },
          uRippleWidth:    { value: 0.12 },
          uRippleStrength: { value: 5.5 },
          uRippleDecay:    { value: 1.6 },
          uRippleRings:    { value: 2 },
          uRippleSpacing:  { value: 1.0 },
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

    // ── Ripple sync — visual config comes from rippleStore (set by useWaterRipple) ──
    const cfg = rippleStore.getConfig();
    u.uRippleSpeed.value    = cfg.speed;
    u.uRippleWidth.value    = cfg.width;
    u.uRippleStrength.value = cfg.strength;
    u.uRippleDecay.value    = cfg.decay;
    u.uRippleRings.value    = cfg.rings;
    u.uRippleSpacing.value  = cfg.spacing;
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
