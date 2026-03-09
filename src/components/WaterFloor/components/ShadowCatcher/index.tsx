"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import * as THREE from "three";

export default function ShadowCatcher() {
  const seabedRef = useRef<THREE.Mesh>(null!);

  // Read seabedDepth from the shared "Seabed" Leva store — same key as SeabedFloor,
  // so no duplicate control appears and both components stay in sync automatically.
  const { seabedDepth } = useControls("Seabed", { seabedDepth: { value: -9.5 } });

  const { opacity, enabled } = useControls(
    "Shadows",
    {
      enabled: { value: true,  label: "Enabled" },
      opacity: { value: 0.35, min: 0, max: 1, step: 0.01, label: "Opacity" },
    },
    { collapsed: true }
  );

  useFrame(({ camera }) => {
    seabedRef.current.position.x = camera.position.x;
    seabedRef.current.position.z = camera.position.z;
  });

  if (!enabled) return null;

  return (
    <mesh
      ref={seabedRef}
      receiveShadow
      rotation-x={-Math.PI / 2}
      position={[0, seabedDepth, 0]}
      frustumCulled={false}
      renderOrder={0}
    >
      <planeGeometry args={[600, 600]} />
      <shadowMaterial transparent opacity={opacity} />
    </mesh>
  );
}
