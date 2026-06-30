import React from "react";
import { AbsoluteFill } from "remotion";

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 100%)",
      pointerEvents: "none",
    }}
  />
);
