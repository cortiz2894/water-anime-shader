"use client";

import type { SceneMode } from "@/components/playground/SceneContent";

export default function OverlayHeader({ mode }: { mode: SceneMode }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  const dark = mode === "Background";

  return (
    <div style={{ position: "absolute", top: 24, left: 28, maxWidth: 320 }}>
      {/* Classification label */}
      <div
        style={{
          fontFamily: "var(--font-ibm-mono), monospace",
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: dark ? "#2a2a2a" : "var(--color-accent-dim, #9a8e78)",
          marginBottom: 6,
        }}
      >
        OPEN SOURCE WORKSPACE
      </div>

      {/* Horizontal rule */}
      <div
        style={{
          height: 1,
          background: dark ? "#3a3a3a" : "var(--color-border-light, #5c5854)",
          marginBottom: 10,
          opacity: 0.6,
        }}
      />

      {/* Title */}
      <h1
        style={{
          fontFamily: "var(--font-bebas), sans-serif",
          fontSize: 42,
          lineHeight: 1,
          letterSpacing: "0.05em",
          color: dark ? "#111111" : "var(--color-white, #f0ece6)",
          margin: 0,
        }}
      >
        WATER ANIME STYLE
      </h1>

      {/* Designation subtitle */}
      <div
        style={{
          fontFamily: "var(--font-barlow), sans-serif",
          fontSize: 13,
          fontWeight: 300,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: dark ? "#3a3a3a" : "var(--color-text-muted, #8a847a)",
          marginTop: 4,
        }}
      >
         Water caustics with object intersaction
      </div>

      {/* Rev / Date metadata */}
      <div
        style={{
          fontFamily: "var(--font-ibm-mono), monospace",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: dark ? "#2a2a2a" : "var(--color-accent-dim, #9a8e78)",
          marginTop: 12,
          opacity: 0.7,
        }}
      >
        V 1.01 &mdash; {dateStr.toUpperCase()} &mdash; R3F / DREI / LEVA
      </div>
    </div>
  );
}
