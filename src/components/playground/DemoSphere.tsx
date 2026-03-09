"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { SceneMode } from "./SceneContent";
import { useWaterRipple } from "../WaterFloor/useWaterRipple";

const SPHERE_RADIUS = 0.8;
const BOB_CENTER    = -0.2;
const BOB_AMPLITUDE = 0.6;
const BOB_SPEED     = 0.75;

export default function DemoSphere({ mode }: { mode: SceneMode }) {
  const meshRef = useRef<Mesh>(null!);

  // Drop-in hook — any object just needs this + its radius
  useWaterRipple(meshRef, { radius: SPHERE_RADIUS, periodicInterval: 1.4 });

  // useFrame(({ clock }) => {
  //   const t = clock.getElapsedTime();
  //   meshRef.current.position.y = BOB_CENTER + Math.sin(t * BOB_SPEED) * BOB_AMPLITUDE;
  // });

  return (
    <mesh ref={meshRef} position={[0, BOB_CENTER, 0]} castShadow={false}>
      <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
      <meshStandardMaterial
        color="#c8b89a"
        roughness={0.25}
        metalness={0.6}
      />
    </mesh>
  );
}
