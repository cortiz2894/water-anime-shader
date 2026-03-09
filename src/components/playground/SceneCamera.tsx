"use client";

import { useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useControls, folder, button } from "leva";
import { MathUtils } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

// Spherical defaults that match the previous DEFAULT_POS ≈ [16.5, 12.5, -5.0]
const DEFAULT_AZIMUTH = -135; // deg — horizontal angle (0 = +Z axis, 90 = +X axis)
const DEFAULT_POLAR   =  58; // deg — vertical angle  (0 = top, 90 = horizon)
const DEFAULT_RADIUS  =  17.0; // world units — distance from target

export default function SceneCamera() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);

  const {
    autoRotate,
    autoRotateSpeed,
    dampingFactor,
    minDistance,
    maxDistance,
    minPolarAngle,
    maxPolarAngle,
    fov,
    azimuth,
    polar,
    radius,
  } = useControls("Camera", {
    autoRotate:      { value: true,  label: "Auto Rotate" },
    autoRotateSpeed: { value: 0.05,  min: 0.01, max: 5,   step: 0.01, label: "Rotate Speed" },
    dampingFactor:   { value: 0.08,  min: 0.01, max: 0.3, step: 0.01, label: "Damping" },
    minDistance:     { value: 3,     min: 1,    max: 20,  step: 0.5,  label: "Min Distance" },
    maxDistance:     { value: 40,    min: 10,   max: 100, step: 1,    label: "Max Distance" },
    minPolarAngle:   { value: 10,    min: 0,    max: 90,  step: 1,    label: "Min Polar (deg)" },
    maxPolarAngle:   { value: 85,    min: 0,    max: 90,  step: 1,    label: "Max Polar (deg)" },
    fov:             { value: 50,    min: 20,   max: 120, step: 1,    label: "FOV" },
    "Initial Orbit": folder(
      {
        azimuth: { value: DEFAULT_AZIMUTH, min: -180, max: 180, step: 1,   label: "Azimuth (deg)" },
        polar:   { value: DEFAULT_POLAR,   min: 1,    max: 89,  step: 1,   label: "Polar (deg)" },
        radius:  { value: DEFAULT_RADIUS,  min: 2,    max: 120, step: 0.5, label: "Radius" },
        "Reset Camera": button(() => {
          if (!controlsRef.current) return;
          const phi   = MathUtils.degToRad(DEFAULT_POLAR);
          const theta = MathUtils.degToRad(DEFAULT_AZIMUTH);
          camera.position.set(
            DEFAULT_RADIUS * Math.sin(phi) * Math.sin(theta),
            DEFAULT_RADIUS * Math.cos(phi),
            DEFAULT_RADIUS * Math.sin(phi) * Math.cos(theta),
          );
          controlsRef.current.update();
        }),
      },
      { collapsed: false }
    ),
  });

  // Spherical → Cartesian: reposition camera whenever azimuth/polar/radius change
  useEffect(() => {
    const phi   = MathUtils.degToRad(polar);
    const theta = MathUtils.degToRad(azimuth);
    camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    );
    controlsRef.current?.update();
  }, [azimuth, polar, radius, camera]);

  if ("fov" in camera && camera.fov !== fov) {
    // eslint-disable-next-line react-hooks/immutability
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      dampingFactor={dampingFactor}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={MathUtils.degToRad(minPolarAngle)}
      maxPolarAngle={MathUtils.degToRad(maxPolarAngle)}
    />
  );
}
