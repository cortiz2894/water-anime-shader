"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useControls, folder } from "leva";
import * as THREE from "three";
import { dragonBallsStore } from "../../dragonBallsStore";

// ─────────────────────────────────────────────────────────────────────────────
// WaterDepthIntersection  — Part 1 of the Dynamic Paint–style wave system.
//
// TECHNIQUE: Screen-space depth intersection
//
//   Each frame, the DragonBalls geometry is rendered into a depth-only render
//   target using the main camera.  A fullscreen plane sitting at the water
//   surface (Y ≈ -0.1) then reads that depth texture.  For each fragment:
//
//     • gl_FragCoord.z   → depth of the water surface at this screen pixel
//     • texture(depthTex) → depth of the nearest DragonBalls surface
//
//   Both values are linearised to world-space units (metres from camera).
//   Where the difference is small the mesh is crossing the water plane.
//   That "crossing" is drawn as:
//     - A sharp white line  (the exact silhouette intersection)
//     - A soft blue halo    (like the ambient glow in the Blender image)
//
//   This intersection mask is the foundation for Part 2 (ping-pong wave sim).
//
// WHY THIS IS CORRECT
//   The depth comparison happens in screen space, so it automatically accounts
//   for the exact 3-D geometry — no approximations, no silhouette renders, no
//   analytical sphere math.  The orange outline in Blender's Dynamic Paint is
//   exactly what this technique produces.
// ─────────────────────────────────────────────────────────────────────────────

// ── Intersection plane shaders ────────────────────────────────────────────────
const VERT = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
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

export default function WaterDepthIntersection() {
  const { size } = useThree();
  const { nodes } = useGLTF("/assets/dragon-balls-model.glb") as {
    nodes: Record<string, THREE.Mesh>;
  };
  const planeRef = useRef<THREE.Mesh>(null!);

  // ── Leva controls ─────────────────────────────────────────────────────────
  const { enabled, lineWidth, glowWidth, lineColor, lineOpacity, glowColor, glowOpacity } =
    useControls(
      "Intersection",
      {
        enabled:   { value: true, label: "Enabled" },
        lineWidth: { value: 0.25, min: 0.01, max: 3.0, step: 0.01, label: "Line Width (world)" },
        glowWidth: { value: 1.2,  min: 0.1,  max: 10,  step: 0.1,  label: "Glow Width (world)" },
        Line: folder({
          lineColor:   { value: "#ffffff", label: "Color" },
          lineOpacity: { value: 1.0, min: 0, max: 1, step: 0.01, label: "Opacity" },
        }, { collapsed: false }),
        Glow: folder({
          glowColor:   { value: "#88ccff", label: "Color" },
          glowOpacity: { value: 0.25, min: 0, max: 1, step: 0.01, label: "Opacity" },
        }, { collapsed: false }),
      },
      { collapsed: true }
    );

  // ── Depth render target (matches canvas resolution) ───────────────────────
  // Recreated when canvas resizes so screenUV maths stay exact.
  const depthRT = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(size.width, size.height);
    rt.depthTexture = new THREE.DepthTexture(size.width, size.height);
    rt.depthTexture.type = THREE.UnsignedShortType;
    return rt;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  useEffect(() => () => { depthRT.dispose(); }, [depthRT]);

  // ── Depth scene — DragonBalls geometry only, plain material ──────────────
  // Only the meshes that should create intersection glows live here.
  // Using the same BufferGeometry refs (cached by useGLTF) — no extra load.
  const { depthScene, depthGroup } = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
    const depthGroup = new THREE.Group();
    depthGroup.add(
      new THREE.Mesh(nodes.Object_0.geometry,   mat),
      new THREE.Mesh(nodes.Object_0_2.geometry, mat),
    );
    const depthScene = new THREE.Scene();
    depthScene.add(depthGroup);
    return { depthScene, depthGroup };
  }, [nodes]);

  // ── Intersection plane material ───────────────────────────────────────────
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: {
      uDepthTex:    { value: null },
      uResolution:  { value: new THREE.Vector2(size.width, size.height) },
      uNear:        { value: 0.1 },
      uFar:         { value: 1000 },
      uLineWidth:   { value: 0.25 },
      uGlowWidth:   { value: 1.2 },
      uLineColor:   { value: new THREE.Color("#ffffff") },
      uLineOpacity: { value: 1.0 },
      uGlowColor:   { value: new THREE.Color("#88ccff") },
      uGlowOpacity: { value: 0.25 },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => () => { material.dispose(); }, [material]);

  // ── Per-frame: depth pre-pass + uniform sync ──────────────────────────────
  useFrame(({ gl, camera, size: frameSize }) => {
    const store = dragonBallsStore;

    // 1. Sync depth scene group to current DragonBalls transform
    depthGroup.position.set(store.posX, store.posY, store.posZ);
    depthGroup.rotation.set(0, store.rotY, 0);
    depthGroup.scale.setScalar(store.scale);

    if (enabled) {
      // 2. Render depth scene to RT using the same camera as the main scene.
      //    autoClear=true means Three.js clears color+depth before rendering,
      //    so empty pixels get depth=1.0 (far plane).
      const prevRT         = gl.getRenderTarget();
      const prevAutoClear  = gl.autoClear;
      gl.autoClear = true;
      gl.setRenderTarget(depthRT);
      gl.render(depthScene, camera);
      gl.setRenderTarget(prevRT);
      gl.autoClear = prevAutoClear;
    }

    // 3. Sync uniforms to intersection plane shader
    const u = material.uniforms;
    u.uDepthTex.value    = depthRT.depthTexture;
    u.uResolution.value.set(frameSize.width, frameSize.height);
    u.uNear.value        = camera.near;
    u.uFar.value         = camera.far;
    u.uLineWidth.value   = lineWidth;
    u.uGlowWidth.value   = glowWidth;
    u.uLineColor.value.set(lineColor);
    u.uLineOpacity.value = lineOpacity;
    u.uGlowColor.value.set(glowColor);
    u.uGlowOpacity.value = glowOpacity;
  });

  return (
    <mesh
      ref={planeRef}
      visible={enabled}
      rotation-x={-Math.PI / 2}
      position={[0, -0.095, 0]}
      renderOrder={5}
      frustumCulled={false}
    >
      <planeGeometry args={[600, 600]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

useGLTF.preload("/assets/dragon-balls-model.glb");
