"use client";

import { useRef, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useControls, folder } from "leva";
import * as THREE from "three";
import type { Group } from "three";
import { useWaterRipple } from "../../hooks/useWaterRipple";

export function Feather() {
  const { nodes, materials } = useGLTF("/assets/feather.glb") as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.Material>;
  };
  const groupRef = useRef<Group>(null!);

  // Clone the material so we don't mutate the shared GLTF cache.
  // Switch to alphaTest (cutout) mode:
  //   - depthWrite: true  → writes to depth buffer like an opaque object
  //   - alphaTest: 0.1    → discards fragments below threshold (no sort issues)
  //   - transparent: false → disables alpha blending, avoids water compositing bugs
  //   - side: DoubleSide  → visible from both faces (feather is thin)
  const featherMat = useMemo(() => {
    const mat = (materials.feather_2 as THREE.MeshStandardMaterial).clone();
    mat.transparent = true;
    mat.alphaTest   = 0.1;
    mat.depthWrite  = true;
    mat.side        = THREE.DoubleSide;
    mat.needsUpdate = true;
    return mat;
  }, [materials.feather_2]);

  useEffect(() => () => featherMat.dispose(), [featherMat]);

  const { posX, posY, posZ, scale, rotY, rippleRadius, rippleInterval } = useControls(
    "Feather",
    {
      Position: folder(
        {
          posX: { value: -4.30, min: -20,  max: 20,  step: 0.05, label: "X" },
          posY: { value:  0.05, min: -5,   max: 10,  step: 0.05, label: "Y" },
          posZ: { value: -1.75, min: -20,  max: 20,  step: 0.05, label: "Z" },
        },
        { collapsed: false }
      ),
      scale:          { value: 9.30, min: 0.1,  max: 100, step: 0.05, label: "Scale" },
      rotY:           { value: -27,  min: -180, max: 180, step: 1,    label: "Rotation Y" },
      rippleRadius:   { value: 0.1,  min: 0.05, max: 3,   step: 0.05, label: "Ripple Radius" },
      rippleInterval: { value: 2.3,  min: 0.2,  max: 5,   step: 0.1,  label: "Ripple Interval (s)" },
    },
    { collapsed: false }
  );

  useWaterRipple(groupRef, { radius: rippleRadius, periodicInterval: rippleInterval });

  // Gentle water-drift animation: two sine waves per axis for organic motion.
  // useFrame owns position+rotation so Leva values stay as the resting anchor.
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime();

    // Y bob: main slow wave + small fast ripple
    const bob = Math.sin(t * 0.65) * 0.07 + Math.sin(t * 1.4 + 0.8) * 0.02;
    // Pitch (X tilt): feather dips nose slightly
    const pitch = Math.sin(t * 0.5 + 0.3) * 0.06;
    // Roll (Z tilt): side-to-side sway
    const roll = Math.sin(t * 0.45 + 1.1) * 0.09 + Math.sin(t * 1.1) * 0.02;
    // Yaw drift (Y rotation): very slow lazy spin
    const yaw = Math.sin(t * 0.28) * 0.04;

    g.position.set(posX, posY + bob, posZ);
    g.rotation.set(pitch, (rotY * Math.PI) / 180 + yaw, roll);
  });

  return (
    <group
      ref={groupRef}
      scale={scale}
      dispose={null}
    >
      <mesh
        geometry={nodes.feather_2001_feather_2_0.geometry}
        material={featherMat}
      />
    </group>
  );
}

useGLTF.preload("/assets/feather.glb");
