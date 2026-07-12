#!/usr/bin/env node
/**
 * Visual Engine — генерация фирменных изображений SOROKINA ST через OpenAI.
 *
 * В каждый промпт автоматически подставляется бренд-стиль (палитра, шрифт,
 * настроение), чтобы все картинки выглядели как одна система, а не случайный
 * AI-набор. Тип визуала задаёт размер и композицию.
 *
 * Использование:
 *   node scripts/visual-engine.mjs <тип> <бриф> [заголовок] [quality] [count]
 *
 * Требует переменную окружения OPENAI_API_KEY (в CI — секрет репозитория).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [, , typeArg, brief, headline, qualityArg, countArg] = process.argv;

const API = process.env.OPENAI_API_KEY;
if (!API) {
  console.error(
    "НЕТ OPENAI_API_KEY. Добавь ключ как секрет репозитория: " +
      "Settings → Secrets and variables → Actions → New repository secret, имя OPENAI_API_KEY.",
  );
  process.exit(2);
}

// Бренд-палитра — единый источник из content_brain.json.
let palette = {
  primary_purple: "#b569d5",
  light_gray: "#deddd8",
  black: "#000000",
  accent_yellow: "#f0b543",
};
try {
  const cb = JSON.parse(readFileSync(resolve("content_brain.json"), "utf8"));
  if (cb.brand_visual && cb.brand_visual.palette) palette = cb.brand_visual.palette;
} catch {
  /* оставляем дефолт */
}

const STYLE =
  `Фирменный визуальный стиль бренда SOROKINA ST — косметология, лазерная эпиляция, уход за собой, женственность и забота. ` +
  `Палитра: мягкий сиренево-фиолетовый ${palette.primary_purple}, тёплый светло-серый ${palette.light_gray}, чёрный, тёплый янтарный акцент ${palette.accent_yellow}. ` +
  `Настроение: современно, дорого, спокойно, кинематографично, профессионально, живо. ` +
  `Мягкий естественный свет, элегантный минимализм, много воздуха, редакционная эстетика бьюти-съёмки. ` +
  `Картинка должна выглядеть как часть единой брендовой системы, а НЕ как случайная AI-картинка: ` +
  `без кислотных цветов, без визуального мусора, без дешёвого стока, без искажённого текста и водяных знаков.`;

const TYPES = {
  cover: {
    size: "1024x1536",
    brief: "Вертикальная обложка для Reels 9:16. Крупная выразительная композиция, чистое место сверху под заголовок.",
  },
  stories: {
    size: "1024x1536",
    brief: "Вертикальный фон для Stories 9:16, спокойный, с местом под текст.",
  },
  carousel: {
    size: "1024x1024",
    brief: "Квадратный слайд карусели, чистая композиция, место под короткий текст.",
  },
  post: {
    size: "1024x1024",
    brief: "Квадратный пост для ленты Instagram, эстетичная брендовая сцена.",
  },
  background: {
    size: "1024x1536",
    brief: "Вертикальный брендовый фон, мягкие градиенты палитры, без людей и без текста.",
  },
  illustration: {
    size: "1024x1024",
    brief: "Иллюстрация для экспертного контента: простая понятная метафора в фирменном стиле.",
  },
};

const mapType = (s) => {
  s = String(s || "").toLowerCase();
  if (s.includes("облож") || s.includes("cover")) return "cover";
  if (s.includes("stor") || s.includes("стор")) return "stories";
  if (s.includes("карус") || s.includes("carou")) return "carousel";
  if (s.includes("фон") || s.includes("back")) return "background";
  if (s.includes("иллюст") || s.includes("illu")) return "illustration";
  if (s.includes("пост") || s.includes("post")) return "post";
  return "post";
};

const type = mapType(typeArg);
const T = TYPES[type];
const hl = String(headline || "").trim();
const quality = ["low", "medium", "high", "auto"].includes(qualityArg) ? qualityArg : "medium";
const count = Math.max(1, Math.min(4, parseInt(countArg, 10) || 1));

const prompt =
  `${T.brief}\n` +
  `Тема/сцена: ${brief || "брендовая бьюти-сцена SOROKINA ST"}.\n` +
  (hl ? `Оставь чистое место под заголовок «${hl}» — сам текст не рисуй.\n` : "") +
  `\n${STYLE}`;

console.log(`Тип: ${type} · размер: ${T.size} · качество: ${quality} · вариантов: ${count}`);
mkdirSync(resolve("out"), { recursive: true });
writeFileSync(resolve("out", "prompt.txt"), prompt);

const res = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "gpt-image-1", prompt, size: T.size, quality, n: count }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`OpenAI вернул ошибку ${res.status}: ${err.slice(0, 600)}`);
  process.exit(1);
}

const data = await res.json();
let saved = 0;
for (const [i, img] of (data.data || []).entries()) {
  if (!img.b64_json) continue;
  const file = resolve("out", `visual-${type}-${i + 1}.png`);
  writeFileSync(file, Buffer.from(img.b64_json, "base64"));
  console.log(`✓ ${file}`);
  saved += 1;
}
if (!saved) {
  console.error("OpenAI не вернул изображений.");
  process.exit(1);
}
console.log(`Готово: ${saved} изображение(й).`);
