export const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uSmoothness;
  uniform float uEdgeThreshold;
  uniform float uEdgeSoftness;
  uniform float uFlowX;
  uniform float uFlowZ;
  uniform float uCellSpeed;
  uniform float uNoiseScale;
  uniform float uNoiseFlowSpeed;
  uniform float uDistortAmount;
  uniform vec3  uDeepColor;
  uniform vec3  uMidColor;
  uniform float uMidPos;
  uniform vec3  uHighlight;
  uniform float uOpacity;
  uniform float uDeepOpacity;
  uniform float uFadeDistance;
  uniform float uFadeStrength;
  uniform vec2  uCamXZ;

  // ── Ripple uniforms ────────────────────────────────────────────────────────
  uniform vec2  uRippleCenters[8];
  uniform float uRippleTimes[8];
  uniform int   uRippleCount;
  uniform float uRippleSpeed;
  uniform float uRippleWidth;    // ring thickness in world units
  uniform float uRippleStrength;
  uniform float uRippleDecay;
  uniform int   uRippleRings;
  uniform float uRippleSpacing;

  varying vec2 vWorldPos;

  // ── Helpers ────────────────────────────────────────────────────────────────
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  // Polynomial smooth-min (k = blend radius)
  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k / 6.0;
  }

  // Animated cell position — shared between F1 and SmoothF1 so subtraction
  // produces correct cell-edge values (same random offsets in both passes).
  vec2 cellPt(vec2 seed) {
    return 0.5 + 0.5 * sin(uTime * uCellSpeed + 6.2831 * seed);
  }

  // Voronoi F1 — nearest-cell Euclidean distance
  float voronoiF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float md = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        md = min(md, length(n + pt - f));
      }
    return md;
  }

  // Voronoi SmoothF1 — smooth-min over all cell distances
  float voronoiSF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float res = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        res = smin(res, length(n + pt - f), uSmoothness);
      }
    return res;
  }

  // ── fBm noise ─────────────────────────────────────────────────────────────
  float nHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(nHash(i),                  nHash(i + vec2(1.0, 0.0)), f.x),
      mix(nHash(i + vec2(0.0, 1.0)), nHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 2; i++) { v += a * vnoise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  void main() {
    // Noise distortion
    vec2 noiseUV  = vWorldPos * uNoiseScale + vec2(uTime * uNoiseFlowSpeed, 0.0);
    float noiseFac = fbm(noiseUV);
    vec2 distort   = vec2(noiseFac - 0.5) * uDistortAmount;

    // Voronoi UV: base flow + noise distortion
    vec2 uv = vWorldPos * uScale + vec2(uFlowX, uFlowZ) * uTime + distort;

    float f1   = voronoiF1(uv);
    float sf1  = voronoiSF1(uv);

    // F1 − SmoothF1: 0 at cell centers → positive at boundaries
    float edge = f1 - sf1;

    // Cel-shaded ColorRamp: hard step at threshold
    float t = smoothstep(
      uEdgeThreshold - uEdgeSoftness,
      uEdgeThreshold + uEdgeSoftness,
      edge
    );

    // 3-stop ColorRamp: deepColor → midColor → highlight
    float safeMP = max(uMidPos, 1e-4);
    float seg0   = clamp(t / safeMP, 0.0, 1.0);
    float seg1   = clamp((t - safeMP) / max(1.0 - safeMP, 1e-4), 0.0, 1.0);
    float inSeg1 = step(safeMP, t);
    vec3 color   = mix(
      mix(uDeepColor, uMidColor, seg0),
      mix(uMidColor,  uHighlight, seg1),
      inSeg1
    );

    // ── Ripple rings — hard-edged anime rings per impact event ────────────────
    float rippleAcc = 0.0;
    for (int i = 0; i < 8; i++) {
      float isOn    = step(float(i), float(uRippleCount) - 0.5);
      float elapsed = max(uTime - uRippleTimes[i], 0.0);
      float d       = length(vWorldPos - uRippleCenters[i]);

      for (int r = 0; r < 4; r++) {
        float rIsOn    = step(float(r), float(uRippleRings) - 0.5);
        float re       = max(elapsed - float(r) * uRippleSpacing, 0.0);
        float ringR    = re * uRippleSpeed;
        float ringDist = abs(d - ringR);
        float ring     = 1.0 - smoothstep(0.0, uRippleWidth, ringDist);
        float fade     = exp(-re * uRippleDecay);
        rippleAcc     += ring * fade * isOn * rIsOn;
      }
    }
    float ripple = clamp(rippleAcc * uRippleStrength, 0.0, 1.0);

    // Brighten toward highlight color at ring location
    color = mix(color, uHighlight, ripple);

    // Distance fade
    float dist = length(vWorldPos - uCamXZ);
    float fade = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

    float alpha = mix(uDeepOpacity, 1.0, max(t, ripple)) * uOpacity * fade;
    gl_FragColor = vec4(color, alpha);
  }
`;
