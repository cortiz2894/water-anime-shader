"use client";

import { useRef, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useControls, folder } from "leva";
import * as THREE from "three";
import type { Group } from "three";
import { useWaterObject } from "../../hooks/useWaterObject";

// ─────────────────────────────────────────────────────────────────────────────
// GlassBall ShaderMaterial
//
// Calculates the water line in world space (vWorldPos.y vs uWaterY) so a
// half-submerged sphere shows the exact cut, regardless of what is behind it
// or the render order of other objects.
//
// Above water  → Fresnel glass look (semi-transparent, tinted rim)
// Water line   → Animated wavy cut + subtle foam highlight
// Below water  → Tinted with water deep color, more opaque
//
// Roughness → perturbs N with hash-based noise → frosted/ground-glass look
// ─────────────────────────────────────────────────────────────────────────────

const GLASS_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos     = worldPos.xyz;
    vNormal       = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position   = projectionMatrix * viewMatrix * worldPos;
  }
`;

const GLASS_FRAG = /* glsl */ `
  #include <common>

  uniform float uTime;
  uniform float uWaterY;
  uniform float uWaterLineSoftness;
  uniform float uWaterLineWave;
  uniform vec3  uWaterLineColor;
  uniform vec3  uGlassColor;
  uniform float uGlassOpacity;
  uniform vec3  uUnderwaterColor;
  uniform float uUnderwaterOpacity;
  uniform float uFresnelPower;
  uniform float uFresnelStrength;
  uniform vec3  uFresnelColor;
  uniform float uRoughness;

  varying vec3 vWorldPos;
  varying vec3 vNormal;

  // ── Hash-based smooth noise for normal perturbation ──────────────────────
  vec3 hash3(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yzx + 19.19);
    return fract((p.xxy + p.yzz) * p.zyx) * 2.0 - 1.0;
  }

  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
              dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
          mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
              dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
      mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
              dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
          mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
              dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y),
      u.z
    );
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 N       = normalize(vNormal);

    // ── Roughness: perturb N with layered noise (frosted glass) ─────────────
    if (uRoughness > 0.001) {
      vec3 np = vWorldPos * 6.0;
      vec3 d  = vec3(vnoise(np), vnoise(np + vec3(1.7, 9.2, 3.8)), vnoise(np + vec3(8.3, 2.8, 5.1)));
      d += 0.4 * vec3(vnoise(np * 2.3 + vec3(4.1)), vnoise(np * 2.3 + vec3(2.9, 1.4, 7.3)), vnoise(np * 2.3 + vec3(6.7, 3.1, 1.8)));
      N = normalize(N + d * uRoughness * 0.8);
    }

    // Fresnel: rim glows toward edges
    float NdotV   = max(dot(N, viewDir), 0.0);
    float fresnel = clamp(pow(1.0 - NdotV, uFresnelPower) * uFresnelStrength, 0.0, 1.0);

    // Animated water line: wavy Y threshold matching water surface motion
    float wave  = sin(vWorldPos.x * 4.0 + uTime * 2.5) * uWaterLineWave
                + cos(vWorldPos.z * 3.5 + uTime * 1.8) * uWaterLineWave * 0.6;
    float waterY = uWaterY + wave;

    // Submersion factor: 0 = above water, 1 = below water
    float sub = 1.0 - smoothstep(
      waterY - uWaterLineSoftness,
      waterY + uWaterLineSoftness,
      vWorldPos.y
    );

    // Waterline foam glow at the intersection band
    float wlDist = abs(vWorldPos.y - waterY) / max(uWaterLineSoftness * 2.5, 0.001);
    float wlGlow = exp(-wlDist * wlDist) * 0.7;

    // Above-water: glass tint + Fresnel rim color
    vec3  aboveColor = mix(uGlassColor, uFresnelColor, fresnel * 0.6);
    float aboveAlpha = mix(uGlassOpacity, min(uGlassOpacity + 0.35, 1.0), fresnel);

    // Below-water: deep tint, slightly more opaque
    vec3  belowColor = mix(uUnderwaterColor, uGlassColor, 0.25 + fresnel * 0.2);
    float belowAlpha = uUnderwaterOpacity;

    vec3  color = mix(aboveColor, belowColor, sub);
    float alpha = mix(aboveAlpha, belowAlpha, sub);

    // Add waterline foam highlight
    color = mix(color, uWaterLineColor, wlGlow * 0.5);
    alpha = max(alpha, wlGlow * 0.6);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function DragonBalls() {
  const { nodes, materials } = useGLTF("/assets/dragon-balls-model.glb") as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.Material>;
  };
  const groupRef = useRef<Group>(null!);

  // Clone Star material so we don't mutate the shared GLTF cache
  const starMat = useMemo(() => {
    const mat = (materials.Star as THREE.MeshStandardMaterial).clone();
    return mat;
  }, [materials.Star]);

  useEffect(() => () => starMat.dispose(), [starMat]);

  // ── Leva controls ──────────────────────────────────────────────────────────
  const { posX, posY, posZ, scale, starColor, starEmissive, starEmissiveIntensity } = useControls(
    "Dragon Balls",
    {
      Position: folder({
        posX: { value: 0.25,  min: -20, max: 20, step: 0.05, label: "X" },
        posY: { value: 1.10,  min: -5,  max: 10, step: 0.05, label: "Y" },
        posZ: { value: -1.80, min: -20, max: 20, step: 0.05, label: "Z" },
      }, { collapsed: false }),
      scale: { value: 5.15, min: 0.1, max: 15, step: 0.05, label: "Scale" },
      Stars: folder({
        starColor:             { value: "#ffffff",  label: "Color" },
        starEmissive:          { value: "#ffffff",  label: "Emissive" },
        starEmissiveIntensity: { value: 7.0, min: 0, max: 10, step: 0.1, label: "Emissive Intensity" },
      }, { collapsed: false }),
    },
    { collapsed: false }
  );

  const {
    glassColor, glassOpacity,
    underwaterColor, underwaterOpacity,
    fresnelPower, fresnelStrength, fresnelColor,
    roughness,
    waterLineSoftness, waterLineWave, waterLineColor,
  } = useControls(
    "Glass Ball",
    {
      Glass: folder({
        glassColor:   { value: "#de7d2f",  label: "Glass Color" },
        glassOpacity: { value: 0.85, min: 0, max: 1, step: 0.01, label: "Opacity (above)" },
      }, { collapsed: false }),
      Underwater: folder({
        underwaterColor:   { value: "#00121d",  label: "Underwater Color" },
        underwaterOpacity: { value: 0.81, min: 0, max: 1, step: 0.01, label: "Opacity (below)" },
      }, { collapsed: false }),
      Fresnel: folder({
        fresnelPower:    { value: 2.7,       min: 0.5, max: 8,  step: 0.1,  label: "Power" },
        fresnelStrength: { value: 3.65,       min: 1,   max: 5,  step: 0.05, label: "Strength" },
        fresnelColor:    { value: "#ffc900",                                 label: "Rim Color" },
      }, { collapsed: true }),
      Roughness: folder({
        roughness: { value: 0.0, min: 0, max: 1, step: 0.01, label: "Roughness (0 = shiny glass)" },
      }, { collapsed: true }),
      "Water Line": folder({
        waterLineSoftness: { value: 0.02, min: 0.005, max: 0.5, step: 0.005, label: "Softness" },
        waterLineWave:     { value: 0.04, min: 0,     max: 0.2, step: 0.005, label: "Wave Amount" },
        waterLineColor:    { value: "#a8e8ff",                               label: "Foam Color" },
      }, { collapsed: true }),
    },
    { collapsed: true }
  );

  // ── Custom ShaderMaterial (created once, synced in useFrame) ───────────────
  const glassMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader:   GLASS_VERT,
        fragmentShader: GLASS_FRAG,
        transparent:    true,
        depthWrite:     true,
        side:           THREE.FrontSide,
        uniforms: {
          uTime:              { value: 0 },
          uWaterY:            { value: -0.1 },
          uWaterLineSoftness: { value: 0.02 },
          uWaterLineWave:     { value: 0.04 },
          uWaterLineColor:    { value: new THREE.Color("#a8e8ff") },
          uGlassColor:        { value: new THREE.Color("#ff6900") },
          uGlassOpacity:      { value: 0.72 },
          uUnderwaterColor:   { value: new THREE.Color("#55afeb") },
          uUnderwaterOpacity: { value: 0.81 },
          uFresnelPower:      { value: 4.3 },
          uFresnelStrength:   { value: 3.0 },
          uFresnelColor:      { value: new THREE.Color("#ffe083") },
          uRoughness:         { value: 0.0 },
        },
      }),
    []
  );

  useEffect(() => () => glassMat.dispose(), [glassMat]);

  // ── Register with water effects (depth intersection + wave simulation) ────
  useWaterObject("dragon-balls", groupRef, [
    nodes.Object_0.geometry,
    nodes.Object_0_2.geometry,
  ]);

  useFrame(({ clock }) => {
    // ── Sync Star material ─────────────────────────────────────────────────
    starMat.color.set(starColor);
    starMat.emissive.set(starEmissive);
    starMat.emissiveIntensity = starEmissiveIntensity;

    // ── Sync shader uniforms ───────────────────────────────────────────────
    const u = glassMat.uniforms;
    u.uTime.value              = clock.getElapsedTime();
    u.uGlassColor.value.set(glassColor);
    u.uGlassOpacity.value      = glassOpacity;
    u.uUnderwaterColor.value.set(underwaterColor);
    u.uUnderwaterOpacity.value = underwaterOpacity;
    u.uFresnelPower.value      = fresnelPower;
    u.uFresnelStrength.value   = fresnelStrength;
    u.uFresnelColor.value.set(fresnelColor);
    u.uRoughness.value         = roughness;
    u.uWaterLineSoftness.value = waterLineSoftness;
    u.uWaterLineWave.value     = waterLineWave;
    u.uWaterLineColor.value.set(waterLineColor);
  });

  return (
    <group
      ref={groupRef}
      position={[posX, posY, posZ]}
      rotation={[0, -2.7, 0]}
      scale={scale}
      dispose={null}
    >
      {/* Opaque rock base */}
      <mesh castShadow  geometry={nodes.Object_0_2.geometry}
      material={materials.DefaultMaterial} />

      {/* Stars — cloned material with Leva color + emissive controls */}
      <mesh geometry={nodes.Object_0_1.geometry} material={starMat} />

      {/* Glass spheres — custom shader with world-space water line */}
      <mesh castShadow renderOrder={1} geometry={nodes.Object_0.geometry} material={glassMat} />
    </group>
  );
}

useGLTF.preload("/assets/dragon-balls-model.glb");
