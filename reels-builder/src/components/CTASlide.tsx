import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY } from "../font";

interface CTASlideProps {
  text: string;
}

export const CTASlide: React.FC<CTASlideProps> = ({ text }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });

  const contentScale = interpolate(frame, [0, 18], [0.97, 1.0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "rgba(6, 6, 6, 0.9)",
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${contentScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          padding: "0 110px",
          textAlign: "center",
        }}
      >
        {/* Brand name */}
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 24,
            fontWeight: 200,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.55em",
            textTransform: "uppercase",
          }}
        >
          Sorokina ST
        </div>

        {/* Divider */}
        <div
          style={{
            width: 72,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.25)",
          }}
        />

        {/* CTA */}
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 52,
            fontWeight: 300,
            color: "#ffffff",
            lineHeight: 1.45,
            letterSpacing: "0.025em",
          }}
        >
          {text}
        </div>

        {/* Handle */}
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 30,
            fontWeight: 200,
            color: "rgba(255,255,255,0.32)",
            letterSpacing: "0.18em",
            textTransform: "lowercase",
          }}
        >
          @sorokina_st
        </div>
      </div>
    </AbsoluteFill>
  );
};
