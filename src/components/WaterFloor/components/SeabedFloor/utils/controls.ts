import { useControls } from "leva";

export function useSeabedControls() {
  return useControls(
    "Seabed",
    {
      seabedDepth:    { value: -1.6,  min: -10,  max: -0.5, step: 0.1,   label: "Depth Y" },
      seabedScale:    { value: 0.16,  min: 0.01, max: 1.0,  step: 0.01,  label: "Scale" },
      cellSpeed:      { value: 0.49,  min: 0,    max: 2,    step: 0.01,  label: "Cell Speed" },
      flowX:          { value: 0.0,   min: -0.5, max: 0.5,  step: 0.005, label: "Flow X" },
      flowZ:          { value: -0.11, min: -0.5, max: 0.5,  step: 0.005, label: "Flow Z" },
      edgeThreshold:  { value: 0.06,  min: 0,    max: 0.3,  step: 0.005, label: "Edge Threshold" },
      edgeSoftness:   { value: 0.03,  min: 0,    max: 0.1,  step: 0.005, label: "Edge Softness" },
      deepColor:      { value: "#1aaae8",                                  label: "Deep Color" },
      highlightColor: { value: "#177096",                                  label: "Highlight Color" },
      fadeDistance:   { value: 250,   min: 10,   max: 300,  step: 5,     label: "Fade Distance" },
      fadeStrength:   { value: 2,     min: 0.1,  max: 5,    step: 0.1,   label: "Fade Strength" },
    },
    { collapsed: true }
  );
}
