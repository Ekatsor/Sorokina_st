#!/usr/bin/env node
/**
 * Visual Engine — генерация фирменных изображений SOROKINA ST через OpenAI.
 *
 * Два режима:
 *   1) Один визуал:
 *        node scripts/visual-engine.mjs <тип> <бриф> [заголовок] [quality] [count]
 *   2) Все визуалы дня из approved_week.json:
 *        node scripts/visual-engine.mjs --day <ключ дня> [quality]
 *
 * Требует переменную окружения OPENAI_API_KEY (в CI — секрет репозитория).
 * В каждый промпт автоматически добавляется бренд-стиль, чтобы всё выглядело
 * как одна система, а не случайный AI-набор.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

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
  /* дефолт */
}

const STYLE =
  `Фирменный визуальный стиль бренда SOROKINA ST — косметология, лазерная эпиляция, уход за собой, женственность и забота. ` +
  `Палитра: мягкий сиренево-фиолетовый ${palette.primary_purple}, тёплый светло-серый ${palette.light_gray}, чёрный, тёплый янтарный акцент ${palette.accent_yellow}. ` +
  `Настроение: современно, дорого, спокойно, кинематографично, профессионально, живо. ` +
  `Мягкий естественный свет, элегантный минимализм, много воздуха, редакционная эстетика бьюти-съёмки. ` +
  `Картинка должна выглядеть как часть единой брендовой системы, а НЕ как случайная AI-картинка: ` +
  `без кислотных цветов, без визуального мусора, без дешёвого стока, без искажённого текста и водяных знаков.`;

async function generateImage(prompt, size, quality, n) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${API}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size, quality, n }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 500)}`);
  }
  const data = await res.json();
  return (data.data || []).map((i) => i.b64_json).filter(Boolean);
}

mkdirSync(resolve("out"), { recursive: true });

// ---------- Режим 2: все визуалы дня ----------
// Тактичная обёртка + смягчение триггер-фраз (только для промпта к картинке,
// утверждённые тексты Stories не трогаем) — чтобы проходило модерацию.
const SAFE_PREAMBLE =
  "Тактичная, скромная редакционная летняя фотосъёмка для бренда красоты. " +
  "Женщина полностью одета в стильный классический купальник, естественная красота, " +
  "уважительная подача, БЕЗ сексуализации, без крупного плана тела и интимных зон, " +
  "акцент на настроении, свете и позе. ";
function safeScene(scene) {
  return String(scene)
    .replace(/,?\s*потому что переживает из-за[^.]*/gi, " и держится немного менее уверенно")
    .replace(/,?\s*потому что пытается скрыть[^.]*/gi, ", держась скованно и скромно")
    .replace(/ноги\s+согнуты\s+в\s+коленях\s+и\s+свободно\s+разведены/gi, "расслабленная спокойная поза")
    .replace(/сводит\s+ноги,?\s*/gi, "стоит скромно, ")
    .replace(/раздражени[а-яё]*/gi, "состояние кожи")
    .replace(/,?\s*волоск[а-яё]*/gi, "")
    .replace(/,?\s*следы?\s+после\s+бритья|следов\s+после\s+бритья/gi, "")
    .replace(/в\s+зоне\s+бикини/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

if (process.argv[2] === "--day") {
  const dayKey = process.argv[3];
  const quality = ["low", "medium", "high", "auto"].includes(process.argv[4]) ? process.argv[4] : "medium";
  const onlyArg = (process.argv[5] || "").trim();
  const onlySet = onlyArg ? new Set(onlyArg.split(/[,\s]+/).map((x) => parseInt(x, 10))) : null;
  const week = JSON.parse(readFileSync(resolve("approved_week.json"), "utf8"));
  const day = (week.days || []).find((d) => d.key === dayKey);
  if (!day) {
    console.error(`День '${dayKey}' не найден в approved_week.json`);
    process.exit(1);
  }
  const todo = day.stories.filter((s) => !onlySet || onlySet.has(s.n));
  console.log(`День: ${day.title} · генерим stories: ${todo.map((s) => s.n).join(",")} · качество: ${quality}`);
  let saved = 0;
  for (const s of todo) {
    const scene = s.visual || "мягкий летний фон у бассейна, много свободного места под текст, без людей";
    const prompt =
      `Вертикальный кадр 9:16 для Instagram Stories. ${SAFE_PREAMBLE}${safeScene(scene)}\n` +
      (day.style ? `Общий стиль дня: ${day.style}\n` : "") +
      `Оставь достаточно свободного места под текст и интерактив.\n\n${STYLE}`;
    try {
      const imgs = await generateImage(prompt, "1024x1536", quality, 1);
      if (imgs[0]) {
        const file = resolve("out", `visual-${dayKey}-${String(s.n).padStart(2, "0")}.png`);
        writeFileSync(file, Buffer.from(imgs[0], "base64"));
        console.log(`✓ Stories ${s.n} → ${file}`);
        saved += 1;
      }
    } catch (e) {
      console.error(`Stories ${s.n}: ошибка — ${e.message}`);
    }
  }
  console.log(`Готово: ${saved} изображение(й) для дня ${day.title}.`);
  if (!saved) process.exit(1);
  process.exit(0);
}

// ---------- Режим 1: один визуал ----------
const [, , typeArg, brief, headline, qualityArg, countArg] = process.argv;

const TYPES = {
  cover: { size: "1024x1536", brief: "Вертикальная обложка для Reels 9:16. Крупная выразительная композиция, чистое место сверху под заголовок." },
  stories: { size: "1024x1536", brief: "Вертикальный фон для Stories 9:16, спокойный, с местом под текст." },
  carousel: { size: "1024x1024", brief: "Квадратный слайд карусели, чистая композиция, место под короткий текст." },
  post: { size: "1024x1024", brief: "Квадратный пост для ленты Instagram, эстетичная брендовая сцена." },
  background: { size: "1024x1536", brief: "Вертикальный брендовый фон, мягкие градиенты палитры, без людей и без текста." },
  illustration: { size: "1024x1024", brief: "Иллюстрация для экспертного контента: простая понятная метафора в фирменном стиле." },
};
const mapType = (str) => {
  str = String(str || "").toLowerCase();
  if (str.includes("облож") || str.includes("cover")) return "cover";
  if (str.includes("stor") || str.includes("стор")) return "stories";
  if (str.includes("карус") || str.includes("carou")) return "carousel";
  if (str.includes("фон") || str.includes("back")) return "background";
  if (str.includes("иллюст") || str.includes("illu")) return "illustration";
  if (str.includes("пост") || str.includes("post")) return "post";
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
writeFileSync(resolve("out", "prompt.txt"), prompt);

let imgs = [];
try {
  imgs = await generateImage(prompt, T.size, quality, count);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
let saved = 0;
imgs.forEach((b64, i) => {
  const file = resolve("out", `visual-${type}-${i + 1}.png`);
  writeFileSync(file, Buffer.from(b64, "base64"));
  console.log(`✓ ${file}`);
  saved += 1;
});
if (!saved) {
  console.error("OpenAI не вернул изображений.");
  process.exit(1);
}
console.log(`Готово: ${saved} изображение(й).`);
