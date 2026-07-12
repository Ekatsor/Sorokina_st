#!/usr/bin/env node
/**
 * Превращает транскрипт Whisper (со словными таймкодами) в:
 *   1. filter.txt   — ffmpeg filter_complex: вырезает слова-паразиты и паузы
 *   2. subs.json    — props для Remotion (SubtitledVideo): фирменные субтитры
 *                     на очищенной таймлинии, с акцентным словом и хуками.
 *
 * Использование:
 *   node scripts/edit-plan.mjs <whisper.json> <videoPathForRemotion> <format> <outDir>
 *
 * videoPathForRemotion — путь очищенного видео относительно public/ (напр. edit/cleaned.mp4).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , whisperPath, videoRel, formatArg, outDir] = process.argv;
if (!whisperPath || !videoRel || !outDir) {
  console.error("Использование: edit-plan.mjs <whisper.json> <videoRel> <format> <outDir>");
  process.exit(1);
}
const format = formatArg === "stories" ? "stories" : "reels";

// --- фирменные правила (те же, что в приложении) ---
const FILLERS = new Set([
  "эээ", "ээ", "эммм", "эмм", "эм", "ааа", "аа", "ну", "вот", "значит",
  "типа", "короче", "короч", "получается", "собственно", "это",
]);
// «как бы», «в общем», «в принципе» — двухсловные, обрабатываем отдельно
const FILLER_PAIRS = [["как", "бы"], ["в", "общем"], ["в", "принципе"], ["то", "есть"]];
const STARTERS = new Set([
  "не", "и", "а", "но", "когда", "что", "чтобы", "если", "потому", "ведь",
  "или", "как", "в", "во", "на", "с", "со", "о", "об", "по", "к", "ко",
  "у", "за", "из", "от", "до", "для", "про", "без", "это",
]);
const HOOKS = [
  "почему", "никогда", "невозможно", "развод", "запомни", "секрет",
  "на самом деле", "перестань", "хватит", "представь",
];
const MIN_GAP = 0.4; // паузы длиннее — режем
const PAD = 0.08; // мягкий отступ вокруг слова, чтобы речь не обрубалась

const norm = (w) => String(w).toLowerCase().replace(/[^а-яёa-z]/gi, "");

// --- собрать плоский список слов ---
const data = JSON.parse(readFileSync(whisperPath, "utf8"));
let words = [];
for (const seg of data.segments || []) {
  for (const w of seg.words || []) {
    const text = String(w.word || "").trim();
    if (!text) continue;
    words.push({ text, start: w.start, end: w.end });
  }
}
if (!words.length) {
  console.error("В транскрипте нет слов — оставляю видео как есть, без субтитров.");
  writeFileSync(resolve(outDir, "filter.txt"), "");
  writeFileSync(
    resolve(outDir, "subs.json"),
    JSON.stringify({ video: videoRel, durationInSeconds: 0, fps: 30, width: 1080, height: 1920, format, subs: [] }, null, 2),
  );
  process.exit(0);
}

// --- пометить слова-паразиты (одиночные и парные) ---
words.forEach((w) => (w.keep = !FILLERS.has(norm(w.text))));
for (let i = 0; i < words.length - 1; i++) {
  const a = norm(words[i].text);
  const b = norm(words[i + 1].text);
  if (FILLER_PAIRS.some((p) => p[0] === a && p[1] === b)) {
    words[i].keep = false;
    words[i + 1].keep = false;
  }
}

// --- построить keep-сегменты (речь без пауз и паразитов) ---
const segs = [];
let cur = null;
let lastEnd = null;
let brokeByFiller = false;
for (const w of words) {
  if (!w.keep) {
    brokeByFiller = true;
    continue;
  }
  if (cur === null) {
    cur = { start: Math.max(0, w.start - PAD), end: w.end + PAD };
    lastEnd = w.end;
    brokeByFiller = false;
    continue;
  }
  const gap = w.start - lastEnd;
  if (!brokeByFiller && gap <= MIN_GAP) {
    cur.end = w.end + PAD; // непрерывная речь — не режем
  } else {
    segs.push(cur);
    cur = { start: Math.max(cur.end, w.start - PAD), end: w.end + PAD };
  }
  lastEnd = w.end;
  brokeByFiller = false;
}
if (cur) segs.push(cur);

// длительность очищенного видео
const cleanedDuration = segs.reduce((a, s) => a + (s.end - s.start), 0);

// --- ffmpeg filter_complex: trim+concat всех keep-сегментов ---
const parts = [];
segs.forEach((s, i) => {
  const st = s.start.toFixed(3);
  const en = s.end.toFixed(3);
  parts.push(`[0:v]trim=start=${st}:end=${en},setpts=PTS-STARTPTS[v${i}]`);
  parts.push(`[0:a]atrim=start=${st}:end=${en},asetpts=PTS-STARTPTS[a${i}]`);
});
const concatIn = segs.map((_, i) => `[v${i}][a${i}]`).join("");
const filter = `${parts.join(";")};${concatIn}concat=n=${segs.length}:v=1:a=1[outv][outa]`;
writeFileSync(resolve(outDir, "filter.txt"), filter);

// --- пересчитать слова на очищенную таймлинию ---
let outCursor = 0;
const kept = [];
for (const s of segs) {
  for (const w of words) {
    if (!w.keep) continue;
    if (w.start >= s.start && w.start < s.end) {
      kept.push({
        text: w.text.trim(),
        start: outCursor + (w.start - s.start),
        end: outCursor + Math.min(w.end, s.end) - s.start,
      });
    }
  }
  outCursor += s.end - s.start;
}

// --- разбить на смысловые блоки (3–5 слов, перенос по смыслу) ---
const isHookText = (t) => {
  const low = t.toLowerCase();
  if (t.indexOf("?") >= 0) return true;
  return HOOKS.some((h) => low.indexOf(h) >= 0);
};
// Первая буква — заглавная (Title Case как в референсе)
const titleCase = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

// Группируем в предложения (по .!? или максимум ~8 слов), внутри — прогрессивный
// показ по таймкодам каждого слова; ключевые слова получают фирменную плашку.
const MAX_WORDS = 8;
const sentences = [];
let sbuf = [];
const pushSent = () => {
  if (sbuf.length) {
    sentences.push(sbuf);
    sbuf = [];
  }
};
for (const w of kept) {
  sbuf.push(w);
  const endsThought = /[.!?…]$/.test(w.text);
  if (endsThought || sbuf.length >= MAX_WORDS) pushSent();
}
pushSent();

const blocks = sentences.map((sent) => {
  const scored = sent.map((w, i) => {
    const n = norm(w.text);
    return { i, n, len: n.length, starter: STARTERS.has(n) };
  });
  // кандидаты в акцент — содержательные слова подлиннее
  let cand = scored.filter((s) => !s.starter && s.len >= 5).sort((a, b) => b.len - a.len);
  if (!cand.length) cand = scored.slice().sort((a, b) => b.len - a.len).slice(0, 1);
  const nAcc = Math.max(1, Math.min(3, Math.round(sent.length / 3)));
  const accSet = new Set(cand.slice(0, nAcc).map((s) => s.i));
  const fullText = sent.map((w) => w.text).join(" ");
  return {
    from: +sent[0].start.toFixed(3),
    to: +sent[sent.length - 1].end.toFixed(3),
    hook: isHookText(fullText),
    words: sent.map((w, i) => ({
      t: +w.start.toFixed(3),
      w: titleCase(w.text.replace(/[.;:!?…]+$/, "")),
      a: accSet.has(i),
    })),
  };
});

// растянуть каждый блок до начала следующего (чтобы титр не мигал в паузах речи)
for (let i = 0; i < blocks.length - 1; i++) {
  blocks[i].to = Math.max(blocks[i].to, blocks[i + 1].from);
}
if (blocks.length) {
  blocks[blocks.length - 1].to = Math.max(blocks[blocks.length - 1].to, cleanedDuration);
}

const props = {
  video: videoRel,
  durationInSeconds: +cleanedDuration.toFixed(3),
  fps: 30,
  width: 1080,
  height: 1920,
  format,
  subs: blocks,
};
writeFileSync(resolve(outDir, "subs.json"), JSON.stringify(props, null, 2));

const removed = words.filter((w) => !w.keep).length;
const hooks = blocks.filter((b) => b.hook).length;
writeFileSync(
  resolve(outDir, "report.json"),
  JSON.stringify(
    {
      removedFillers: removed,
      speechSegments: segs.length,
      pausesCut: Math.max(0, segs.length - 1),
      subtitleBlocks: blocks.length,
      hookMoments: hooks,
      cleanedDuration: +cleanedDuration.toFixed(1),
    },
    null,
    2,
  ),
);
console.log(
  `Сегментов речи: ${segs.length} · убрано слов-паразитов: ${removed} · ` +
    `блоков субтитров: ${blocks.length} · хуков: ${hooks} · очищенная длительность: ${cleanedDuration.toFixed(1)}с`,
);
