import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ClipSlot } from "./ClipSlot";
import type { Format, Theme } from "../types";

interface MediaClipProps {
  // real media (optional) — falls back to the placeholder when absent
  src?: string;
  kind?: "video" | "photo";
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
  clipIndex,
  clipNumber,
  totalClips,
  theme,
  format,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

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

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  if (isPhoto) {
    // Slow Ken Burns zoom so a still photo feels alive
    const scale = interpolate(frame, [0, durationInFrames], [1.06, 1.16], {
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

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#050505" }}>
      <OffthreadVideo
        src={url}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};
