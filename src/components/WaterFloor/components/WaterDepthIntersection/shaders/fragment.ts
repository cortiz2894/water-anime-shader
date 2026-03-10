export const FRAG = /* glsl */ `
  uniform sampler2D uDepthTex;
  uniform vec2  uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uLineWidth;   // world units — controls the sharp line thickness
  uniform float uGlowWidth;   // world units — controls the soft halo radius
  uniform vec3  uLineColor;
  uniform float uLineOpacity;
  uniform vec3  uGlowColor;
  uniform float uGlowOpacity;

  // Convert window-space depth [0,1] to view-space distance (world units).
  float linearDepth(float raw) {
    float z = raw * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  void main() {
    vec2 screenUV = gl_FragCoord.xy / uResolution;

    float rawScene = texture2D(uDepthTex, screenUV).r;

    // 1.0 depth means nothing was rendered there — skip this fragment.
    if (rawScene > 0.9999) discard;

    float sceneD = linearDepth(rawScene);
    float waterD = linearDepth(gl_FragCoord.z);
    float diff   = abs(sceneD - waterD);

    // Sharp line at the intersection boundary
    float line = 1.0 - smoothstep(0.0, uLineWidth, diff);

    // Soft exponential halo around the intersection
    float glow = exp(-diff / max(uGlowWidth, 0.001));

    float lineContrib = line * uLineOpacity;
    float glowContrib = glow * uGlowOpacity;
    float totalAlpha  = max(lineContrib, glowContrib);

    if (totalAlpha < 0.005) discard;

    // Blend line colour over glow colour based on how close to the exact line
    vec3 col = mix(uGlowColor, uLineColor, line);
    gl_FragColor = vec4(col, totalAlpha);
  }
`;
