#!/usr/bin/env node
/**
 * Превращает транскрипт Whisper (со словными таймкодами) в:
 *   1. filter.txt   — ffmpeg filter_complex: вырезает слова-паразиты и паузы
 *   2. subs.json    — props для Remotion (SubtitledVideo): фирменные субтитры
 *                     на очищенной таймлинии, с акцентным словом и хуками.
 *
 * Использование:
 *   node scripts/edit-plan.mjs <whisper.json> <videoPathForRemotion> <format> <outDir> [sourceDuration]
 *
 * Необязательные параметры через переменные окружения (модуль «Обработать
 * отдельное видео») — при их отсутствии поведение прежнее (говорящая голова):
 *   VIDEO_TYPE  = auto | head | voiceover | nospeech | mixed   (тип ролика)
 *   PURPOSE     = stories | reels | telegram | max | whatsapp | plain
 *   TEXT_MODE   = subs | caption | subs_title | subs_caption | timecoded | none
 *   MANUAL_TEXT = путь к JSON с ручными подписями {items:[{text,from,to,...}], hero,title,subtitle,final}
 *
 * videoRel — путь очищенного видео относительно public/ (напр. edit/cleaned.mp4).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const [, , whisperPath, videoRel, formatArg, outDir, sourceDurArg] = process.argv;
if (!whisperPath || !videoRel || !outDir) {
  console.error("Использование: edit-plan.mjs <whisper.json> <videoRel> <format> <outDir> [sourceDuration]");
  process.exit(1);
}
const format = formatArg === "stories" ? "stories" : "reels";
const sourceDuration = parseFloat(sourceDurArg) || 0;

// --- параметры модуля (env) ---
const VIDEO_TYPE = (process.env.VIDEO_TYPE || "auto").toLowerCase();
const PURPOSE = (process.env.PURPOSE || format).toLowerCase();
const TEXT_MODE = (process.env.TEXT_MODE || "subs").toLowerCase();
const NO_CUT = process.env.NO_CUT === "1" || process.env.NO_CUT === "yes";
const MANUAL_PATH = process.env.MANUAL_TEXT || "";
let manual = null;
if (MANUAL_PATH && existsSync(MANUAL_PATH)) {
  try { manual = JSON.parse(readFileSync(MANUAL_PATH, "utf8")); }
  catch (e) { console.error("MANUAL_TEXT не читается как JSON:", e.message); }
}

// Безопасные зоны интерфейса (доля кадра) — чтобы текст не попадал под кнопки.
const SAFE = {
  stories: { top: 0.14, bottom: 0.20 },
  reels: { top: 0.10, bottom: 0.18 },
  telegram: { top: 0.06, bottom: 0.08 },
  max: { top: 0.06, bottom: 0.08 },
  whatsapp: { top: 0.06, bottom: 0.08 },
  plain: { top: 0.06, bottom: 0.08 },
}[PURPOSE] || { top: 0.10, bottom: 0.18 };

// Хвост после речи (фирменное правило SOROKINA ST): не обрывать сразу после
// последнего слова — оставить спокойный кадр.
const DESIRED_TAIL = 3.0;
const MIN_TAIL = 1.5;

// --- фирменные правила (те же, что в приложении) ---
const FILLERS = new Set([
  "эээ", "ээ", "эммм", "эмм", "эм", "ааа", "аа", "ну", "вот", "значит",
  "типа", "короче", "короч", "получается", "собственно", "это",
]);
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
// Тёплый жёлтый акцент — только числа/даты/время/короткий призыв.
const MONTHS = ["январ", "феврал", "март", "апрел", "мая", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
const CTA = new Set(["запишись", "записаться", "успей", "жми", "переходи", "ссылка", "скидка", "бесплатно", "дарю", "забронируй", "спеши", "сегодня", "завтра"]);
const MIN_GAP = 0.4;
const PAD = 0.08;

const norm = (w) => String(w).toLowerCase().replace(/[^а-яёa-z]/gi, "");
const isYellowToken = (raw) => {
  const c = norm(raw);
  if (/\d/.test(raw)) return true;
  if (/^\d{1,2}[:.]\d{2}$/.test(String(raw).trim())) return true;
  if (CTA.has(c)) return true;
  if (MONTHS.some((m) => c.startsWith(m))) return true;
  return false;
};

// --- собрать плоский список слов + анализ речи ---
const data = JSON.parse(readFileSync(whisperPath, "utf8"));
let words = [];
let doubtful = [];
for (const seg of data.segments || []) {
  const noSpeech = typeof seg.no_speech_prob === "number" ? seg.no_speech_prob : 0;
  const avgLp = typeof seg.avg_logprob === "number" ? seg.avg_logprob : 0;
  const shaky = noSpeech > 0.6 || avgLp < -1.0;
  for (const w of seg.words || []) {
    const text = String(w.word || "").trim();
    if (!text) continue;
    words.push({ text, start: w.start, end: w.end });
  }
  if (shaky && String(seg.text || "").trim()) doubtful.push(String(seg.text).trim());
}
const hasSpeech = words.length > 0;

// ======================================================================
// ВЕТКА 1. РЕЧИ НЕТ (или тип nospeech) — не выдумываем субтитры.
// ======================================================================
if (!hasSpeech || VIDEO_TYPE === "nospeech") {
  const overlays = buildManualBlocks(manual, sourceDuration);
  const needsText = overlays.length === 0 && TEXT_MODE !== "none";
  // Видео целиком (без нарезки) — filter пустой.
  writeFileSync(resolve(outDir, "filter.txt"), "");
  const props = {
    video: videoRel,
    durationInSeconds: +sourceDuration.toFixed(3) || 0,
    fps: 30, width: 1080, height: 1920,
    format, purpose: PURPOSE, videoType: hasSpeech ? VIDEO_TYPE : "nospeech",
    hasSpeech: false, needsText,
    safe: SAFE,
    subs: overlays,
  };
  writeFileSync(resolve(outDir, "subs.json"), JSON.stringify(props, null, 2));
  writeFileSync(resolve(outDir, "report.json"), JSON.stringify({
    videoType: props.videoType, hasSpeech: false, needsText,
    manualOverlays: overlays.length, doubtfulSegments: doubtful,
    sourceDuration: +sourceDuration.toFixed(2), removedFillers: 0, pausesCut: 0,
    subtitleBlocks: 0, hookMoments: 0, tailAdded: 0, cleanedDuration: +sourceDuration.toFixed(2),
    yellowUsed: overlays.some((b) => (b.words || []).some((w) => w.y)),
  }, null, 2));
  console.log(needsText
    ? "РЕЧЬ НЕ ОБНАРУЖЕНА и текст не задан — нужен текст пользователя (needsText=true)."
    : `Речи нет — ручных подписей: ${overlays.length}.`);
  process.exit(0);
}

// ======================================================================
// ВЕТКА 2. РЕЧЬ ЕСТЬ — прежняя логика чистки + субтитры + (доп.) ручные блоки.
// ======================================================================

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

let segs = [];
let lastSpeechEnd = 0;
let tailAdded = 0;
let cleanedDuration = 0;
let speechEndCleaned = 0;
let kept = [];

if (NO_CUT) {
  // Режим без нарезки: видео и звук остаются как в исходнике (гарантированный синхрон).
  words.forEach((w) => (w.keep = true));
  writeFileSync(resolve(outDir, "filter.txt"), "");
  lastSpeechEnd = words.length ? words[words.length - 1].end : 0;
  cleanedDuration = sourceDuration > 0 ? sourceDuration : lastSpeechEnd + DESIRED_TAIL;
  speechEndCleaned = lastSpeechEnd;
  kept = words.map((w) => ({ text: w.text.trim(), start: w.start, end: w.end }));
} else {
  // --- построить keep-сегменты (речь без пауз и паразитов) ---
  let cur = null;
  let lastEnd = null;
  let brokeByFiller = false;
  for (const w of words) {
    if (!w.keep) { brokeByFiller = true; continue; }
    if (cur === null) {
      cur = { start: Math.max(0, w.start - PAD), end: w.end + PAD };
      lastEnd = w.end; brokeByFiller = false; continue;
    }
    const gap = w.start - lastEnd;
    if (!brokeByFiller && gap <= MIN_GAP) {
      cur.end = w.end + PAD;
    } else {
      segs.push(cur);
      cur = { start: Math.max(cur.end, w.start - PAD), end: w.end + PAD };
    }
    lastEnd = w.end; brokeByFiller = false;
  }
  if (cur) segs.push(cur);

  const keptWords = words.filter((w) => w.keep);
  lastSpeechEnd = keptWords.length ? keptWords[keptWords.length - 1].end : 0;
  if (segs.length && sourceDuration > 0) {
    const lastSeg = segs[segs.length - 1];
    const availableTail = sourceDuration - lastSpeechEnd;
    let finalEnd;
    if (availableTail <= 0) finalEnd = sourceDuration;
    else if (availableTail < MIN_TAIL) finalEnd = sourceDuration;
    else finalEnd = Math.min(sourceDuration, lastSpeechEnd + DESIRED_TAIL);
    if (finalEnd > lastSeg.end) { tailAdded = finalEnd - lastSeg.end; lastSeg.end = finalEnd; }
  }

  cleanedDuration = segs.reduce((a, s) => a + (s.end - s.start), 0);
  speechEndCleaned = cleanedDuration - (segs.length ? (segs[segs.length - 1].end - lastSpeechEnd) : 0);

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

  let outCursor = 0;
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
}

// --- смысловая разбивка (одна законченная мысль — один блок) ---
const isHookText = (t) => {
  const low = t.toLowerCase();
  if (t.indexOf("?") >= 0) return true;
  return HOOKS.some((h) => low.indexOf(h) >= 0);
};
const BREAK_SINGLE = ["но", "а", "поэтому", "потому", "хотя", "если", "когда", "чтобы", "зато", "однако", "и"];
const BREAK_MULTI = ["потому что", "и вот", "но потом", "самое интересное", "именно поэтому", "и вот здесь", "и знаете"];
const INTRO_PHRASES = ["честно", "знаете", "например", "в последнее время", "мне кажется", "короче говоря", "представьте"];
const PROTECTED_PHRASES = ["лазерная эпиляция", "восковая депиляция", "следующая процедура", "пройти курс", "не хочу", "не могу", "не против", "не буду", "не надо", "не стоит"];
const cln = (s) => String(s).toLowerCase().replace(/[.,!?;:…"«»]/g, "").trim();
const noSpace = (arr) => arr.map((w) => w.text).join("").replace(/\s/g, "");
const isProtectedBoundary = (prevWord, curWord) => {
  if (!prevWord) return false;
  const pair = cln(prevWord) + " " + cln(curWord);
  return PROTECTED_PHRASES.some((p) => p.includes(pair));
};
const wantBreakBefore = (sent, i) => {
  const c = cln(sent[i].text);
  if (BREAK_SINGLE.includes(c)) return true;
  const two = i + 1 < sent.length ? c + " " + cln(sent[i + 1].text) : c;
  const three = i + 2 < sent.length ? two + " " + cln(sent[i + 2].text) : two;
  return BREAK_MULTI.some((m) => m === two || m === three || m.startsWith(two + " "));
};
const chunkSentence = (sent) => {
  const chunks = [];
  let current = [];
  for (let i = 0; i < sent.length; i += 1) {
    const w = sent[i];
    const prevWord = current.length ? current[current.length - 1].text : "";
    const tooManyWords = current.length >= 6;
    const tooLong = noSpace(current.concat(w)).length > 30;
    const semanticBreak = current.length >= 2 && wantBreakBefore(sent, i) && !isProtectedBoundary(prevWord, w.text);
    if ((tooManyWords || tooLong || semanticBreak) && current.length > 0) {
      chunks.push(current); current = [w];
    } else { current.push(w); }
    const phrase = current.map((x) => cln(x.text)).join(" ");
    if (current.length >= 1 && INTRO_PHRASES.includes(phrase)) { chunks.push(current); current = []; }
  }
  if (current.length) chunks.push(current);
  const merged = [];
  for (const c of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && c.length <= 1 && prev.length < 5 && noSpace(prev.concat(c)).length <= 30) {
      merged[merged.length - 1] = prev.concat(c);
    } else { merged.push(c); }
  }
  return merged;
};

const sentences = [];
let sbuf = [];
for (const w of kept) {
  sbuf.push(w);
  if (/[.!?…]$/.test(w.text)) { sentences.push(sbuf); sbuf = []; }
}
if (sbuf.length) sentences.push(sbuf);
const rawBlocks = sentences.flatMap(chunkSentence);

// зона субтитров по типу видео: голова — сверху (над лицом); закадр — снизу.
const zoneFor = (bi) => {
  if (VIDEO_TYPE === "voiceover") return "bottom";
  if (VIDEO_TYPE === "head" || VIDEO_TYPE === "mixed" || VIDEO_TYPE === "auto") return "top";
  return "top";
};

const blocks = rawBlocks.map((cw, bi) => {
  const scored = cw.map((w, i) => {
    const n = norm(w.text);
    return { i, n, len: n.length, starter: STARTERS.has(n) };
  });
  // максимум ОДНО фиолетовое (сильное содержательное слово)
  const cand = scored.filter((s) => !s.starter && s.len >= 6).sort((a, b) => b.len - a.len);
  const violetSet = new Set(cand.slice(0, 1).map((s) => s.i));
  // максимум ОДИН жёлтый (число/дата/CTA), не совпадает с фиолетовым
  let yellowIdx = -1;
  for (let i = 0; i < cw.length; i++) {
    if (violetSet.has(i)) continue;
    if (isYellowToken(cw[i].text)) { yellowIdx = i; break; }
  }
  const fullText = cw.map((w) => w.text).join(" ");
  return {
    kind: "sub",
    zone: zoneFor(bi),
    from: +cw[0].start.toFixed(3),
    to: +cw[cw.length - 1].end.toFixed(3),
    hook: isHookText(fullText),
    pos: bi % 2,
    words: cw.map((w, i) => ({
      t: +w.start.toFixed(3),
      w: w.text.replace(/[.;:!?…]+$/, ""),
      a: violetSet.has(i),
      y: i === yellowIdx,
    })),
  };
});

// растянуть блок до начала следующего (чтобы титр не мигал в паузах речи)
for (let i = 0; i < blocks.length - 1; i++) {
  blocks[i].to = Math.max(blocks[i].to, blocks[i + 1].from);
}
if (blocks.length) {
  const last = blocks[blocks.length - 1];
  last.to = Math.min(cleanedDuration, Math.max(last.to, speechEndCleaned + 0.6));
}

// --- доп. ручные блоки (заголовок / финальная подпись / таймкоды) ---
const extra = buildManualBlocks(manual, cleanedDuration, TEXT_MODE);
const allBlocks = TEXT_MODE === "caption" && extra.length ? extra : blocks.concat(extra);

const props = {
  video: videoRel,
  durationInSeconds: +cleanedDuration.toFixed(3),
  fps: 30, width: 1080, height: 1920,
  format, purpose: PURPOSE, videoType: VIDEO_TYPE === "auto" ? "head" : VIDEO_TYPE,
  hasSpeech: true, needsText: false,
  safe: SAFE,
  subs: allBlocks,
};
writeFileSync(resolve(outDir, "subs.json"), JSON.stringify(props, null, 2));

const removed = words.filter((w) => !w.keep).length;
const hooks = blocks.filter((b) => b.hook).length;
const yellowUsed = allBlocks.some((b) => (b.words || []).some((w) => w.y));
writeFileSync(resolve(outDir, "report.json"), JSON.stringify({
  videoType: props.videoType, hasSpeech: true, needsText: false,
  removedFillers: removed, speechSegments: segs.length,
  pausesCut: Math.max(0, segs.length - 1), subtitleBlocks: blocks.length,
  manualOverlays: extra.length, hookMoments: hooks, yellowUsed,
  doubtfulSegments: doubtful,
  sourceDuration: +sourceDuration.toFixed(2), lastSpeechEnd: +lastSpeechEnd.toFixed(2),
  tailAdded: +tailAdded.toFixed(2), cleanedDuration: +cleanedDuration.toFixed(2),
}, null, 2));
console.log(
  `Тип: ${props.videoType} · сегментов речи: ${segs.length} · паразитов: ${removed} · ` +
  `блоков: ${blocks.length} · ручных: ${extra.length} · жёлтый: ${yellowUsed ? "да" : "нет"} · ` +
  `хуков: ${hooks} · длит.: ${cleanedDuration.toFixed(1)}с` +
  (doubtful.length ? ` · сомнительных фрагментов: ${doubtful.length}` : ""),
);

// ======================================================================
// Ручные подписи → блоки субтитров (kind: title | caption)
// ======================================================================
function buildManualBlocks(m, duration, mode) {
  if (!m) return [];
  const dur = duration > 0 ? duration : 10;
  const items = [];
  // Явные items с таймкодами
  if (Array.isArray(m.items)) {
    m.items.forEach((it) => it && it.text && items.push(it));
  }
  // Удобные поля
  if (m.hero) items.push({ text: m.hero, size: "hero", pos: "center" });
  if (m.title) items.push({ text: m.title, size: "hero", pos: (m.subtitle ? "center" : "center") });
  if (m.subtitle) items.push({ text: m.subtitle, size: "caption", pos: "center" });
  if (m.final) items.push({ text: m.final, size: "caption", pos: "bottom", final: true });
  if (!items.length) return [];

  const n = items.length;
  return items.map((it, i) => {
    const size = it.size === "caption" ? "caption" : "hero";
    const kind = size === "hero" ? "title" : "caption";
    const zone = it.pos === "top" ? "top" : it.pos === "bottom" ? "bottom" : "center";
    // тайминги: явные, иначе равномерно по ролику; финал держим до конца
    let from = typeof it.from === "number" ? it.from : (n === 1 ? Math.min(0.4, dur * 0.05) : (i * dur) / n);
    let to = typeof it.to === "number" ? it.to : (it.final ? dur : (n === 1 ? dur : ((i + 1) * dur) / n));
    from = Math.max(0, Math.min(from, dur));
    to = Math.max(from + 0.6, Math.min(to, dur));
    const accent = new Set((it.accent || []).map((x) => norm(x)));
    const forceColor = (it.color || "").toLowerCase(); // 'violet' | 'yellow'
    const tokens = String(it.text).split(/\s+/).filter(Boolean);
    // одно фиолетовое (если не задано вручную): самое длинное содержательное
    let autoViolet = -1;
    if (!accent.size && forceColor !== "yellow") {
      let best = -1, bestLen = 5;
      tokens.forEach((tk, ti) => { const nn = norm(tk); if (!STARTERS.has(nn) && nn.length > bestLen) { bestLen = nn.length; best = ti; } });
      autoViolet = best;
    }
    const wds = tokens.map((tk, ti) => {
      const nn = norm(tk);
      const isAcc = accent.has(nn);
      let violet = false, yellow = false;
      if (isAcc) { if (forceColor === "yellow") yellow = true; else violet = true; }
      if (ti === autoViolet) violet = true;
      return { t: +from.toFixed(3), w: tk, a: violet, y: yellow };
    });
    // Не больше одного жёлтого на строку (жёлтый — редкий акцент): число/дата в приоритете.
    if (!wds.some((w) => w.y)) {
      let yPick = -1;
      tokens.forEach((tk, ti) => { if (yPick < 0 && /\d/.test(tk)) yPick = ti; });
      if (yPick < 0) tokens.forEach((tk, ti) => { if (yPick < 0 && isYellowToken(tk)) yPick = ti; });
      if (yPick >= 0) { wds[yPick].y = true; wds[yPick].a = false; }
    }
    return { kind, zone, from: +from.toFixed(3), to: +to.toFixed(3), hook: false, pos: 0, words: wds };
  });
}
