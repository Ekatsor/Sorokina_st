import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ClipSlot } from "./ClipSlot";
import type { Format, Theme } from "../types";

interface MediaClipProps {
  // real media (optional) — falls back to the placeholder when absent
  src?: string;
  kind?: "video" | "photo";
  // length of THIS clip's own Sequence, in frames — NOT the whole reel
  // (useVideoConfig().durationInFrames would give the whole-reel length,
  // which makes the zoom below imperceptible on short fast cuts)
  clipDurationInFrames: number;
  // placeholder props
  clipIndex: number;
  clipNumber: number;
  totalClips: number;
  theme: Theme;
  format: Format;
}

const resolveSrc = (src: string): string =>
  /^https?:\/\//.test(src) ? src : staticFile(src);

const looksLikePhoto = (src: string): boolean =>
  /\.(jpe?g|png|webp|gif|avif|heic)(\?|$)/i.test(src);

export const MediaClip: React.FC<MediaClipProps> = ({
  src,
  kind,
  clipDurationInFrames,
  clipIndex,
  clipNumber,
  totalClips,
  theme,
  format,
}) => {
  const frame = useCurrentFrame();

  // No real media → keep the branded placeholder
  if (!src) {
    return (
      <ClipSlot
        clipIndex={clipIndex}
        clipNumber={clipNumber}
        totalClips={totalClips}
        theme={theme}
        format={format}
      />
    );
  }

  const url = resolveSrc(src);
  const isPhoto = kind === "photo" || (!kind && looksLikePhoto(src));

  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  if (isPhoto) {
    // Punchy Ken Burns zoom sized to THIS clip's own on-screen time, so it
    // reads clearly even on a fast ~1s cut instead of barely moving.
    const scale = interpolate(frame, [0, clipDurationInFrames], [1.0, 1.12], {
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ opacity, backgroundColor: "#050505" }}>
        <Img
          src={url}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
          }}
        />
      </AbsoluteFill>
    );
  }

  // Same gentle punch-in on video clips so cuts feel alive even when the
  // source footage itself is fairly static in its first couple of seconds.
  const videoScale = interpolate(frame, [0, clipDurationInFrames], [1.0, 1.06], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#050505" }}>
      <OffthreadVideo
        src={url}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${videoScale})`,
        }}
      />
    </AbsoluteFill>
  );
};
