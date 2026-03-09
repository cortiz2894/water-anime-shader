// ─────────────────────────────────────────────────────────────────────────────
// rippleStore — lightweight module singleton for water ripple events.
//
// DemoSphere (or any object) calls rippleStore.add() when it touches the water.
// WaterFloor reads rippleStore.get() in useFrame and pushes to shader uniforms.
//
// Time values must come from the same R3F clock (state.clock.getElapsedTime())
// so that start times are directly comparable to WaterFloor's uTime.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RIPPLES = 8;

export interface RippleEvent {
  x: number; // world X
  z: number; // world Z
  t: number; // clock.getElapsedTime() when emitted
}

const buffer: RippleEvent[] = [];

export const rippleStore = {
  /** Emit a new ripple. Oldest is evicted when buffer is full. */
  add(x: number, z: number, t: number) {
    if (buffer.length >= MAX_RIPPLES) buffer.shift();
    buffer.push({ x, z, t });
  },

  /** Read-only view of active ripples. */
  get(): readonly RippleEvent[] {
    return buffer;
  },

  /** Remove all ripples (e.g. on scene reset). */
  clear() {
    buffer.length = 0;
  },
};
