import type * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// debugStore — exposes internal render-target textures for debug visualization.
//
// WaterWaveSimulation writes here each frame.
// WaterDebugOverlay reads from here to display the textures on screen.
// ─────────────────────────────────────────────────────────────────────────────

export const debugStore = {
  /** Top-down snapshot of where geometry intersects the water surface. */
  injectionTexture: null as THREE.Texture | null,
  /** Live wave height map from the ping-pong PDE simulation. */
  waveTexture:      null as THREE.Texture | null,
};
