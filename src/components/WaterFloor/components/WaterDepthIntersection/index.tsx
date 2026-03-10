"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { waterObjectsRegistry } from "../../stores/waterObjectsRegistry";
import { VERT } from "./shaders/vertex";
import { FRAG } from "./shaders/fragment";
import { useWaterDepthIntersectionControls } from "./utils/controls";

// ─────────────────────────────────────────────────────────────────────────────
// WaterDepthIntersection  — Part 1 of the Dynamic Paint–style wave system.
//
// TECHNIQUE: Screen-space depth intersection
//
//   Each frame, registered geometry is rendered into a depth-only render
//   target using the main camera.  A fullscreen plane sitting at the water
//   surface (Y ≈ -0.1) then reads that depth texture.  For each fragment:
//
//     • gl_FragCoord.z    → depth of the water surface at this screen pixel
//     • texture(depthTex) → depth of the nearest registered geometry
//
//   Where the difference is small the mesh is crossing the water plane.
//   That "crossing" is drawn as a sharp white line + soft blue halo.
//
// HOW TO ADD A MODEL
//   Call useWaterObject(id, ref, geometries) in your model component.
//   This component will pick it up automatically — no changes needed here.
// ─────────────────────────────────────────────────────────────────────────────

export default function WaterDepthIntersection() {
  const { size, gl: glState } = useThree();
  const planeRef = useRef<THREE.Mesh>(null!);

  const { enabled, lineWidth, glowWidth, lineColor, lineOpacity, glowColor, glowOpacity } =
    useWaterDepthIntersectionControls();

  // ── Depth render target (physical pixels = CSS size × DPR) ───────────────
  const depthRT = useMemo(() => {
    const dpr = glState.getPixelRatio();
    const w   = Math.round(size.width  * dpr);
    const h   = Math.round(size.height * dpr);
    const rt  = new THREE.WebGLRenderTarget(w, h);
    rt.depthTexture      = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.UnsignedShortType;
    return rt;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, glState]);

  useEffect(() => () => { depthRT.dispose(); }, [depthRT]);

  // ── Depth scene — populated dynamically from waterObjectsRegistry ─────────
  const depthScene = useMemo(() => new THREE.Scene(), []);
  const depthMat   = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.FrontSide }), []);
  const sceneGroups = useRef(new Map<string, THREE.Group>());

  useEffect(() => () => { depthMat.dispose(); }, [depthMat]);

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

  // ── Per-frame: sync registry → depth scene, then render ──────────────────
  useFrame(({ gl, camera, size: frameSize }) => {
    const objects = waterObjectsRegistry.getAll();

    // Add groups for newly registered objects
    for (const obj of objects) {
      if (!obj.ref.current) continue;
      if (!sceneGroups.current.has(obj.id)) {
        const group = new THREE.Group();
        obj.geometries.forEach(geo => group.add(new THREE.Mesh(geo, depthMat)));
        depthScene.add(group);
        sceneGroups.current.set(obj.id, group);
      }
      const group = sceneGroups.current.get(obj.id)!;
      group.position.copy(obj.ref.current.position);
      group.rotation.copy(obj.ref.current.rotation);
      group.scale.copy(obj.ref.current.scale);
    }

    // Remove groups for unregistered objects
    for (const [id, group] of sceneGroups.current) {
      if (!objects.find(o => o.id === id)) {
        depthScene.remove(group);
        sceneGroups.current.delete(id);
      }
    }

    if (enabled) {
      const prevRT        = gl.getRenderTarget();
      const prevAutoClear = gl.autoClear;
      gl.autoClear = true;
      gl.setRenderTarget(depthRT);
      gl.render(depthScene, camera);
      gl.setRenderTarget(prevRT);
      gl.autoClear = prevAutoClear;
    }

    // Sync uniforms
    const u = material.uniforms;
    u.uDepthTex.value = depthRT.depthTexture;
    const dpr = gl.getPixelRatio();
    u.uResolution.value.set(frameSize.width * dpr, frameSize.height * dpr);
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
