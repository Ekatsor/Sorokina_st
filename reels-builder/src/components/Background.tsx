import React from "react";
import { AbsoluteFill } from "remotion";

export const Background: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at 50% 38%, #181818 0%, #0a0a0a 65%, #050505 100%)",
    }}
  />
);
