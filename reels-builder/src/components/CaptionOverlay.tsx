import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY } from "../font";

interface CaptionOverlayProps {
  text: string;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({ text }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 14, 22, 28], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, 14], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        paddingBottom: 130,
        paddingLeft: 88,
        paddingRight: 88,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Editorial line above caption */}
        <div
          style={{
            width: 44,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.45)",
          }}
        />
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 38,
            fontWeight: 300,
            color: "rgba(255,255,255,0.88)",
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            textShadow: "0 2px 24px rgba(0,0,0,0.92)",
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
