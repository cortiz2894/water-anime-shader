// ── Display pass shaders ──────────────────────────────────────────────────────
// Maps world XZ → simulation UV, computes gradient magnitude of the height map.
// High gradient = ring edge → rendered as a bright additive overlay.

export const DISP_VERT = /* glsl */ `
  varying vec2 vWorldXZ;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldXZ    = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const DISP_FRAG = /* glsl */ `
  uniform sampler2D uWaveTex;
  uniform vec2  uCenter;
  uniform float uWaveSize;
  uniform float uTexelSize;
  uniform float uGradScale;
  uniform float uRingThreshold;
  uniform float uEdgeSharpness;
  uniform vec3  uColor;
  uniform float uOpacity;

  varying vec2 vWorldXZ;

  void main() {
    float u =  (vWorldXZ.x - uCenter.x) / (uWaveSize * 2.0) + 0.5;
    float v = -(vWorldXZ.y - uCenter.y) / (uWaveSize * 2.0) + 0.5;
    vec2 uv = vec2(u, v);

    if (any(lessThan(uv, vec2(0.01))) || any(greaterThan(uv, vec2(0.99)))) discard;

    // Gradient magnitude
    float dx = texture2D(uWaveTex, uv + vec2( uTexelSize, 0.0)).r
             - texture2D(uWaveTex, uv - vec2( uTexelSize, 0.0)).r;
    float dy = texture2D(uWaveTex, uv + vec2(0.0,  uTexelSize)).r
             - texture2D(uWaveTex, uv - vec2(0.0,  uTexelSize)).r;
    float grad = length(vec2(dx, dy)) * uGradScale;

    // uRingThreshold shifts what gradient counts as a ring
    // uEdgeSharpness narrows the smoothstep window (1 = near hard step, anime style)
    float halfEdge = mix(0.35, 0.01, uEdgeSharpness);
    float ring     = smoothstep(uRingThreshold - halfEdge, uRingThreshold + halfEdge, grad);

    if (ring < 0.01) discard;
    gl_FragColor = vec4(uColor, ring * uOpacity);
  }
`;
