import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Sequence,
  continueRender,
  delayRender,
  useVideoConfig,
} from "remotion";
import { Background } from "./components/Background";
import { BrandMark } from "./components/BrandMark";
import { CaptionOverlay } from "./components/CaptionOverlay";
import { CTASlide } from "./components/CTASlide";
import { MediaClip } from "./components/MediaClip";
import { SpokenLineOverlay } from "./components/SpokenLineOverlay";
import { Vignette } from "./components/Vignette";
import { FONT_FAMILY, waitForFont } from "./font";
import type { ReelScript } from "./types";

export const ReelComposition: React.FC<ReelScript> = ({
  theme,
  format,
  duration,
  tone,
  spokenLines,
  frames,
  cta,
}) => {
  const { fps } = useVideoConfig();

  // Ensure font is loaded before rendering frames (important for render; harmless in Studio)
  const [fontHandle] = useState(() => delayRender("Loading Montserrat font"));
  useEffect(() => {
    // Continue rendering even if the web font can't be fetched (offline / CDN
    // hiccup) — fall back to the system font instead of failing the render.
    waitForFont()
      .then(() => continueRender(fontHandle))
      .catch(() => continueRender(fontHandle));
  }, [fontHandle]);

  const toFrames = (sec: number) => Math.round(sec * fps);
  const ctaStartFrame = toFrames(duration - 3);

  return (
    <AbsoluteFill
      style={{ backgroundColor: "#0a0a0a", fontFamily: FONT_FAMILY }}
    >
      <Background />

      {/* Video clip placeholders */}
      {frames.map((seg, i) => {
        const dur = Math.max(1, toFrames(seg.endSec - seg.startSec));
        return (
          <Sequence
            key={`clip-${i}`}
            from={toFrames(seg.startSec)}
            durationInFrames={dur}
            layout="none"
          >
            <MediaClip
              src={seg.src}
              kind={seg.kind}
              clipIndex={seg.clipIndex}
              clipNumber={i + 1}
              totalClips={frames.length}
              theme={theme}
              format={format}
            />
          </Sequence>
        );
      })}

      <Vignette />

      {/* B-roll captions */}
      {frames.map((seg, i) =>
        seg.caption ? (
          <Sequence
            key={`caption-${i}`}
            from={toFrames(seg.startSec)}
            durationInFrames={Math.max(1, toFrames(seg.endSec - seg.startSec))}
            layout="none"
          >
            <CaptionOverlay text={seg.caption} />
          </Sequence>
        ) : null,
      )}

      {/* Spoken line subtitles */}
      {spokenLines.map((line, i) => (
        <Sequence
          key={`line-${i}`}
          from={toFrames(line.startSec)}
          durationInFrames={Math.max(1, toFrames(line.endSec - line.startSec))}
          layout="none"
        >
          <SpokenLineOverlay text={line.text} tone={tone} />
        </Sequence>
      ))}

      {/* CTA — last 3 seconds */}
      <Sequence
        from={ctaStartFrame}
        durationInFrames={3 * fps}
        layout="none"
      >
        <CTASlide text={cta} />
      </Sequence>

      <BrandMark />
    </AbsoluteFill>
  );
};
