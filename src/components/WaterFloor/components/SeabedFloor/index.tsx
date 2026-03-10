"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VERT } from "./shaders/vertex";
import { FRAG } from "./shaders/fragment";
import { useSeabedControls } from "./utils/controls";

// ─────────────────────────────────────────────────────────────────────────────
// SeabedFloor — animated Voronoi seabed visible through the transparent
// deep-color areas of WaterFloor. Slower than the surface → parallax depth.
//
// renderOrder = 0  (before WaterFloor at renderOrder = 1)
// ─────────────────────────────────────────────────────────────────────────────

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
  } = useSeabedControls();

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
