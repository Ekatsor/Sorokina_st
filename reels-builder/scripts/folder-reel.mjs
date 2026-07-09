#!/usr/bin/env node
/**
 * Собирает props для ролика из уже скачанных в public/media файлов
 * (их туда кладёт `gdown --folder` в workflow).
 *
 * Берёт базовый сценарий, раскладывает по кадрам первое видео и фото
 * (переименовывая в безопасные имена), и пишет итоговый props JSON.
 * Кадры без подходящего медиа остаются заглушками — рендер не падает.
 *
 * Использование: node scripts/folder-reel.mjs <base.json> <out.json>
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const [, , basePath, outPath] = process.argv;
if (!basePath || !outPath) {
  console.error("Использование: folder-reel.mjs <base.json> <out.json>");
  process.exit(1);
}

const mediaDir = resolve("public/media");
mkdirSync(mediaDir, { recursive: true });

const isVideo = (f) => /\.(mp4|mov|m4v|webm)$/i.test(f);
const isPhoto = (f) => /\.(jpe?g|png|webp|avif|heic)$/i.test(f);

let all = [];
try {
  all = readdirSync(mediaDir);
} catch {
  all = [];
}
// Не трогаем уже нормализованные clip-файлы, чтобы не зациклиться
const source = all.filter((f) => !/^clip\d+\./i.test(f));
const videos = source.filter(isVideo);
const photos = source.filter(isPhoto);

console.log(`Найдено в папке: видео ${videos.length}, фото ${photos.length}`);

// Переименовать в безопасное имя (без пробелов/кириллицы в пути)
let counter = 0;
const safeCopy = (name, kind) => {
  const ext = kind === "photo" ? ".jpg" : ".mp4";
  const srcExt = extname(name) || ext;
  const safe = `clip${counter++}${srcExt.toLowerCase()}`;
  copyFileSync(resolve(mediaDir, name), resolve(mediaDir, safe));
  return `media/${safe}`;
};

const base = JSON.parse(readFileSync(basePath, "utf8"));
let vi = 0;
let pi = 0;

base.frames.forEach((frame, idx) => {
  if (frame.src) return;
  let chosen = null;
  let kind = null;
  // Первый кадр — говорящая голова: отдаём видео, если есть
  if (idx === 0 && videos.length) {
    chosen = videos[vi++ % videos.length];
    kind = "video";
  } else if (photos.length) {
    chosen = photos[pi++ % photos.length];
    kind = "photo";
  } else if (videos.length) {
    chosen = videos[vi++ % videos.length];
    kind = "video";
  }
  if (chosen) {
    frame.src = safeCopy(chosen, kind);
    frame.kind = kind;
    console.log(`Кадр ${idx + 1}: ${kind} ← ${chosen}`);
  } else {
    console.log(`Кадр ${idx + 1}: медиа не нашлось — заглушка`);
  }
});

writeFileSync(outPath, JSON.stringify(base, null, 2));
console.log(`✓ Готово: ${outPath}`);
