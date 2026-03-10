import { useControls } from "leva";

export function useWaterFloorControls() {
  return useControls(
    "Water Floor",
    {
      waterScale:     { value: 0.23,  min: 0.01, max: 1.5,  step: 0.01,  label: "Scale" },
      cellSmoothness: { value: 0.46,  min: 0,    max: 2,    step: 0.01,  label: "Cell Smoothness" },
      edgeThreshold:  { value: 0.09,  min: 0,    max: 0.3,  step: 0.005, label: "Edge Threshold" },
      edgeSoftness:   { value: 0.10,  min: 0,    max: 0.1,  step: 0.005, label: "Edge Softness" },
      flowX:          { value: 0.07,  min: -0.5, max: 0.5,  step: 0.01,  label: "Flow X" },
      flowZ:          { value: -0.23, min: -0.5, max: 0.5,  step: 0.01,  label: "Flow Z" },
      cellSpeed:      { value: 0.55,  min: 0,    max: 3,    step: 0.05,  label: "Cell Anim Speed" },
      noiseScale:     { value: 0.87,  min: 0.1,  max: 10,   step: 0.01,  label: "Noise Scale" },
      noiseFlowSpeed: { value: 0.11,  min: 0,    max: 2,    step: 0.01,  label: "Noise Flow Speed" },
      distortAmount:  { value: 0.26,  min: 0,    max: 3,    step: 0.01,  label: "Distort Amount" },
      deepColor:      { value: "#27a3d8",                                  label: "Deep Color" },
      midColor:       { value: "#59c0e8",                                  label: "Mid Color" },
      midPos:         { value: 0.31,  min: 0.001, max: 0.999, step: 0.001, label: "Mid Pos" },
      highlightColor: { value: "#ffffff",                                  label: "Highlight Color" },
      opacity:        { value: 1.0,   min: 0,    max: 1,    step: 0.01,  label: "Opacity" },
      deepOpacity:    { value: 0.37,  min: 0,    max: 1,    step: 0.01,  label: "Deep Opacity" },
      fadeDistance:   { value: 275,   min: 10,   max: 300,  step: 5,     label: "Fade Distance" },
      fadeStrength:   { value: 1.3,   min: 0.1,  max: 5,    step: 0.1,   label: "Fade Strength" },
    },
    { collapsed: true }
  );
}
