"use client";

import { Suspense } from "react";
import SceneCamera from "./SceneCamera";
import SceneLighting from "./SceneLighting";
import SceneEnvironment from "./SceneEnvironment";
import GridFloor from "./GridFloor";
import PostProcessing from "./PostProcessing";
import { DragonBalls } from "../WaterFloor/models/DragonBalls";
import { Feather } from "../WaterFloor/models/Feather";

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
