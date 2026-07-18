// Общие типы монтажной SOROKINA ST (Путь А). Используются и редактором (Player),
// и экспортом (CLI-рендер) — одна модель данных, одна композиция.
import { z } from "zod";

export const effectTypeSchema = z.enum([
  "zoom",
  "split-screen",
  "meme-overlay",
  "meme-fullscreen",
  "loading",
  "freeze-frame",
  "repeat",
  "shake",
  "blur",
  "darken",
  "grayscale",
  "speed",
  "sound",
  "transition",
  "text-accent",
]);
export type EffectType = z.infer<typeof effectTypeSchema>;

export const timelineEffectSchema = z.object({
  id: z.string(),
  type: effectTypeSchema,
  startTime: z.number(),
  endTime: z.number(),
  trackId: z.string().default("fx"),
  enabled: z.boolean().default(true),
  layerIndex: z.number().default(0),
  settings: z.record(z.string(), z.any()).default({}),
});
export type TimelineEffect = z.infer<typeof timelineEffectSchema>;

// Слово субтитра (совместимо с SubtitledVideo)
export const subWordSchema = z.object({
  t: z.number(),
  w: z.string(),
  a: z.boolean().default(false),
  y: z.boolean().default(false),
});
export const subBlockSchema = z.object({
  from: z.number(),
  to: z.number(),
  hook: z.boolean().default(false),
  pos: z.number().default(0),
  kind: z.enum(["sub", "title", "caption"]).default("sub"),
  zone: z.enum(["top", "bottom", "center"]).default("top"),
  words: z.array(subWordSchema),
});

export const editorPropsSchema = z.object({
  video: z.string().default(""),
  durationInSeconds: z.number().default(10),
  fps: z.number().default(30),
  width: z.number().default(1080),
  height: z.number().default(1920),
  safe: z
    .object({ top: z.number().default(0.14), bottom: z.number().default(0.2) })
    .default({ top: 0.14, bottom: 0.2 }),
  subs: z.array(subBlockSchema).default([]),
  effects: z.array(timelineEffectSchema).default([]),
});
export type EditorProps = z.infer<typeof editorPropsSchema>;
