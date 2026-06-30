import { loadFont } from "@remotion/google-fonts/Montserrat";

// Called at module level — Remotion handles async loading internally.
// Use waitForFont() + delayRender/continueRender if you need guaranteed
// font availability at render time (not required for Studio preview).
export const { waitUntilDone: waitForFont, fontFamily: FONT_FAMILY } = loadFont(
  "normal",
  {
    weights: ["200", "300", "400"],
    subsets: ["latin", "cyrillic"],
  },
);
