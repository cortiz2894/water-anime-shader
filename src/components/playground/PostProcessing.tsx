"use client";

import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useControls } from "leva";

export default function PostProcessing() {
  const { mipmapBlur, intensity, radius, threshold } = useControls(
    "Postprocessing",
    {
      mipmapBlur: { value: true,  label: "Mipmap Blur" },
      intensity:  { value: 1.1,  min: 0, max: 10, step: 0.05, label: "Intensity" },
      radius:     { value: 0.75,  min: 0, max: 1,  step: 0.01, label: "Radius" },
      threshold:  { value: 0.33,   min: 0, max: 3,  step: 0.01, label: "Threshold" },
    }
  );

  return (
    <EffectComposer>
      <Bloom
        mipmapBlur={mipmapBlur}
        intensity={intensity}
        radius={radius}
        luminanceThreshold={threshold}
      />
    </EffectComposer>
  );
}
