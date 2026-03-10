export const VERT = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos     = worldPos.xz;
    gl_Position   = projectionMatrix * viewMatrix * worldPos;
  }
`;
