import { useControls, folder } from "leva";

export function useWaterDepthIntersectionControls() {
  return useControls(
    "Intersection",
    {
      enabled:   { value: true,    label: "Enabled" },
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
}
