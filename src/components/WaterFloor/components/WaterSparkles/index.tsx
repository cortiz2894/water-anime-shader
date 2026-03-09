"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls, folder } from "leva";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// WaterSparkles — procedural 4-pointed star sparkles on the water surface.
//
// Each particle is a GL_POINT. The fragment shader draws the 4-pointed star
// shape using two crossing elongated gaussians + a central radial glow.
// No textures needed — fully generated in GLSL via gl_PointCoord.
//
// Lifecycle: each particle fades in/out using a sin curve over its lifetime.
// When it dies, it respawns at a random XZ offset from the camera.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_COUNT = 500;

const VERT = /* glsl */ `
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

const FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uIntensity;
  uniform float uArmSharpness;   // how tight the arms are (higher = thinner)
  uniform float uArmFalloff;     // radial falloff along each arm
  uniform float uGlowRadius;     // central glow radius (higher = tighter)

  varying float vAlpha;

  void main() {
    // gl_PointCoord: [0,1]² → remap to [-1,1]²
    vec2 uv = gl_PointCoord * 2.0 - 1.0;

    // Horizontal arm: sharp in Y, gradual in X
    float hArm = exp(-abs(uv.y) * uArmSharpness) * exp(-abs(uv.x) * uArmFalloff);
    // Vertical arm: sharp in X, gradual in Y
    float vArm = exp(-abs(uv.x) * uArmSharpness) * exp(-abs(uv.y) * uArmFalloff);
    // Central radial glow
    float glow = exp(-length(uv) * uGlowRadius);

    float star = max(max(hArm, vArm), glow);

    if (star < 0.005) discard;

    gl_FragColor = vec4(uColor * uIntensity, star * vAlpha);
  }
`;

export default function WaterSparkles() {
  // ── Leva controls ──────────────────────────────────────────────────────────
  const {
    count,
    spread,
    heightOffset,
    minSize,
    maxSize,
    minLife,
    maxLife,
    color,
    intensity,
    armSharpness,
    armFalloff,
    glowRadius,
  } = useControls(
    "Water Sparkles",
    {
      count:    { value: 100,  min: 0,   max: MAX_COUNT, step: 1,   label: "Count" },
      spread:   { value: 40,  min: 5,   max: 120,       step: 1,   label: "Spread Radius" },
      heightOffset: { value: 0.97, min: 0, max: 2,      step: 0.01, label: "Height Offset" },
      Size: folder({
        minSize: { value: 3,  min: 1,   max: 150,       step: 1,   label: "Min Size" },
        maxSize: { value: 6,  min: 1,   max: 300,       step: 1,   label: "Max Size" },
      }, { collapsed: false }),
      Lifetime: folder({
        minLife: { value: 0.7, min: 0.1, max: 10,        step: 0.1, label: "Min Life (s)" },
        maxLife: { value: 2.8, min: 0.1, max: 15,        step: 0.1, label: "Max Life (s)" },
      }, { collapsed: false }),
      Appearance: folder({
        color:       { value: "#e5d2d2",                              label: "Color" },
        intensity:   { value: 1.8,  min: 0.1, max: 15,  step: 0.1,  label: "Intensity" },
        armSharpness:{ value: 27.0, min: 1,   max: 40,  step: 0.5,  label: "Arm Sharpness" },
        armFalloff:  { value: 4.8,  min: 0.1, max: 8,   step: 0.1,  label: "Arm Falloff" },
        glowRadius:  { value: 12,  min: 0.5, max: 12,  step: 0.1,  label: "Glow Radius" },
      }, { collapsed: true }),
    },
    { collapsed: true }
  );

  // ── CPU particle data (typed arrays, never recreated) ─────────────────────
  const posArr     = useMemo(() => new Float32Array(MAX_COUNT * 3), []);
  const lifeArr    = useMemo(() => new Float32Array(MAX_COUNT), []);
  const maxLifeArr = useMemo(() => new Float32Array(MAX_COUNT), []);
  const sizeArr    = useMemo(() => new Float32Array(MAX_COUNT), []);

  // Initialise all MAX_COUNT particles with staggered random starting ages
  useMemo(() => {
    for (let i = 0; i < MAX_COUNT; i++) {
      posArr[i * 3]     = (Math.random() - 0.5) * 60;
      posArr[i * 3 + 1] = -0.1 + 0.97; // match default heightOffset so Y is correct on frame 0
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 60;
      maxLifeArr[i]     = 0.8 + Math.random() * 2.7;
      lifeArr[i]        = Math.random() * maxLifeArr[i]; // stagger so they don't all blink in sync
      sizeArr[i]        = 12 + Math.random() * 43;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── BufferGeometry (created once, attributes updated in useFrame) ──────────
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position",     new THREE.BufferAttribute(posArr,     3));
    geo.setAttribute("aLifetime",    new THREE.BufferAttribute(lifeArr,    1));
    geo.setAttribute("aMaxLifetime", new THREE.BufferAttribute(maxLifeArr, 1));
    geo.setAttribute("aSize",        new THREE.BufferAttribute(sizeArr,    1));
    geo.setDrawRange(0, MAX_COUNT);
    return geo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ShaderMaterial ─────────────────────────────────────────────────────────
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent:    true,
        depthWrite:     false,
        blending:       THREE.AdditiveBlending,
        vertexShader:   VERT,
        fragmentShader: FRAG,
        uniforms: {
          uColor:        { value: new THREE.Color("#c8f0ff") },
          uIntensity:    { value: 3.0 },
          uArmSharpness: { value: 14.0 },
          uArmFalloff:   { value: 1.2 },
          uGlowRadius:   { value: 3.5 },
        },
      }),
    []
  );

  useFrame(({ camera }, delta) => {
    // Sync Leva → uniforms
    material.uniforms.uColor.value.set(color);
    material.uniforms.uIntensity.value    = intensity;
    material.uniforms.uArmSharpness.value = armSharpness;
    material.uniforms.uArmFalloff.value   = armFalloff;
    material.uniforms.uGlowRadius.value   = glowRadius;

    // Only draw `count` particles
    geometry.setDrawRange(0, count);

    const posAttr     = geometry.getAttribute("position")     as THREE.BufferAttribute;
    const lifeAttr    = geometry.getAttribute("aLifetime")    as THREE.BufferAttribute;
    const maxLifeAttr = geometry.getAttribute("aMaxLifetime") as THREE.BufferAttribute;
    const sizeAttr    = geometry.getAttribute("aSize")        as THREE.BufferAttribute;

    const waterY = -0.1 + heightOffset;

    for (let i = 0; i < count; i++) {
      lifeArr[i] += delta;

      // Fix Y in case heightOffset changed
      posArr[i * 3 + 1] = waterY;

      if (lifeArr[i] >= maxLifeArr[i]) {
        // Respawn at random offset from camera XZ
        posArr[i * 3]     = camera.position.x + (Math.random() - 0.5) * spread * 2;
        posArr[i * 3 + 1] = waterY;
        posArr[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * spread * 2;
        lifeArr[i]        = 0;
        maxLifeArr[i]     = minLife + Math.random() * (maxLife - minLife);
        sizeArr[i]        = minSize + Math.random() * (maxSize - minSize);
      }
    }

    posAttr.needsUpdate     = true;
    lifeAttr.needsUpdate    = true;
    maxLifeAttr.needsUpdate = true;
    sizeAttr.needsUpdate    = true;
  });

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={3}>
      <primitive object={material} attach="material" />
    </points>
  );
}
