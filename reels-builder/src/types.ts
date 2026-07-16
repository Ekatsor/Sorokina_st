import { z } from "zod";

export const spokenLineSchema = z.object({
  text: z.string().describe("Текст реплики"),
  startSec: z.number().min(0).describe("Начало реплики (сек)"),
  endSec: z.number().min(0).describe("Конец реплики (сек)"),
});

export const frameSegmentSchema = z.object({
  clipIndex: z.number().int().min(0).describe("Индекс видеоклипа (0-based)"),
  startSec: z.number().min(0).describe("Начало кадра (сек)"),
  endSec: z.number().min(0).describe("Конец кадра (сек)"),
  caption: z.string().optional().describe("Текст-титр поверх клипа"),
  src: z
    .string()
    .optional()
    .describe("Реальное медиа: путь в public/ (media/<id>.mp4) или URL"),
  kind: z
    .enum(["video", "photo"])
    .optional()
    .describe("Тип медиа для кадра"),
  driveId: z
    .string()
    .optional()
    .describe("ID файла Google Drive — скачивается при рендере в src"),
});

export const reelScriptSchema = z.object({
  theme: z
    .enum([
      "laser",
      "pdrn",
      "biorevitalization",
      "peelings",
      "cleansing",
      "wax",
      "retention",
      "personal",
      "collagen",
    ])
    .describe("Тема / направление"),
  format: z
    .enum([
      "talking-head-broll",
      "process-captions",
      "client-story",
      "behind-scenes",
      "expert-observation",
      "soft-sell",
    ])
    .describe("Формат ролика"),
  duration: z
    .union([z.literal(20), z.literal(30), z.literal(45), z.literal(60)])
    .describe("Длительность (сек)"),
  tone: z
    .enum(["calm-premium", "lively-humor", "soft-caring", "direct-no-sugar"])
    .describe("Тон подачи"),
  title: z.string().optional().describe("Заголовок (опционально)"),
  spokenLines: z.array(spokenLineSchema).describe("Реплики говорящей головы"),
  frames: z.array(frameSegmentSchema).describe("Структура кадров"),
  cta: z.string().describe("Призыв к действию"),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;
export type SpokenLine = z.infer<typeof spokenLineSchema>;
export type FrameSegment = z.infer<typeof frameSegmentSchema>;
export type Theme = ReelScript["theme"];
export type Format = ReelScript["format"];
export type Tone = ReelScript["tone"];
