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
import type { EditorProps, TimelineEffect } from "./types";

// Один и тот же рендер для предпросмотра (Player) и экспорта (CLI) — парити.
const { fontFamily: FONT, waitUntilDone: waitPlayfair } = loadPlayfair("normal", {
  weights: ["700", "800", "900"],
  subsets: ["latin", "cyrillic"],
});
const { fontFamily: SCRIPT, waitUntilDone: waitMarck } = loadMarck("normal", {
  weights: ["400"],
  subsets: ["latin", "cyrillic"],
});

const ACCENT = "#7A3FE0";
const YELLOW = "#E4B23C";
const WHITE = "#EFECEA";

const resolveSrc = (src: string): string =>
  /^(https?:|blob:|data:)/.test(src) ? src : staticFile(src);

const active = (effects: TimelineEffect[], type: string, t: number) =>
  effects.filter((e) => e.enabled && e.type === type && t >= e.startTime && t < e.endTime);

export const EditorComp: React.FC<EditorProps> = ({ video, subs, effects, safe }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;

  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([waitPlayfair(), waitMarck()])
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);

  // --- ВИДЕО-СЛОЙ: базовое дыхание + зум-эффекты с таймлайна ---
  let scale = 1 + 0.014 * (1 - Math.cos((2 * Math.PI * t) / 6));
  for (const z of active(effects, "zoom", t)) {
    const target = typeof z.settings.scale === "number" ? (z.settings.scale as number) : 1.12;
    const inDur = Math.min(0.35, (z.endTime - z.startTime) / 2);
    const k = interpolate(t, [z.startTime, z.startTime + inDur, z.endTime - inDur, z.endTime], [1, target, target, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    scale *= k;
  }

  // --- ФИЛЬТР-СЛОЙ: затемнение / размытие / ч-б ---
  const filters: string[] = [];
  let overlayDark = 0;
  for (const d of active(effects, "darken", t)) overlayDark = Math.max(overlayDark, typeof d.settings.amount === "number" ? (d.settings.amount as number) : 0.45);
  for (const b of active(effects, "blur", t)) filters.push(`blur(${typeof b.settings.px === "number" ? b.settings.px : 8}px)`);
  if (active(effects, "grayscale", t).length) filters.push("grayscale(1)");

  const safeTop = safe?.top ?? 0.14;
  const safeBottom = safe?.bottom ?? 0.2;

  const cur = subs.find((b) => t >= b.from && t < b.to) ?? null;
  const fontSize = Math.round(height * (cur?.kind === "title" ? 0.06 : 0.042));
  const stroke = Math.max(3, Math.round(fontSize * 0.055));
  const place: React.CSSProperties = { left: "6%", right: "6%", textAlign: "center" };
  const zone = cur?.zone ?? "top";
  if (zone === "bottom") place.bottom = `${(safeBottom + 0.02) * 100}%`;
  else if (zone === "center") place.top = "44%";
  else place.top = `${(safeTop + (cur && cur.pos === 1 ? 0.08 : 0)) * 100}%`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0E0E10" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, filter: filters.join(" ") || undefined }}>
        <OffthreadVideo src={resolveSrc(video)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>

      {overlayDark > 0 ? <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${overlayDark})` }} /> : null}

      {cur ? (
        <div style={{ position: "absolute", ...place, fontFamily: FONT, fontWeight: 800, fontSize, lineHeight: 1.3 }}>
          {cur.words.map((word, i) => {
            const s = spring({ frame: frame - word.t * fps, fps, config: { damping: 16, mass: 0.5, stiffness: 120 } });
            const appear = Math.min(1, Math.max(0, s));
            const isScript = word.a && !word.y;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  margin: isScript ? "0 0.12em" : "0.06em 0.1em",
                  opacity: appear,
                  transform: `translateY(${(1 - appear) * 14}px)`,
                  color: word.y ? YELLOW : word.a ? ACCENT : WHITE,
                  fontFamily: isScript ? SCRIPT : FONT,
                  fontWeight: isScript ? 400 : 800,
                  fontSize: isScript ? "1.16em" : "1em",
                  WebkitTextStrokeWidth: `${stroke}px`,
                  WebkitTextStrokeColor: "#000",
                  paintOrder: "stroke fill",
                  textShadow: "0 3px 8px rgba(0,0,0,.55)",
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
