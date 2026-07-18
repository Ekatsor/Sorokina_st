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
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadMarck } from "@remotion/google-fonts/MarckScript";
import { z } from "zod";

// Фирменные шрифты SOROKINA ST (из бренд-референсов):
// Playfair Display — основной журнальный сериф; Marck Script — рукописный акцент.
const { fontFamily: FONT, waitUntilDone: waitPlayfair } = loadPlayfair("normal", {
  weights: ["700", "800", "900"],
  subsets: ["latin", "cyrillic"],
});
const { fontFamily: SCRIPT, waitUntilDone: waitMarck } = loadMarck("normal", {
  weights: ["400"],
  subsets: ["latin", "cyrillic"],
});

// Фирменные цвета (пипеткой из референсов):
const ACCENT = "#7A3FE0"; // насыщенный сине-фиолетовый (акцентное слово, рукописное)
const YELLOW = "#E4B23C"; // тёплый жёлтый — редко (числа/даты/CTA)
const WHITE = "#EFECEA"; // тёплый белый — основной текст

const wordSchema = z.object({
  t: z.number(),
  w: z.string(),
  a: z.boolean().default(false), // фиолетовый рукописный акцент
  y: z.boolean().default(false), // тёплый жёлтый акцент
});

export const subBlockSchema = z.object({
  from: z.number(),
  to: z.number(),
  hook: z.boolean().default(false),
  pos: z.number().default(0),
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

  const [fontHandle] = useState(() => delayRender("Loading brand fonts"));
  useEffect(() => {
    Promise.all([waitPlayfair(), waitMarck()])
      .then(() => continueRender(fontHandle))
      .catch(() => continueRender(fontHandle));
  }, [fontHandle]);

  const active = subs.find((b) => t >= b.from && t < b.to) ?? null;

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

  let fontSize = Math.round(height * 0.042);
  if (kind === "title") fontSize = Math.round(height * 0.06);
  else if (kind === "caption") fontSize = Math.round(height * 0.038);
  const stroke = Math.max(3, Math.round(fontSize * 0.055));

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

  let blockFade = 1;
  if (active) {
    blockFade = interpolate(active.to - t, [0, 0.25], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#0E0E10" }}>
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
            fontWeight: 800,
            fontSize,
            lineHeight: kind === "title" ? 1.16 : 1.3,
            opacity: blockFade,
          }}
        >
          {active.words.map((word, i) => {
            const s = spring({
              frame: frame - word.t * fps,
              fps,
              config: { damping: 16, mass: 0.5, stiffness: 120 },
            });
            const appear = Math.min(1, Math.max(0, s));
            const isScript = word.a && !word.y; // фиолетовый акцент — рукописным
            const color = word.y ? YELLOW : word.a ? ACCENT : WHITE;
            const common: React.CSSProperties = {
              display: "inline-block",
              margin: isScript ? "0 0.12em" : "0.06em 0.1em",
              opacity: appear,
              transform: `translateY(${(1 - appear) * 14}px)`,
              color,
              fontFamily: isScript ? SCRIPT : FONT,
              fontWeight: isScript ? 400 : 800,
              fontSize: isScript ? "1.16em" : "1em",
              WebkitTextStrokeWidth: `${stroke}px`,
              WebkitTextStrokeColor: "#000",
              paintOrder: "stroke fill",
              textShadow: "0 3px 8px rgba(0,0,0,.55)",
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
