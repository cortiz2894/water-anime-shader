export const VERT = /* glsl */ `
  attribute float aLifetime;
  attribute float aMaxLifetime;
  attribute float aSize;

  varying float vAlpha;

  void main() {
    float t = clamp(aLifetime / aMaxLifetime, 0.0, 1.0);
    // Smooth fade-in / fade-out using a sine curve over [0, PI]
    vAlpha = sin(t * 3.14159265);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Clamp minimum depth so no particle blows up to huge size on first frame
    gl_PointSize = aSize * (300.0 / max(-mvPosition.z, 4.0));
    gl_Position  = projectionMatrix * mvPosition;
  }
`;
