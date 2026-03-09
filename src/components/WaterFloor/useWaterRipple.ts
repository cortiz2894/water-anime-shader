"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Object3D } from "three";
import { rippleStore } from "./rippleStore";

const WATER_Y = -0.1; // must match WaterFloor mesh position Y

interface UseWaterRippleOptions {
  /** Collision radius of the object (e.g. sphere radius, half-height of a box). */
  radius?: number;
  /** Seconds between periodic ripples while submerged. */
  periodicInterval?: number;
}

/**
 * Attach to any R3F object to make it emit water ripples on collision.
 *
 * Usage:
 *   const ref = useRef<Mesh>(null!)
 *   useWaterRipple(ref, { radius: 0.8 })
 *   return <mesh ref={ref} ... />
 */
export function useWaterRipple(
  objectRef: React.RefObject<Object3D>,
  { radius = 0.5, periodicInterval = 1.4 }: UseWaterRippleOptions = {}
) {
  const prevBottomRef  = useRef<number | null>(null); // null = not yet initialized
  const lastRippleRef  = useRef<number>(-99);

  useFrame(({ clock }) => {
    const obj = objectRef.current;
    if (!obj) return;

    const t       = clock.getElapsedTime();
    const centerY = obj.position.y;
    const bottomY = centerY - radius;

    // First frame: seed prevBottom with current position so no false splash fires.
    if (prevBottomRef.current === null) {
      prevBottomRef.current = bottomY;
      return;
    }

    const prevBottom = prevBottomRef.current;
    prevBottomRef.current = bottomY;

    // Entry splash: bottom crosses water surface going downward
    if (prevBottom > WATER_Y && bottomY <= WATER_Y) {
      rippleStore.add(obj.position.x, obj.position.z, t);
      lastRippleRef.current = t;
    }

    // Periodic ripples while submerged
    if (bottomY < WATER_Y && t - lastRippleRef.current > periodicInterval) {
      rippleStore.add(obj.position.x, obj.position.z, t);
      lastRippleRef.current = t;
    }
  });
}
