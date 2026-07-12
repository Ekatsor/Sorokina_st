import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Jost";
import { z } from "zod";

// Фирменный шрифт бренда — Jost (Latin & Кириллица).
const { fontFamily: FONT, waitUntilDone: waitForFont } = loadFont("normal", {
  weights: ["600", "700"],
  subsets: ["latin", "cyrillic"],
});

// Фирменный фиолетовый Sorokina (из бренд-палитры) — цвет ключевых слов.
const ACCENT = "#b569d5";

const wordSchema = z.object({
  t: z.number(),
  w: z.string(),
  a: z.boolean().default(false),
});

export const subBlockSchema = z.object({
  from: z.number(),
  to: z.number(),
  hook: z.boolean().default(false),
  pos: z.number().default(0), // 0 = выше, 1 = чуть ниже (чередование по гайду)
  words: z.array(wordSchema),
});

export const subSchema = z.object({
  video: z.string().default(""),
  durationInSeconds: z.number().default(10),
  fps: z.number().default(30),
  width: z.number().default(1080),
  height: z.number().default(1920),
  format: z.enum(["reels", "stories"]).default("reels"),
  subs: z.array(subBlockSchema).default([]),
});

export type SubProps = z.infer<typeof subSchema>;

const resolveSrc = (src: string): string =>
  /^https?:\/\//.test(src) ? src : staticFile(src);

export const SubtitledVideo: React.FC<SubProps> = ({ video, subs, format }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;

  // Гарантируем загрузку шрифта перед рендером; при сбое CDN — системный.
  const [fontHandle] = useState(() => delayRender("Loading subtitle font"));
  useEffect(() => {
    waitForFont()
      .then(() => continueRender(fontHandle))
      .catch(() => continueRender(fontHandle));
  }, [fontHandle]);

  const active = subs.find((b) => t >= b.from && t < b.to) ?? null;

  // (8) Плавный «дышащий» цифровой zoom — статичная камера оживает без рывков.
  const breathe = 1 + 0.018 * (1 - Math.cos((2 * Math.PI * t) / 6));
  // На хуке — чуть более выраженное приближение.
  let hook = 1;
  if (active && active.hook) {
    const span = Math.max(0.1, active.to - active.from);
    const local = (t - active.from) / span;
    hook = interpolate(local, [0, 1], [1.0, 1.03], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  const scale = breathe * hook;

  const fontSize = Math.round(height * 0.04);
  const stroke = Math.max(2, Math.round(fontSize * 0.05));
  // (4) Позиция чередуется: выше / чуть ниже — но всегда в safe-zone над лицом.
  const topPct = active && active.pos === 1 ? 0.15 : 0.06;

  // (5) Мягкое исчезновение блока в конце.
  let blockFade = 1;
  if (active) {
    blockFade = interpolate(active.to - t, [0, 0.25], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <OffthreadVideo
          src={resolveSrc(video)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {active ? (
        <div
          style={{
            position: "absolute",
            top: `${topPct * 100}%`,
            left: "6%",
            right: "6%",
            textAlign: "center",
            fontFamily: FONT,
            fontWeight: 700,
            fontSize,
            lineHeight: 1.28,
            opacity: blockFade,
          }}
        >
          {active.words.map((word, i) => {
            // (5) Появление слова — лёгкий spring по его таймкоду.
            const s = spring({
              frame: frame - word.t * fps,
              fps,
              config: { damping: 16, mass: 0.5, stiffness: 120 },
            });
            const appear = Math.min(1, Math.max(0, s));
            const common: React.CSSProperties = {
              display: "inline-block",
              margin: "0.06em 0.1em",
              opacity: appear,
              transform: `translateY(${(1 - appear) * 14}px)`,
              color: word.a ? ACCENT : "#fff",
              WebkitTextStrokeWidth: `${stroke}px`,
              WebkitTextStrokeColor: "#000",
              paintOrder: "stroke fill",
              textShadow: "0 2px 5px rgba(0,0,0,.5)",
            };
            return (
              <span key={i} style={common}>
                {word.w}
              </span>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
