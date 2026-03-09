"use client";

import { Suspense } from "react";
import SceneCamera from "./SceneCamera";
import SceneLighting from "./SceneLighting";
import SceneEnvironment from "./SceneEnvironment";
import GridFloor from "./GridFloor";
import GlbModel from "./GlbModel";
import PostProcessing from "./PostProcessing";
import { DragonBalls } from "../WaterFloor/components/DragonBalls";
import { Feather } from "../WaterFloor/components/Feather";

export type SceneMode = "Background" | "Frame";

interface SceneContentProps {
  showGrid: boolean;
  mode: SceneMode;
  glbUrl: string | null;
  onModelLoaded?: () => void;
}

export default function SceneContent({ showGrid, mode, glbUrl, onModelLoaded }: SceneContentProps) {
  return (
    <>
      <SceneCamera />
      <SceneLighting />
      <SceneEnvironment mode={mode} />
      {showGrid && <GridFloor mode={mode} />}
      <Suspense fallback={null}>
        <DragonBalls />
      </Suspense>
      <Suspense fallback={null}>
        <Feather />
      </Suspense>
      <PostProcessing />
    </>
  );
}
