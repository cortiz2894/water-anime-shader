"use client";

import { useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Leva, useControls } from "leva";
import { LEVA_THEME } from "@/components/shared/theme";
import SceneContent from "./SceneContent";
import type { SceneMode } from "./SceneContent";
import UIOverlay from "@/components/overlay/UIOverlay";
import OverlayButtons from "@/components/overlay/OverlayButtons";
import LoadingOverlay from "@/components/overlay/LoadingOverlay";

export default function PlaygroundCanvas() {
  const [showGrid, setShowGrid] = useState(true);
  const [hideLeva, setHideLeva] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const glbUrlRef = useRef<string | null>(null);

  const handleLoadGlb = useCallback((file: File) => {
    if (glbUrlRef.current) URL.revokeObjectURL(glbUrlRef.current);
    const url = URL.createObjectURL(file);
    glbUrlRef.current = url;
    setIsLoadingModel(true);
    setGlbUrl(url);
  }, []);

  const handleModelLoaded = useCallback(() => {
    setIsLoadingModel(false);
  }, []);

  const handleClearGlb = useCallback(() => {
    if (glbUrlRef.current) URL.revokeObjectURL(glbUrlRef.current);
    glbUrlRef.current = null;
    setGlbUrl(null);
  }, []);

  const { mode } = useControls("Scene", {
    mode: {
      value: "Background" as SceneMode,
      options: ["Background", "Frame"] as SceneMode[],
      label: "Mode",
    },
  });

  return (
    <>
      <Leva
        theme={LEVA_THEME}
        titleBar={{ title: "CONTROLS" }}
        collapsed={false}
        flat={false}
        oneLineLabels={false}
        hidden={hideLeva}
      />
      <div style={{ position: "fixed", inset: 0 }}>
        <Canvas
          shadows
          camera={{ position: [8, 6, 8], fov: 50, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: false }}
          dpr={2}
          style={{ background: "#011851" }}
        >
          <SceneContent showGrid={showGrid} mode={mode} glbUrl={glbUrl} onModelLoaded={handleModelLoaded} />
        </Canvas>
      </div>
      <UIOverlay mode={mode} />
      <OverlayButtons
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        hideLeva={hideLeva}
        onToggleLeva={() => setHideLeva((v) => !v)}
        hasGlb={glbUrl !== null}
        onLoadGlb={handleLoadGlb}
        onClearGlb={handleClearGlb}
      />
      <LoadingOverlay visible={isLoadingModel} />
    </>
  );
}
