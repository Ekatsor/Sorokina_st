#!/usr/bin/env node
/**
 * Скачивает медиа с Google Drive для рендера.
 *
 * Читает props JSON, у каждого кадра с `driveId` качает файл (gdown) в
 * public/media/<driveId>.<ext> и проставляет `src`, чтобы Remotion взял
 * реальный клип вместо заглушки. Файл должен быть открыт «всем, у кого есть
 * ссылка». Если скачать не удалось — кадр остаётся заглушкой (рендер не падает).
 *
 * Фото с iPhone обычно приходят в HEIC — Chromium (на котором рендерит
 * Remotion) такой формат не показывает, поэтому после скачивания реальный
 * тип файла проверяется по содержимому и HEIC конвертируется в настоящий
 * JPEG (heif-convert из libheif-examples, с запасным вариантом на
 * ImageMagick).
 *
 * Использование: node scripts/prepare-media.mjs <in.json> <out.json>
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Использование: prepare-media.mjs <in.json> <out.json>");
  process.exit(1);
}

const mediaDir = resolve("public/media");
mkdirSync(mediaDir, { recursive: true });

const script = JSON.parse(readFileSync(inPath, "utf8"));
const cache = new Map();

// Определяем реальный формат файла по сигнатуре, а не по расширению —
// gdown сохраняет файл под именем <id>.jpg, даже если внутри лежит HEIC.
const isHeic = (abs) => {
  try {
    const out = execFileSync("file", ["--brief", "--mime-type", abs], {
      encoding: "utf8",
    });
    return /heic|heif/i.test(out);
  } catch {
    return false;
  }
};

const convertHeicToJpeg = (abs) => {
  const heicPath = abs.replace(/\.jpg$/, ".heic");
  renameSync(abs, heicPath);
  try {
    execFileSync("heif-convert", [heicPath, abs], { stdio: "inherit" });
    if (existsSync(abs)) return true;
  } catch (e) {
    console.warn(`  heif-convert недоступен или упал (${e.message}), пробую ImageMagick`);
  }
  try {
    execFileSync("convert", [heicPath, abs], { stdio: "inherit" });
    if (existsSync(abs)) return true;
  } catch (e) {
    console.warn(`  ImageMagick тоже не смог сконвертировать HEIC (${e.message})`);
  }
  // Ничего не вышло — вернуть исходный HEIC на место, кадр останется
  // заглушкой при показе, но рендер не упадёт.
  renameSync(heicPath, abs);
  return false;
};

const download = (driveId, kind) => {
  if (cache.has(driveId)) return cache.get(driveId);
  const ext = kind === "photo" ? "jpg" : "mp4";
  const rel = `media/${driveId}.${ext}`;
  const abs = resolve("public", rel);
  if (existsSync(abs)) {
    cache.set(driveId, rel);
    return rel;
  }
  try {
    console.log(`↓ Google Drive: ${driveId} → ${rel}`);
    execFileSync(
      "gdown",
      [`https://drive.google.com/uc?id=${driveId}`, "-O", abs, "--quiet"],
      { stdio: "inherit" },
    );
    if (!existsSync(abs)) throw new Error("файл не скачался");
    if (kind === "photo" && isHeic(abs)) {
      console.log(`  ${driveId}: это HEIC — конвертирую в JPEG`);
      convertHeicToJpeg(abs);
    }
    cache.set(driveId, rel);
    return rel;
  } catch (e) {
    console.warn(`⚠ Не удалось скачать ${driveId} (${e.message}). ` +
      `Проверь, что файл открыт «всем, у кого есть ссылка». Кадр останется заглушкой.`);
    cache.set(driveId, null);
    return null;
  }
};

for (const frame of script.frames || []) {
  if (frame.src) continue; // уже задан прямой путь/URL
  if (!frame.driveId) continue;
  const rel = download(frame.driveId, frame.kind);
  if (rel) frame.src = rel;
}

writeFileSync(outPath, JSON.stringify(script, null, 2));
console.log(`✓ Готово: ${outPath}`);
