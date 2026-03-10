import { useControls, folder } from "leva";

export function useWaveSimulationControls() {
  return useControls(
    "Wave Simulation",
    {
      enabled: { value: true, label: "Enabled" },

      Propagation: folder({
        speed:       { value: 0.08,  min: 0.005,  max: 0.49,   step: 0.001,  label: "Wave Speed" },
        damping:     { value: 0.993, min: 0.90,   max: 0.9999, step: 0.0001, label: "Damping" },
        borderWidth: { value: 0.06,  min: 0.01,   max: 0.25,   step: 0.005,  label: "Border Absorption" },
      }, { collapsed: false }),

      Injection: folder({
        injectStr:      { value: 0.21, min: 0.0, max: 1.0, step: 0.01, label: "Strength" },
        injectAmp:      { value: 1,    min: 0.1, max: 1.0, step: 0.01, label: "Amplitude" },
        injectInterval: { value: 0.8,  min: 0.1, max: 5.0, step: 0.1,  label: "Interval (s)" },
        bandWidth:      { value: 5.0,  min: 0.1, max: 5.0, step: 0.1,  label: "Band Width (world)" },
      }, { collapsed: false }),

      Display: folder({
        gradScale:     { value: 1.0,  min: 0.5,  max: 60.0, step: 0.5,  label: "Grad Scale" },
        ringThreshold: { value: 0.54, min: 0.05, max: 1.0,  step: 0.01, label: "Ring Threshold" },
        edgeSharpness: { value: 0.91, min: 0.0,  max: 1.0,  step: 0.01, label: "Edge Sharpness (1=anime)" },
        waveSizeMul:   { value: 2.7,  min: 1.0,  max: 10.0, step: 0.1,  label: "Region Size (× scale)" },
        color:         { value: "#ffffff",                                label: "Color" },
        opacity:       { value: 0.75, min: 0.0,  max: 1.0,  step: 0.01, label: "Opacity" },
      }, { collapsed: false }),
    },
    { collapsed: true }
  );
}
