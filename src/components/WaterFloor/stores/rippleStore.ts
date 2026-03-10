// ─────────────────────────────────────────────────────────────────────────────
// rippleStore — lightweight module singleton for water ripple events.
//
// Any object calls rippleStore.add() when it touches the water.
// WaterFloor reads rippleStore.get() in useFrame and pushes to shader uniforms.
//
// Visual config is set once via rippleStore.setConfig() (typically from
// useWaterRipple) and read by WaterFloor — no Leva needed at the call site.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RIPPLES = 8;

export interface RippleEvent {
  x: number; // world X
  z: number; // world Z
  t: number; // clock.getElapsedTime() when emitted
}

export interface RippleConfig {
  /** Ring expansion speed (world units / second) */
  speed: number;
  /** Ring line thickness (world units) */
  width: number;
  /** How fast rings fade out */
  decay: number;
  /** Visual intensity multiplier */
  strength: number;
  /** Number of concentric rings per event */
  rings: number;
  /** Time offset between consecutive rings (seconds) */
  spacing: number;
}

const DEFAULT_CONFIG: RippleConfig = {
  speed:    1.5,
  width:    0.12,
  decay:    1.6,
  strength: 5.5,
  rings:    2,
  spacing:  1.0,
};

const buffer: RippleEvent[] = [];
let config: RippleConfig    = { ...DEFAULT_CONFIG };

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

  /** Set the visual config (called by useWaterRipple on mount).
   *  Undefined values are ignored so callers can omit params they don't need. */
  setConfig(partial: Partial<RippleConfig>) {
    const defined = Object.fromEntries(
      Object.entries(partial).filter(([, v]) => v !== undefined)
    ) as Partial<RippleConfig>;
    config = { ...config, ...defined };
  },

  /** Read the current visual config (called by WaterFloor in useFrame). */
  getConfig(): RippleConfig {
    return config;
  },

  /** Remove all ripples (e.g. on scene reset). */
  clear() {
    buffer.length = 0;
  },
};
