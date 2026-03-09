"use client";

import { Environment } from "@react-three/drei";
import { useControls, folder } from "leva";
import type { SceneMode } from "./SceneContent";

type EnvPreset =
  | "apartment"
  | "city"
  | "dawn"
  | "forest"
  | "lobby"
  | "night"
  | "park"
  | "studio"
  | "sunset"
  | "warehouse";

export default function SceneEnvironment({ mode }: { mode: SceneMode }) {
  const { preset, bgBlurriness, bgIntensity, envIntensity } = useControls(
    "Environment",
    {
      preset: {
        value: "park" as EnvPreset,
        options: [
          "apartment",
          "city",
          "dawn",
          "forest",
          "lobby",
          "night",
          "park",
          "studio",
          "sunset",
          "warehouse",
        ] as EnvPreset[],
        label: "Preset",
      },
      bgBlurriness: { value: 0.9, min: 0, max: 1, step: 0.01, label: "Bg Blur" },
      bgIntensity: { value: 0.3, min: 0, max: 2, step: 0.05, label: "Bg Intensity" },
      envIntensity: { value: 1, min: 0, max: 3, step: 0.05, label: "Env Intensity" },
    },
  );

  return (
    <Environment
      preset={preset}
      background={mode === "Background"}
      backgroundBlurriness={bgBlurriness}
      backgroundIntensity={bgIntensity}
      environmentIntensity={envIntensity}
    />
  );
}
