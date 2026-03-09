"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// SeabedFloor — animated Voronoi seabed visible through the transparent
// deep-color areas of WaterFloor. Slower than the surface → parallax depth.
//
// renderOrder = 0  (before WaterFloor at renderOrder = 1)
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
  uniform float uCellSpeed;
  uniform float uFlowX;
  uniform float uFlowZ;
  uniform float uEdgeThreshold;
  uniform float uEdgeSoftness;
  uniform vec3  uDeepColor;
  uniform vec3  uHighlight;
  uniform float uFadeDistance;
  uniform float uFadeStrength;
  uniform vec2  uCamXZ;

  varying vec2 vWorldPos;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k / 6.0;
  }

  // Animated cell position — same seed gives same random, time adds slow pulse
  vec2 cellPt(vec2 seed) {
    return 0.5 + 0.5 * sin(uTime * uCellSpeed + 6.2831 * seed);
  }

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

  float voronoiSF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float res = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        res = smin(res, length(n + pt - f), 0.4);
      }
    return res;
  }

  void main() {
    // UV flow: parallax shift relative to water surface
    vec2  uv   = vWorldPos * uScale + vec2(uFlowX, uFlowZ) * uTime;
    float f1   = voronoiF1(uv);
    float sf1  = voronoiSF1(uv);
    float edge = f1 - sf1;

    float t     = smoothstep(uEdgeThreshold - uEdgeSoftness,
                             uEdgeThreshold + uEdgeSoftness, edge);
    vec3  color = mix(uDeepColor, uHighlight, t);

    float dist  = length(vWorldPos - uCamXZ);
    float fade  = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

    gl_FragColor = vec4(color, fade);
  }
`;

interface SeabedFloorProps {
  colorOverride?: string;
  colorTopOverride?: string;
  fadeDistanceOverride?: number;
  fadeStrengthOverride?: number;
}

export default function SeabedFloor({
  colorOverride,
  colorTopOverride,
  fadeDistanceOverride,
  fadeStrengthOverride,
}: SeabedFloorProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const {
    seabedDepth,
    seabedScale,
    cellSpeed,
    flowX,
    flowZ,
    edgeThreshold,
    edgeSoftness,
    deepColor,
    highlightColor,
    fadeDistance,
    fadeStrength,
  } = useControls(
    "Seabed",
    {
      seabedDepth:    { value: -1.6,  min: -10,  max: -0.5, step: 0.1,   label: "Depth Y" },
      seabedScale:    { value: 0.16,   min: 0.01, max: 1.0,  step: 0.01,  label: "Scale" },
      cellSpeed:      { value: 0.49,  min: 0,    max: 2,    step: 0.01,  label: "Cell Speed" },
      flowX:          { value: 0.0, min: -0.5, max: 0.5,  step: 0.005, label: "Flow X" },
      flowZ:          { value: -0.11, min: -0.5, max: 0.5,  step: 0.005, label: "Flow Z" },
      edgeThreshold:  { value: 0.06,  min: 0,    max: 0.3,  step: 0.005, label: "Edge Threshold" },
      edgeSoftness:   { value: 0.03,  min: 0,    max: 0.1,  step: 0.005, label: "Edge Softness" },
      deepColor:      { value: "#1aaae8",                                  label: "Deep Color" },
      highlightColor: { value: "#177096",                                  label: "Highlight Color" },
      fadeDistance:   { value: 250,   min: 10,   max: 300,  step: 5,     label: "Fade Distance" },
      fadeStrength:   { value: 2,   min: 0.1,  max: 5,    step: 0.1,   label: "Fade Strength" },
    },
    { collapsed: true }
  );
  

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent:  true,
        depthWrite:   false,
        side:         THREE.FrontSide,
        vertexShader:   VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime:          { value: 0 },
          uScale:         { value: 0.2 },
          uCellSpeed:     { value: 0.18 },
          uFlowX:         { value: 0.035 },
          uFlowZ:         { value: -0.11 },
          uEdgeThreshold: { value: 0.06 },
          uEdgeSoftness:  { value: 0.04 },
          uDeepColor:     { value: new THREE.Color("#27a3d8") },
          uHighlight:     { value: new THREE.Color("#0a1f3c") },
          uFadeDistance:  { value: 250.0 },
          uFadeStrength:  { value: 2.1 },
          uCamXZ:         { value: new THREE.Vector2() },
        },
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }, delta) => {
    const u = material.uniforms;
    u.uTime.value         += delta;
    u.uScale.value         = seabedScale;
    u.uCellSpeed.value     = cellSpeed;
    u.uFlowX.value         = flowX;
    u.uFlowZ.value         = flowZ;
    u.uEdgeThreshold.value = edgeThreshold;
    u.uEdgeSoftness.value  = edgeSoftness;
    u.uDeepColor.value.set(colorOverride    ?? deepColor);
    u.uHighlight.value.set(colorTopOverride ?? highlightColor);
    u.uFadeDistance.value  = fadeDistanceOverride ?? fadeDistance;
    u.uFadeStrength.value  = fadeStrengthOverride ?? fadeStrength;
    u.uCamXZ.value.set(camera.position.x, camera.position.z);

    meshRef.current.position.x = camera.position.x;
    meshRef.current.position.z = camera.position.z;
    meshRef.current.position.y = seabedDepth;
  });

  return (
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      position={[0, -3.5, 0]}
      frustumCulled={false}
      renderOrder={0}
      receiveShadow
    >
      <planeGeometry args={[600, 600]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
