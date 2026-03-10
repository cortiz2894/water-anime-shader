"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Object3D } from "three";
import { rippleStore, type RippleConfig } from "../stores/rippleStore";

const WATER_Y = -0.1; // must match WaterFloor mesh position Y

export interface UseWaterRippleOptions extends Partial<RippleConfig> {
  /** Collision radius of the object (e.g. sphere radius, half-height). */
  radius?: number;
  /** Seconds between periodic ripples while submerged. */
  periodicInterval?: number;
}

/**
 * Attach to any R3F object to make it emit water ripples.
 * Visual config (speed, width, decay, etc.) is passed here — not in Leva.
 *
 * Usage:
 *   const ref = useRef<Mesh>(null!)
 *   useWaterRipple(ref, { radius: 0.8, speed: 2, rings: 3 })
 *   return <mesh ref={ref} ... />
 */
export function useWaterRipple(
  objectRef: React.RefObject<Object3D>,
  {
    radius           = 0.5,
    periodicInterval = 1.4,
    // Visual config — forwarded to rippleStore and read by WaterFloor
    speed, width, decay, strength, rings, spacing,
  }: UseWaterRippleOptions = {}
) {
  // Push visual config to the store once (and whenever it changes)
  useEffect(() => {
    rippleStore.setConfig({ speed, width, decay, strength, rings, spacing });
  }, [speed, width, decay, strength, rings, spacing]);

  const prevBottomRef = useRef<number | null>(null);
  const lastRippleRef = useRef<number>(-99);

  useFrame(({ clock }) => {
    const obj = objectRef.current;
    if (!obj) return;

    const t       = clock.getElapsedTime();
    const centerY = obj.position.y;
    const bottomY = centerY - radius;

    // First frame: seed prevBottom so no false splash fires on mount
    if (prevBottomRef.current === null) {
      prevBottomRef.current = bottomY;
      return;
    }

    const prevBottom      = prevBottomRef.current;
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
