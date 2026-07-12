#!/usr/bin/env bash
# Полный монтаж одного ролика по правилам SOROKINA ST (запускать из reels-builder).
#   bash ../scripts/edit-one.sh <DRIVE_FILE_ID> <OUT_NAME> <AUDIO_MODE> <ENHANCE>
# Результат: out/<OUT_NAME>.mp4  + строка отчёта в out/report.md
set -e
FILEID="$1"; OUT="$2"; MODE="${3:-room_echo}"; ENH="${4:-yes}"
if [ -z "$FILEID" ] || [ -z "$OUT" ]; then echo "usage: edit-one.sh <id> <out> [mode] [enhance]"; exit 1; fi
NUM=$(printf '%s' "$OUT" | grep -oE '[0-9]+' | head -1)

rm -rf public/edit; mkdir -p public/edit out

echo "[$OUT] качаю $FILEID"
gdown "$FILEID" -O public/edit/raw.src

# (7) Нормализация: любой кодек/контейнер → стандарт H.264/AAC/MP4, постоянный
# кадр (CFR 30fps) и 48kHz. Чинит «не прогрузилось» и рассинхрон из-за VFR.
echo "[$OUT] нормализую исходник (H.264/AAC, CFR 30fps, 48kHz)"
ffmpeg -y -i public/edit/raw.src \
  -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30 -fps_mode cfr \
  -c:a aac -ar 48000 -ac 2 -movflags +faststart public/edit/input.mp4
SRCDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/input.mp4)
echo "[$OUT] исходная длительность: ${SRCDUR}с"

echo "[$OUT] распознаю речь"
whisper public/edit/input.mp4 --model small --language Russian \
  --word_timestamps True --output_format json --output_dir public/edit --fp16 False

echo "[$OUT] план монтажа (+хвост после речи)"
node scripts/edit-plan.mjs public/edit/input.json edit/cleaned.mp4 reels public/edit "$SRCDUR"

echo "[$OUT] режу паузы и паразитов (видео и звук по общим меткам)"
if [ -s public/edit/filter.txt ]; then
  ffmpeg -y -i public/edit/input.mp4 -filter_complex_script public/edit/filter.txt \
    -map "[outv]" -map "[outa]" -r 30 -fps_mode cfr -pix_fmt yuv420p -movflags +faststart public/edit/cut.mp4
else
  ffmpeg -y -i public/edit/input.mp4 -r 30 -fps_mode cfr -pix_fmt yuv420p public/edit/cut.mp4
fi

echo "[$OUT] картинка"
if [ "$ENH" = "yes" ]; then
  ffmpeg -y -i public/edit/cut.mp4 -filter_complex \
    "[0:v]hqdn3d=1.5:1.5:6:6,eq=contrast=1.05:brightness=0.04:saturation=1.10:gamma=1.05[base];[base]split[s1][s2];[s2]gblur=sigma=7[soft];[s1][soft]blend=all_mode=softlight:all_opacity=0.14,unsharp=5:5:0.6:5:5:0.0[outv]" \
    -map "[outv]" -an -r 30 -fps_mode cfr -pix_fmt yuv420p -movflags +faststart public/edit/video.mp4
else
  ffmpeg -y -i public/edit/cut.mp4 -map 0:v -c:v copy -an public/edit/video.mp4
fi

echo "[$OUT] звук (режим $MODE)"
ffmpeg -y -i public/edit/cut.mp4 -vn -ac 1 -ar 48000 public/edit/orig.wav
POLISH="deesser,acompressor=threshold=-18dB:ratio=2.5:attack=15:release=150,loudnorm=I=-16:LRA=7:TP=-1.5,alimiter=limit=0.97"
if [ "$MODE" = "original" ]; then
  cp public/edit/orig.wav public/edit/proc.wav
elif [ "$MODE" = "natural" ]; then
  ffmpeg -y -i public/edit/orig.wav -af "highpass=f=80,lowpass=f=15000,afftdn=nf=-20,${POLISH}" public/edit/proc.wav || true
else
  DFN=""
  if command -v deepFilter >/dev/null 2>&1; then
    if [ "$MODE" = "strong_repair" ]; then ATT=""; else ATT="--atten-lim 25"; fi
    deepFilter public/edit/orig.wav --output-dir public/edit $ATT || true
    DFN=$(ls public/edit/orig_DeepFilterNet*.wav 2>/dev/null | head -1)
  fi
  if [ -n "$DFN" ]; then
    if [ "$MODE" = "strong_repair" ]; then EXTRA="afftdn=nf=-24,"; else EXTRA=""; fi
    ffmpeg -y -i "$DFN" -af "highpass=f=80,${EXTRA}${POLISH}" public/edit/proc.wav || true
  else
    if [ "$MODE" = "strong_repair" ]; then NF="-30"; GATE="agate=threshold=0.08:ratio=3:attack=8:release=180,"; else NF="-25"; GATE="agate=threshold=0.05:ratio=2:attack=10:release=220,"; fi
    ffmpeg -y -i public/edit/orig.wav -af "highpass=f=85,${GATE}afftdn=nf=${NF},lowpass=f=15000,${POLISH}" public/edit/proc.wav || true
  fi
fi
# (6) контроль качества звука → откат на оригинал при проблеме
fallback=0
[ -s public/edit/proc.wav ] || fallback=1
od=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/orig.wav 2>/dev/null || echo 0)
pd=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/proc.wav 2>/dev/null || echo 0)
big=$(python3 -c "print(1 if abs(${od:-0}-${pd:-0})>0.35 else 0)" 2>/dev/null || echo 1)
mean=$(ffmpeg -i public/edit/proc.wav -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: -?[0-9.]+" | grep -oE "\-?[0-9.]+" | head -1)
low=$(python3 -c "print(1 if ${mean:--99} < -45 else 0)" 2>/dev/null || echo 0)
[ "$MODE" = "original" ] && big=0 && low=0
if [ "$big" = "1" ] || [ "$low" = "1" ]; then fallback=1; fi
if [ "$fallback" = "1" ]; then echo "[$OUT] звук: откат на оригинал"; cp public/edit/orig.wav public/edit/final.wav; AUDIONOTE="оригинал"; else cp public/edit/proc.wav public/edit/final.wav; AUDIONOTE="$MODE"; fi

echo "[$OUT] свожу видео+звук (звук подгоняю к видео, без рассинхрона)"
# apad + shortest → длина аудио точно = длине видео, никакого хвостового дрейфа
ffmpeg -y -i public/edit/video.mp4 -i public/edit/final.wav \
  -filter_complex "[1:a]apad[a]" -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart public/edit/cleaned.mp4

# точная длительность в props (для рендера)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/cleaned.mp4)
node -e "const fs=require('fs');const f='public/edit/subs.json';const j=JSON.parse(fs.readFileSync(f,'utf8'));const d=parseFloat(process.argv[1]);if(d>0)j.durationInSeconds=d;fs.writeFileSync(f,JSON.stringify(j,null,2))" "$DUR"

echo "[$OUT] рендер субтитров"
npx remotion render src/index.ts Subtitle-Edit --props=./public/edit/subs.json --output "out/${OUT}.mp4" --log=error

# ---- (9)(10) контроль качества финального файла + строка отчёта ----
FDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "out/${OUT}.mp4" 2>/dev/null || echo 0)
ADUR=$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 "out/${OUT}.mp4" 2>/dev/null || echo 0)
VDUR=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "out/${OUT}.mp4" 2>/dev/null || echo 0)
HASA=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "out/${OUT}.mp4" 2>/dev/null | head -1)
SYNCMS=$(python3 -c "print(round(abs(${VDUR:-0}-${ADUR:-0})*1000))" 2>/dev/null || echo 999)
LOADS=$([ "$(python3 -c "print(1 if ${FDUR:-0}>0.5 else 0)")" = "1" ] && echo OK || echo "ПОВРЕЖДЁН")
AUDIO_OK=$([ "$HASA" = "audio" ] && echo OK || echo "НЕТ")
read SRC LSE TAIL CLD < <(node -e "const r=require('./public/edit/report.json');console.log(r.sourceDuration,r.lastSpeechEnd,r.tailAdded,r.cleanedDuration)" 2>/dev/null || echo "0 0 0 0")
STATUS="готово"
[ "$AUDIO_OK" != "OK" ] && STATUS="БЕЗ ЗВУКА — пересобрать"
[ "$LOADS" != "OK" ] && STATUS="ПОВРЕЖДЁН — пересобрать"
[ "$(python3 -c "print(1 if ${SYNCMS:-999}>80 else 0)")" = "1" ] && STATUS="РАССИНХРОН — пересобрать"
[ "$(python3 -c "a=${TAIL:-0}; av=${SRC:-0}-${LSE:-0}; print(1 if (a<1.5 and av>=1.5) else 0)")" = "1" ] && STATUS="КОРОТКИЙ ХВОСТ — пересобрать"
printf '| %s | %s | %s | %s | %s | %s мс | %s | %s | %s |\n' \
  "$NUM" "$SRC" "$LSE" "$TAIL" "$FDUR" "$SYNCMS" "$AUDIO_OK" "$LOADS" "$STATUS" >> out/report.md
echo "[$OUT] готово → out/${OUT}.mp4 | хвост ${TAIL}с | sync ${SYNCMS}мс | звук ${AUDIO_OK} | ${STATUS}"
