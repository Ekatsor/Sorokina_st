import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT_FAMILY } from "../font";

export const BrandMark: React.FC = () => (
  <AbsoluteFill
    style={{
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "flex-end",
      padding: 64,
      pointerEvents: "none",
    }}
  >
    <span
      style={{
        fontFamily: FONT_FAMILY,
        fontSize: 22,
        fontWeight: 200,
        color: "rgba(255,255,255,0.18)",
        letterSpacing: "0.4em",
        textTransform: "uppercase",
      }}
    >
      sorokina.st
    </span>
  </AbsoluteFill>
);
