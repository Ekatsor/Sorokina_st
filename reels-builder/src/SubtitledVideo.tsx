import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { z } from "zod";

// Bold Montserrat with Cyrillic — фирменные субтитры.
const { fontFamily: FONT, waitUntilDone: waitForFont } = loadFont("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin", "cyrillic"],
});

// Фирменный фиолетовый акцент Sorokina — цвет ключевых слов (как в референсе).
const ACCENT = "#8b3fe6";

const wordSchema = z.object({
  t: z.number(), // когда слово произносится (сек, очищенная таймлиния)
  w: z.string(), // текст слова (Title Case)
  a: z.boolean().default(false), // акцентное слово → фирменная плашка
});

export const subBlockSchema = z.object({
  from: z.number(),
  to: z.number(),
  hook: z.boolean().default(false),
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

export const SubtitledVideo: React.FC<SubProps> = ({ video, subs }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;

  // Гарантируем загрузку жирного шрифта перед рендером; при сбое CDN — системный.
  const [fontHandle] = useState(() => delayRender("Loading subtitle font"));
  useEffect(() => {
    waitForFont()
      .then(() => continueRender(fontHandle))
      .catch(() => continueRender(fontHandle));
  }, [fontHandle]);

  const active = subs.find((b) => t >= b.from && t < b.to) ?? null;

  // Эмоц. монтаж: на хуке — лёгкий zoom видео, на спокойной речи — без движения.
  let scale = 1;
  if (active && active.hook) {
    const span = Math.max(0.1, active.to - active.from);
    const local = (t - active.from) / span;
    scale = interpolate(local, [0, 1], [1.0, 1.05], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  const fontSize = Math.round(height * 0.046);

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
            top: "7%",
            left: "6%",
            right: "6%",
            textAlign: "center",
            fontFamily: FONT,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.28,
          }}
        >
          {active.words.map((word, i) => {
            // Прогрессивное появление: слово видно, когда оно произнесено.
            const appear = interpolate(t, [word.t - 0.02, word.t + 0.12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const common: React.CSSProperties = {
              display: "inline-block",
              margin: "0.06em 0.1em",
              opacity: appear,
              transform: `translateY(${(1 - appear) * 8}px)`,
            };
            return (
              <span
                key={i}
                style={{
                  ...common,
                  color: word.a ? ACCENT : "#fff",
                  textShadow: "0 2px 8px rgba(0,0,0,.55)",
                }}
              >
                {word.w}
              </span>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
