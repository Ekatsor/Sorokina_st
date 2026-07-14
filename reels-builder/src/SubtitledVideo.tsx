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

// Фирменные акценты Sorokina: фиолетовый (главное слово) и тёплый жёлтый
// (число / дата / короткий призыв) — приглушённый, не золото и не неон.
const ACCENT = "#b569d5";
const YELLOW = "#E4B23C";

const wordSchema = z.object({
  t: z.number(),
  w: z.string(),
  a: z.boolean().default(false), // фиолетовый акцент
  y: z.boolean().default(false), // тёплый жёлтый акцент
});

export const subBlockSchema = z.object({
  from: z.number(),
  to: z.number(),
  hook: z.boolean().default(false),
  pos: z.number().default(0), // 0 = выше, 1 = чуть ниже (чередование по гайду)
  kind: z.enum(["sub", "title", "caption"]).default("sub"),
  zone: z.enum(["top", "bottom", "center"]).default("top"),
  words: z.array(wordSchema),
});

export const subSchema = z.object({
  video: z.string().default(""),
  durationInSeconds: z.number().default(10),
  fps: z.number().default(30),
  width: z.number().default(1080),
  height: z.number().default(1920),
  format: z.enum(["reels", "stories"]).default("reels"),
  purpose: z.string().default("reels"),
  videoType: z.string().default("head"),
  hasSpeech: z.boolean().default(true),
  needsText: z.boolean().default(false),
  safe: z
    .object({ top: z.number().default(0.06), bottom: z.number().default(0.08) })
    .default({ top: 0.06, bottom: 0.08 }),
  subs: z.array(subBlockSchema).default([]),
});

export type SubProps = z.infer<typeof subSchema>;

const resolveSrc = (src: string): string =>
  /^https?:\/\//.test(src) ? src : staticFile(src);

export const SubtitledVideo: React.FC<SubProps> = ({ video, subs, safe }) => {
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

  const safeTop = safe?.top ?? 0.06;
  const safeBottom = safe?.bottom ?? 0.08;
  const kind = active?.kind ?? "sub";
  const zone = active?.zone ?? "top";

  // Размер шрифта по типу блока.
  let fontSize = Math.round(height * 0.04);
  if (kind === "title") fontSize = Math.round(height * 0.058);
  else if (kind === "caption") fontSize = Math.round(height * 0.038);
  const stroke = Math.max(2, Math.round(fontSize * 0.05));

  // Вертикальное положение — с учётом безопасных зон интерфейса.
  const place: React.CSSProperties = { left: "6%", right: "6%", textAlign: "center" };
  if (kind === "sub") {
    if (zone === "bottom") place.bottom = `${(safeBottom + 0.02) * 100}%`;
    else place.top = `${(safeTop + (active && active.pos === 1 ? 0.09 : 0.0)) * 100}%`;
  } else if (kind === "title") {
    if (zone === "top") place.top = `${(safeTop + 0.03) * 100}%`;
    else if (zone === "bottom") place.bottom = `${(safeBottom + 0.05) * 100}%`;
    else place.top = "34%";
  } else {
    if (zone === "top") place.top = `${(safeTop + 0.03) * 100}%`;
    else if (zone === "center") place.top = "46%";
    else place.bottom = `${(safeBottom + 0.03) * 100}%`;
  }

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
            ...place,
            fontFamily: FONT,
            fontWeight: 700,
            fontSize,
            lineHeight: kind === "title" ? 1.16 : 1.28,
            letterSpacing: kind === "title" ? "-0.01em" : "0",
            opacity: blockFade,
          }}
        >
          {active.words.map((word, i) => {
            // Появление слова — лёгкий spring по его таймкоду.
            const s = spring({
              frame: frame - word.t * fps,
              fps,
              config: { damping: 16, mass: 0.5, stiffness: 120 },
            });
            const appear = Math.min(1, Math.max(0, s));
            const color = word.y ? YELLOW : word.a ? ACCENT : "#fff";
            const common: React.CSSProperties = {
              display: "inline-block",
              margin: "0.06em 0.1em",
              opacity: appear,
              transform: `translateY(${(1 - appear) * 14}px)`,
              color,
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
