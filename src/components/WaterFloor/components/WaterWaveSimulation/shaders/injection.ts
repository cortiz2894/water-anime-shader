// ── Injection pass shaders ────────────────────────────────────────────────────
// Top-down orthographic render of geometry intersecting the water surface.
// Outputs a mask where geometry crosses the water plane (R channel).

export const INJ_VERT = /* glsl */ `
  varying float vWorldY;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldY  = wp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const INJ_FRAG = /* glsl */ `
  uniform float uWaterY;
  uniform float uBandWidth;
  varying float vWorldY;
  void main() {
    float d = abs(vWorldY - uWaterY);
    if (d > uBandWidth) discard;
    float s = 1.0 - smoothstep(0.0, uBandWidth, d);
    gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
  }
`;
