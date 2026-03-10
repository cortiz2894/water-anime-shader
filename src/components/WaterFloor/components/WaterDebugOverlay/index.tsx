"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useControls, folder } from "leva";
import * as THREE from "three";
import { debugStore } from "../../stores/debugStore";

// ─────────────────────────────────────────────────────────────────────────────
// WaterDebugOverlay — toggleable debug panels for the wave simulation passes.
//
// Toggle on via Leva → "Debug" folder.
// Panels follow the camera so they're always visible regardless of orbit.
//
// Panel 1 — Injection Mask:  top-down snapshot of where geometry meets water.
// Panel 2 — Wave Height Map: live PDE simulation texture (wave propagation).
// ─────────────────────────────────────────────────────────────────────────────

const PANEL_SIZE = 2.2;   // world units
const PANEL_GAP  = 1.5;   // lateral offset from center
const CAM_DIST   = 5;     // distance in front of camera

const LABEL_STYLE: React.CSSProperties = {
  background:   "rgba(0,0,0,0.75)",
  color:        "#ffffff",
  fontFamily:   "monospace",
  fontSize:     "11px",
  padding:      "3px 10px",
  borderRadius: "3px",
  whiteSpace:   "nowrap",
  pointerEvents: "none",
  userSelect:   "none",
};

const STEP_STYLE: React.CSSProperties = {
  ...LABEL_STYLE,
  background: "rgba(255,140,0,0.85)",
  color:      "#000",
  fontWeight: "bold",
};

export default function WaterDebugOverlay() {
  const { showInjection, showWaveMap } = useControls(
    "Debug",
    {
      Panels: folder({
        showInjection: { value: false, label: "Step 1 — Injection Mask" },
        showWaveMap:   { value: false, label: "Step 2 — Wave Height Map" },
      }, { collapsed: false }),
    },
    { collapsed: false }
  );

  // ── Materials — updated each frame with the latest RT texture ─────────────
  const injMat  = useMemo(() => new THREE.MeshBasicMaterial({
    depthTest:   false,
    transparent: true,
    color:       0xffffff,
  }), []);

  const waveMat = useMemo(() => new THREE.MeshBasicMaterial({
    depthTest:   false,
    transparent: true,
    color:       0xffffff,
  }), []);

  useEffect(() => () => { injMat.dispose(); waveMat.dispose(); }, [injMat, waveMat]);

  // ── Refs for the panel meshes ─────────────────────────────────────────────
  const injRef  = useRef<THREE.Mesh>(null!);
  const waveRef = useRef<THREE.Mesh>(null!);

  // Scratch vectors — allocated once, reused every frame
  const _dir   = useMemo(() => new THREE.Vector3(), []);
  const _right = useMemo(() => new THREE.Vector3(), []);
  const _up    = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    // ── Sync textures ────────────────────────────────────────────────────────
    if (debugStore.injectionTexture && injMat.map !== debugStore.injectionTexture) {
      injMat.map = debugStore.injectionTexture;
      injMat.needsUpdate = true;
    }
    if (debugStore.waveTexture && waveMat.map !== debugStore.waveTexture) {
      waveMat.map = debugStore.waveTexture;
      waveMat.needsUpdate = true;
    }

    // ── Position panels in camera space ──────────────────────────────────────
    camera.getWorldDirection(_dir);
    _right.crossVectors(_dir, camera.up).normalize();
    _up.copy(camera.up).normalize();

    if (injRef.current) {
      injRef.current.visible = showInjection;
      injRef.current.position
        .copy(camera.position)
        .addScaledVector(_dir,   CAM_DIST)
        .addScaledVector(_right, -PANEL_GAP)
        .addScaledVector(_up,    -0.2);
      injRef.current.quaternion.copy(camera.quaternion);
    }

    if (waveRef.current) {
      waveRef.current.visible = showWaveMap;
      waveRef.current.position
        .copy(camera.position)
        .addScaledVector(_dir,   CAM_DIST)
        .addScaledVector(_right,  PANEL_GAP)
        .addScaledVector(_up,    -0.2);
      waveRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <>
      {/* ── Panel 1: Injection Mask ───────────────────────────────────────── */}
      <mesh ref={injRef} renderOrder={999} visible={false}>
        <planeGeometry args={[PANEL_SIZE, PANEL_SIZE]} />
        <primitive object={injMat} attach="material" />

        {/* Border */}
        <mesh renderOrder={998} position={[0, 0, -0.01]}>
          <planeGeometry args={[PANEL_SIZE + 0.08, PANEL_SIZE + 0.08]} />
          <meshBasicMaterial color="#ff8c00" depthTest={false} />
        </mesh>

        {/* Labels */}
        <Html center position={[0, PANEL_SIZE / 2 + 0.22, 0]}>
          <div style={STEP_STYLE}>STEP 1</div>
        </Html>
        <Html center position={[0, -(PANEL_SIZE / 2 + 0.22), 0]}>
          <div style={LABEL_STYLE}>Injection Mask — top-down waterline snapshot</div>
        </Html>
      </mesh>

      {/* ── Panel 2: Wave Height Map ──────────────────────────────────────── */}
      <mesh ref={waveRef} renderOrder={999} visible={false}>
        <planeGeometry args={[PANEL_SIZE, PANEL_SIZE]} />
        <primitive object={waveMat} attach="material" />

        {/* Border */}
        <mesh renderOrder={998} position={[0, 0, -0.01]}>
          <planeGeometry args={[PANEL_SIZE + 0.08, PANEL_SIZE + 0.08]} />
          <meshBasicMaterial color="#00aaff" depthTest={false} />
        </mesh>

        {/* Labels */}
        <Html center position={[0, PANEL_SIZE / 2 + 0.22, 0]}>
          <div style={STEP_STYLE}>STEP 2</div>
        </Html>
        <Html center position={[0, -(PANEL_SIZE / 2 + 0.22), 0]}>
          <div style={LABEL_STYLE}>Wave Height Map — PDE simulation</div>
        </Html>
      </mesh>
    </>
  );
}
