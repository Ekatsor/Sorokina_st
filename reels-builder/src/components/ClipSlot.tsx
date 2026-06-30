import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY } from "../font";
import type { Format, Theme } from "../types";

const THEME_TINTS: Record<Theme, string> = {
  laser: "rgba(18, 26, 48, 0.92)",
  pdrn: "rgba(8, 24, 18, 0.92)",
  biorevitalization: "rgba(18, 10, 32, 0.92)",
  peelings: "rgba(28, 20, 8, 0.92)",
  cleansing: "rgba(12, 18, 26, 0.92)",
  wax: "rgba(26, 10, 16, 0.92)",
  retention: "rgba(8, 22, 22, 0.92)",
  personal: "rgba(14, 14, 14, 0.92)",
};

const THEME_LABELS: Record<Theme, string> = {
  laser: "Лазерная эпиляция",
  pdrn: "PDRN-терапия",
  biorevitalization: "Биоревитализация",
  peelings: "Пилинги",
  cleansing: "Чистка лица",
  wax: "Восковая эпиляция",
  retention: "Возврат клиентов",
  personal: "Личное / Экспертность",
};

const FORMAT_LABELS: Record<Format, string> = {
  "talking-head-broll": "Говорящая голова + B-roll",
  "process-captions": "Процесс под титры",
  "client-story": "История клиента",
  "behind-scenes": "Закулисье",
  "expert-observation": "Экспертное наблюдение",
  "soft-sell": "Мягкая продажа",
};

interface ClipSlotProps {
  clipIndex: number;
  clipNumber: number;
  totalClips: number;
  theme: Theme;
  format: Format;
}

export const ClipSlot: React.FC<ClipSlotProps> = ({
  clipIndex,
  clipNumber,
  totalClips,
  theme,
  format,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(155deg, ${THEME_TINTS[theme]} 0%, #050505 85%)`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Clip counter — top left */}
      <div
        style={{
          position: "absolute",
          top: 88,
          left: 88,
          fontFamily: FONT_FAMILY,
          fontSize: 26,
          fontWeight: 200,
          color: "rgba(255,255,255,0.22)",
          letterSpacing: "0.25em",
        }}
      >
        {String(clipNumber).padStart(2, "0")} /{" "}
        {String(totalClips).padStart(2, "0")}
      </div>

      {/* Subtle frame border */}
      <div
        style={{
          position: "absolute",
          inset: 64,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      />

      {/* Center content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
          textAlign: "center",
          padding: "0 130px",
        }}
      >
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 20,
            fontWeight: 200,
            color: "rgba(255,255,255,0.16)",
            letterSpacing: "0.45em",
            textTransform: "uppercase",
          }}
        >
          видео-заглушка
        </div>

        {/* Large ghost number */}
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 200,
            fontWeight: 200,
            color: "rgba(255,255,255,0.03)",
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          {clipIndex + 1}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 48,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.14)",
          }}
        />

        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 38,
            fontWeight: 300,
            color: "rgba(255,255,255,0.48)",
            letterSpacing: "0.04em",
          }}
        >
          {THEME_LABELS[theme]}
        </div>

        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 26,
            fontWeight: 200,
            color: "rgba(255,255,255,0.22)",
            letterSpacing: "0.06em",
          }}
        >
          {FORMAT_LABELS[format]}
        </div>
      </div>
    </AbsoluteFill>
  );
};
