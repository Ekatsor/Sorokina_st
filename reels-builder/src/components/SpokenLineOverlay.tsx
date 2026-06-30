import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY } from "../font";
import type { Tone } from "../types";

interface SpokenLineOverlayProps {
  text: string;
  tone: Tone;
}

export const SpokenLineOverlay: React.FC<SpokenLineOverlayProps> = ({
  text,
  tone,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 7, 16, 20], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, 9], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slightly larger font for lively tone
  const fontSize = tone === "lively-humor" ? 60 : 56;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 240,
        paddingLeft: 80,
        paddingRight: 80,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          textAlign: "center",
        }}
      >
        {/* Thin editorial mark */}
        <div
          style={{
            width: 28,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.38)",
          }}
        />
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize,
            fontWeight: 200,
            color: "#ffffff",
            lineHeight: 1.38,
            letterSpacing: "0.02em",
            textShadow:
              "0 2px 36px rgba(0,0,0,0.98), 0 1px 10px rgba(0,0,0,0.85)",
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
