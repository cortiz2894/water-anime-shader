"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useControls } from "leva";
import type { SceneMode } from "./SceneContent";
import WaterFloor from "../WaterFloor";
import SeabedFloor from "../WaterFloor/components/SeabedFloor";
import WaterSparkles from "../WaterFloor/components/WaterSparkles";
import ShadowCatcher from "../WaterFloor/components/ShadowCatcher";
import WaterDepthIntersection from "../WaterFloor/components/WaterDepthIntersection";
import WaterWaveSimulation from "../WaterFloor/components/WaterWaveSimulation";
import WaterDebugOverlay from "../WaterFloor/components/WaterDebugOverlay";


// ─────────────────────────────────────────────────────────────────────────────
// GridFloor — procedural grid floor with custom ShaderMaterial
//
// Anti-aliased cell + section grid lines drawn in GLSL using fwidth().
// Solid in the center, fades out at a configurable distance.
// Matches the Unity Editor playground grid aesthetic.
// ─────────────────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3  uBaseColor;
  uniform vec3  uCellColor;
  uniform vec3  uSectionColor;
  uniform float uCellSize;
  uniform float uSectionEvery;   // major line every N cells (as float)
  uniform float uLineWidth;      // line thickness multiplier
  uniform float uFadeDistance;   // camera distance at which floor fades to 0
  uniform float uFadeStrength;   // fade exponent
  uniform vec2  uCamXZ;          // camera world XZ for fade origin

  varying vec2 vWorldPos;

  void main() {
    // ── Cell grid (anti-aliased via fwidth) ──────────────────────────────────
    vec2 cellCoord = vWorldPos / uCellSize;
    vec2 dCell     = fwidth(cellCoord) * uLineWidth;
    vec2 cellEdge  = abs(fract(cellCoord - 0.5) - 0.5) / dCell;
    float cellLine = 1.0 - min(min(cellEdge.x, cellEdge.y), 1.0);

    // ── Section grid (every uSectionEvery cells) ─────────────────────────────
    float secSize  = uCellSize * uSectionEvery;
    vec2 secCoord  = vWorldPos / secSize;
    vec2 dSec      = fwidth(secCoord) * uLineWidth;
    vec2 secEdge   = abs(fract(secCoord - 0.5) - 0.5) / dSec;
    float secLine  = 1.0 - min(min(secEdge.x, secEdge.y), 1.0);

    // ── Distance fade from camera ────────────────────────────────────────────
    float dist = length(vWorldPos - uCamXZ);
    float fade = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

    // ── Compose ──────────────────────────────────────────────────────────────
    vec3 col = uBaseColor;
    col = mix(col, uCellColor,    cellLine);
    col = mix(col, uSectionColor, secLine);   // section lines override cell lines

    gl_FragColor = vec4(col, fade);
  }
`;

interface GridFloorProps {
  mode: SceneMode;
}

export default function GridFloor({
  mode
}: GridFloorProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const {
    floorMode,
    baseColor, cellColor, sectionColor,
    cellSize, sectionEvery, lineWidth,
    fadeDistance, fadeStrength,
  } = useControls(
    "Floor",
    {
      floorMode:    { value: "water", options: ["grid", "water"], label: "Mode" },
      baseColor:    { value: "#c8d4dc", label: "Base Color" },
      cellColor:    { value: "#8fa8b8", label: "Cell Line" },
      sectionColor: { value: "#4a78a0", label: "Section Line" },
      cellSize:     { value: 4.0, min: 0.5, max: 20,  step: 0.5, label: "Cell Size" },
      sectionEvery: { value: 4,   min: 1,   max: 10,  step: 1,   label: "Section (every N cells)" },
      lineWidth:    { value: 1.0, min: 0.1, max: 4,   step: 0.1, label: "Line Width" },
      fadeDistance: { value: 90,  min: 10,  max: 300, step: 5,   label: "Fade Distance" },
      fadeStrength: { value: 1.4, min: 0.1, max: 5,   step: 0.1, label: "Fade Strength" },
    },
    { collapsed: true }
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uBaseColor:    { value: new THREE.Color("#c8d4dc") },
          uCellColor:    { value: new THREE.Color("#8fa8b8") },
          uSectionColor: { value: new THREE.Color("#4a78a0") },
          uCellSize:     { value: 4.0 },
          uSectionEvery: { value: 4.0 },
          uLineWidth:    { value: 1.0 },
          uFadeDistance: { value: 90.0 },
          uFadeStrength: { value: 1.4 },
          uCamXZ:        { value: new THREE.Vector2() },
        },
      }),
    []
  );

  // Sync Leva → shader uniforms
  useEffect(() => {
    material.uniforms.uBaseColor.value.set(baseColor);
    material.uniforms.uCellColor.value.set(cellColor);
    material.uniforms.uSectionColor.value.set(sectionColor);
    material.uniforms.uCellSize.value     = cellSize;
    material.uniforms.uSectionEvery.value = sectionEvery;
    material.uniforms.uLineWidth.value    = lineWidth;
    material.uniforms.uFadeDistance.value = fadeDistance;
    material.uniforms.uFadeStrength.value = fadeStrength;
  }, [material, baseColor, cellColor, sectionColor, cellSize, sectionEvery, lineWidth, fadeDistance, fadeStrength]);

  // Follow camera XZ each frame → infinite floor effect as the ship advances
  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    material.uniforms.uCamXZ.value.set(camera.position.x, camera.position.z);
    meshRef.current.position.x = camera.position.x;
    meshRef.current.position.z = camera.position.z;
  });

  if (floorMode === "water") return (
    <>
      <SeabedFloor />
      <ShadowCatcher />
      <WaterFloor />
      <WaterSparkles />
      <WaterDepthIntersection />
      <WaterWaveSimulation />
      {/* <WaterDebugOverlay /> */}
    </>
  );

  return (
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      position={[0, -0.1, 0]}
      material={material}
      receiveShadow={false}
    >
      <planeGeometry args={[600, 600]} />
    </mesh>
  );
}
