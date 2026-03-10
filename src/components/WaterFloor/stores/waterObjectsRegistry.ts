import type * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// waterObjectsRegistry — module singleton that connects 3D models to the
// water effect passes (depth intersection + wave simulation).
//
// Any model calls useWaterObject() → registers here.
// WaterDepthIntersection and WaterWaveSimulation iterate over this registry
// each frame — they never import models directly.
//
// Usage in a model component:
//   useWaterObject("my-model", groupRef, [nodes.MyMesh.geometry])
// ─────────────────────────────────────────────────────────────────────────────

export interface WaterObjectEntry {
  id: string;
  /** Ref to the model's root Object3D — position/rotation/scale are read each frame. */
  ref: { current: THREE.Object3D | null };
  /** Geometries that should cast the depth/injection mask. */
  geometries: THREE.BufferGeometry[];
}

const registry = new Map<string, WaterObjectEntry>();

export const waterObjectsRegistry = {
  register(entry: WaterObjectEntry) {
    registry.set(entry.id, entry);
  },

  unregister(id: string) {
    registry.delete(id);
  },

  getAll(): WaterObjectEntry[] {
    return Array.from(registry.values());
  },
};
