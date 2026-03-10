export const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uCellSpeed;
  uniform float uFlowX;
  uniform float uFlowZ;
  uniform float uEdgeThreshold;
  uniform float uEdgeSoftness;
  uniform vec3  uDeepColor;
  uniform vec3  uHighlight;
  uniform float uFadeDistance;
  uniform float uFadeStrength;
  uniform vec2  uCamXZ;

  varying vec2 vWorldPos;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k / 6.0;
  }

  vec2 cellPt(vec2 seed) {
    return 0.5 + 0.5 * sin(uTime * uCellSpeed + 6.2831 * seed);
  }

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

  float voronoiSF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float res = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        res = smin(res, length(n + pt - f), 0.4);
      }
    return res;
  }

  void main() {
    vec2  uv   = vWorldPos * uScale + vec2(uFlowX, uFlowZ) * uTime;
    float f1   = voronoiF1(uv);
    float sf1  = voronoiSF1(uv);
    float edge = f1 - sf1;

    float t     = smoothstep(uEdgeThreshold - uEdgeSoftness,
                             uEdgeThreshold + uEdgeSoftness, edge);
    vec3  color = mix(uDeepColor, uHighlight, t);

    float dist  = length(vWorldPos - uCamXZ);
    float fade  = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

    gl_FragColor = vec4(color, fade);
  }
`;
