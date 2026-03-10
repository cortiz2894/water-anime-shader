import { useControls, folder } from "leva";

export function useWaterSparklesControls() {
  return useControls(
    "Water Sparkles",
    {
      count:        { value: 100,  min: 0,   max: 500, step: 1,    label: "Count" },
      spread:       { value: 40,   min: 5,   max: 120, step: 1,    label: "Spread Radius" },
      heightOffset: { value: 0.97, min: 0,   max: 2,   step: 0.01, label: "Height Offset" },
      Size: folder({
        minSize: { value: 3, min: 1, max: 150, step: 1, label: "Min Size" },
        maxSize: { value: 6, min: 1, max: 300, step: 1, label: "Max Size" },
      }, { collapsed: false }),
      Lifetime: folder({
        minLife: { value: 0.7, min: 0.1, max: 10,  step: 0.1, label: "Min Life (s)" },
        maxLife: { value: 2.8, min: 0.1, max: 15,  step: 0.1, label: "Max Life (s)" },
      }, { collapsed: false }),
      Appearance: folder({
        color:        { value: "#e5d2d2",                             label: "Color" },
        intensity:    { value: 1.8,  min: 0.1, max: 15,  step: 0.1,  label: "Intensity" },
        armSharpness: { value: 27.0, min: 1,   max: 40,  step: 0.5,  label: "Arm Sharpness" },
        armFalloff:   { value: 4.8,  min: 0.1, max: 8,   step: 0.1,  label: "Arm Falloff" },
        glowRadius:   { value: 12,   min: 0.5, max: 12,  step: 0.1,  label: "Glow Radius" },
      }, { collapsed: true }),
    },
    { collapsed: true }
  );
}
