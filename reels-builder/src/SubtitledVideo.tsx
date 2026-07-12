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
  weights: ["600", "700"],
  subsets: ["latin", "cyrillic"],
});

// Фирменный розово-фиолетовый акцент Sorokina ST.
const ACCENT = "#d98ee6";

export const subBlockSchema = z.object({
  from: z.number(),
  to: z.number(),
  words: z.array(z.string()),
  accent: z.number(),
  hook: z.boolean().default(false),
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

export const SubtitledVideo: React.FC<SubProps> = ({
  video,
  subs,
  format,
}) => {
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
    scale = interpolate(local, [0, 1], [1.0, 1.045], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // Безопасная зона: нижняя треть, выше интерфейса. Stories чуть выше Reels.
  const bottom = Math.round(height * (format === "stories" ? 0.26 : 0.2));

  // Появление титра: на хуке медленнее и с задержкой.
  let opacity = 1;
  if (active) {
    const local = t - active.from;
    const delay = active.hook ? 0.28 : 0.0;
    const dur = active.hook ? 0.45 : 0.18;
    opacity = interpolate(local, [delay, delay + dur], [0, 1], {
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
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              bottom,
              left: "9%",
              right: "9%",
              textAlign: "center",
              opacity,
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: Math.round(height * 0.032),
                lineHeight: 1.15,
                color: "#fff",
                textShadow: "0 2px 8px rgba(0,0,0,.38)",
                letterSpacing: "0.3px",
              }}
            >
              {active.words.map((w, i) => (
                <React.Fragment key={i}>
                  <span style={{ color: i === active.accent ? ACCENT : "#fff" }}>
                    {w}
                  </span>
                  {i < active.words.length - 1 ? " " : ""}
                </React.Fragment>
              ))}
            </span>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
