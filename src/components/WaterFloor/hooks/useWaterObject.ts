import { useEffect } from "react";
import type * as THREE from "three";
import { waterObjectsRegistry } from "../stores/waterObjectsRegistry";

/**
 * Registers a model's geometry with the water effect system.
 *
 * WaterDepthIntersection and WaterWaveSimulation will automatically pick up
 * any registered object — no changes to those components needed.
 *
 * @param id        Unique string identifier for this object.
 * @param ref       Ref to the model's root Object3D (group or mesh).
 * @param geometries BufferGeometries that should cast the waterline effects.
 *
 * @example
 * const groupRef = useRef<THREE.Group>(null!)
 * useWaterObject("dragon-balls", groupRef, [nodes.Sphere.geometry])
 * return <group ref={groupRef} ... />
 */
export function useWaterObject(
  id: string,
  ref: { current: THREE.Object3D | null },
  geometries: THREE.BufferGeometry[]
) {
  useEffect(() => {
    if (!geometries.length) return;
    waterObjectsRegistry.register({ id, ref, geometries });
    return () => waterObjectsRegistry.unregister(id);
  // geometries are stable refs from the useGLTF cache — id and ref are stable too.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
