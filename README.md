# Anime Water Scene — Creative Boilerplate

An anime/cel-shaded water scene built with Next.js, Three.js, and React Three Fiber.
This repository showcases a real-time stylized water system inspired by Blender's Dynamic Paint workflow, recreated entirely in WebGL using custom GLSL shaders.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![Three.js](https://img.shields.io/badge/Three.js-0.182-black?style=flat-square&logo=three.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)

---

https://github.com/user-attachments/assets/063f030a-c19f-4286-bb16-bac2ad40eb06

---

## 🌊 WaterFloor System

The core of this project is the `WaterFloor` component — a modular, layered water rendering system composed of several independent passes that work together to produce the final anime water look.

### Architecture

```
src/components/WaterFloor/
├── index.tsx                        # Main water surface (Voronoi cel-shading + ripple rings)
├── useWaterRipple.ts                # Hook — attach to any object to emit water ripples
├── shaders/                         # WaterFloor GLSL shaders
├── utils/controls.ts                # Leva GUI controls
├── stores/
│   ├── rippleStore.ts               # Singleton — ripple event bus between components
│   └── dragonBallsStore.ts          # Singleton — shared transform state
├── models/
│   ├── DragonBalls/                 # Glass sphere model with custom water-line shader
│   └── Feather/                     # Feather model with bobbing animation + ripples
└── components/
    ├── SeabedFloor/                 # Animated Voronoi seabed (parallax depth layer)
    ├── ShadowCatcher/               # Receives shadows on the seabed plane
    ├── WaterSparkles/               # Procedural 4-pointed star particles on the surface
    ├── WaterDepthIntersection/      # Screen-space depth intersection glow
    └── WaterWaveSimulation/         # PDE-based ping-pong wave simulation
```

---

### Rendering Passes

#### 1. Seabed Floor (`SeabedFloor`)
An animated Voronoi pattern rendered below the water surface, visible through the transparent deep-color areas of the water. Slower cell movement than the surface creates a parallax depth illusion.

#### 2. Water Surface (`WaterFloor`)
Cel-shaded water using a **Voronoi F1 − SmoothF1** subtraction, replicating the Blender node graph approach in GLSL. World-space XZ coordinates keep the pattern anchored regardless of camera movement.

Features:
- 3-stop color ramp (deep → mid → highlight)
- Animated cell positions with noise-based UV distortion
- Hard-edged anime ripple rings driven by `rippleStore`
- Distance fade for infinite-floor look

#### 3. Water Depth Intersection (`WaterDepthIntersection`)
Screen-space depth comparison technique. The DragonBalls geometry is rendered into a depth-only render target each frame. A fullscreen plane at the water surface compares its own depth against the scene depth to detect geometry crossing the water plane, drawing:
- A sharp white silhouette line at the exact intersection
- A soft blue halo glow around it

DPR-aware: uses physical pixel dimensions so the effect stays aligned at any device pixel ratio.

#### 4. Wave Simulation (`WaterWaveSimulation`)
A three-pass GPU wave simulation per frame:

1. **Injection pass** — top-down orthographic render of the DragonBalls geometry clipped to a thin band around the water surface. Produces the exact waterline shape in simulation UV space.
2. **Wave update pass** (ping-pong) — runs the 2D wave PDE each frame:
   `h_next = 2·h_cur − h_prev + c²·∇²h`
   Absorbing boundaries prevent edge reflections.
3. **Display pass** — computes gradient magnitude of the height map; high gradient = ring edge, rendered as an additive overlay.

#### 5. Water Sparkles (`WaterSparkles`)
GPU particle system using `gl_PointCoord` to draw procedural 4-pointed star shapes — no textures required. Each particle fades in/out over its lifetime using a sine curve.

#### 6. Ripple System (`useWaterRipple`)
A composable hook that can be attached to any R3F object. Emits ripple events to `rippleStore` when the object enters the water (entry splash) and periodically while submerged. The water surface shader reads these events and renders concentric anime-style rings.

---

## 🛠 Tech Stack

| | |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **3D / WebGL** | Three.js, React Three Fiber, Drei |
| **Shaders** | Custom GLSL — Voronoi, Fresnel, PDE wave, depth intersection |
| **Animation** | GSAP |
| **GUI** | Leva |
| **Styling** | Tailwind CSS 4 |
| **Language** | TypeScript |

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/cortiz2894/creative-boilerplate.git

cd creative-boilerplate

pnpm install

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — the water scene loads on the main page.

---

## 👨‍💻 Author

**Christian Ortiz** — Creative Developer

## 🔗 Links

- **Portfolio:** [cortiz.dev](https://cortiz.dev)
- **YouTube:** [@cortizdev](https://youtube.com/@cortizdev)
- **X (Twitter):** [@cortiz2894](https://twitter.com/cortiz2894)
- **LinkedIn:** [Christian Daniel Ortiz](https://linkedin.com/in/christian-daniel-ortiz)

📬 For inquiries or collaborations: **cortiz2894@gmail.com**

---

⭐ If you found this useful, consider subscribing to my [YouTube channel](https://youtube.com/@cortizdev) for more creative development content!
