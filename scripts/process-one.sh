#!/usr/bin/env bash
# «Обработать отдельное видео» — самостоятельный сценарий SOROKINA ST.
# Запускать из reels-builder. Не зависит от контент-плана.
#
#   bash ../scripts/process-one.sh <DRIVE_URL_or_ID> <OUT_NAME>
#
# Управление через переменные окружения:
#   VIDEO_TYPE   = auto | head | voiceover | nospeech | mixed
#   PURPOSE      = stories | reels | telegram | max | whatsapp | plain
#   TEXT_MODE    = subs | caption | subs_title | subs_caption | timecoded | none
#   MANUAL_TEXT  = JSON-строка с ручными подписями (или пусто)
#   AUDIO_OPT    = keep | natural | room_echo | strong_repair | mute | music | voiceover
#   VOICEOVER_URL= ссылка на аудио для закадровой озвучки (если AUDIO_OPT=voiceover)
#   ENHANCE      = yes | no
#   WHISPER_MODEL= small | medium
#   PREVIEW_ONLY = yes | no   (yes = только транскрипт+план, без финального рендера)
set -e
SRC="$1"; OUT="${2:-video}"
VIDEO_TYPE="${VIDEO_TYPE:-auto}"; PURPOSE="${PURPOSE:-stories}"; TEXT_MODE="${TEXT_MODE:-subs}"
AUDIO_OPT="${AUDIO_OPT:-keep}"; ENHANCE="${ENHANCE:-yes}"; WHISPER_MODEL="${WHISPER_MODEL:-small}"
PREVIEW_ONLY="${PREVIEW_ONLY:-no}"
if [ -z "$SRC" ]; then echo "usage: process-one.sh <drive-url|id> <out> "; exit 1; fi

rm -rf public/edit; mkdir -p public/edit out
export PURPOSE TEXT_MODE VIDEO_TYPE

# формат для Remotion (safe-зоны): stories → stories, иначе reels
FMT=reels; [ "$PURPOSE" = "stories" ] && FMT=stories

echo "[$OUT] качаю исходник"
FILEID=$(printf '%s' "$SRC" | grep -oE '[-_A-Za-z0-9]{25,}' | head -1)
[ -z "$FILEID" ] && FILEID="$SRC"
gdown "$FILEID" -O public/edit/raw.src

# ---- (Тип/формат) свойства исходника ----
RW=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 public/edit/raw.src 2>/dev/null | head -1)
RH=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 public/edit/raw.src 2>/dev/null | head -1)
HASA=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 public/edit/raw.src 2>/dev/null | head -1)
echo "[$OUT] исходник ${RW}x${RH}, звук: ${HASA:-нет}"

# ---- (Формат 9:16) умное вертикальное кадрирование БЕЗ растяжения ----
# Универсальный приём: размытый фон-заливка (cover) + сам кадр вписан (contain)
# по центру. Для уже вертикального видео фон полностью скрыт — обычная вертикаль.
# Для горизонтального — по бокам мягкое размытие, ничего не обрезается.
echo "[$OUT] нормализую в 9:16 1080x1920 (умное кадрирование, без искажений)"
VF="[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:6,eq=brightness=-0.06[bg];[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[outv]"
if [ -n "$HASA" ]; then
  ffmpeg -y -i public/edit/raw.src -filter_complex "$VF" -map "[outv]" -map 0:a:0 \
    -c:v libx264 -preset veryfast -crf 20 -r 30 -fps_mode cfr -c:a aac -ar 48000 -ac 2 \
    -movflags +faststart public/edit/input.mp4
else
  ffmpeg -y -i public/edit/raw.src -filter_complex "$VF" -map "[outv]" \
    -c:v libx264 -preset veryfast -crf 20 -r 30 -fps_mode cfr \
    -movflags +faststart public/edit/input.mp4
fi
SRCDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/input.mp4)
echo "[$OUT] длительность: ${SRCDUR}с"

# ---- (Транскрибация) только реальная речь текущего файла ----
if [ "$VIDEO_TYPE" = "nospeech" ] || [ -z "$HASA" ]; then
  echo "[$OUT] пропускаю распознавание (нет речи/звука) — субтитры не выдумываю"
  printf '{"segments":[]}' > public/edit/input.json
else
  echo "[$OUT] распознаю речь (модель $WHISPER_MODEL)"
  whisper public/edit/input.mp4 --model "$WHISPER_MODEL" --language Russian \
    --word_timestamps True --output_format json --output_dir public/edit --fp16 False
fi

# ---- ручные подписи (если заданы) ----
if [ -n "$MANUAL_TEXT" ]; then
  printf '%s' "$MANUAL_TEXT" > public/edit/manual.json
  export MANUAL_TEXT="$PWD/public/edit/manual.json"
else
  unset MANUAL_TEXT
fi

echo "[$OUT] план монтажа (тип=$VIDEO_TYPE, назначение=$PURPOSE)"
node scripts/edit-plan.mjs public/edit/input.json edit/cleaned.mp4 "$FMT" public/edit "$SRCDUR"

NEEDS=$(node -e "try{console.log(require('./public/edit/report.json').needsText?1:0)}catch(e){console.log(0)}")
HASSPEECH=$(node -e "try{console.log(require('./public/edit/report.json').hasSpeech?1:0)}catch(e){console.log(0)}")

# ---- (Тип 3) ГАРД: речи нет и текста нет → не рендерим пустой экран ----
if [ "$NEEDS" = "1" ]; then
  echo "NO_TEXT_NEEDED_PROMPT"
  echo "В видео не обнаружена речь. Нужно указать текст (заголовок / подпись / по таймкодам) или выбрать «без текста»." >&2
  cp public/edit/raw.src "out/${OUT}-original.mov" 2>/dev/null || true
  exit 42
fi

# ---- (Предпросмотр) остановиться до финального рендера ----
if [ "$PREVIEW_ONLY" = "yes" ]; then
  echo "[$OUT] предпросмотр: транскрипт + план субтитров"
  node -e "const j=require('./public/edit/subs.json');const lines=j.subs.map(b=>'['+b.kind+'/'+b.zone+'] '+b.words.map(w=>w.w+(w.a?'·V':'')+(w.y?'·Y':'')).join(' '));require('fs').writeFileSync('out/'+process.argv[1]+'-preview.txt', 'ПРЕДПРОСМОТР '+process.argv[1]+'\n\nТип: '+j.videoType+' · речь: '+(j.hasSpeech?'да':'нет')+'\n\nСубтитры/подписи:\n'+lines.join('\n'))" "$OUT"
  cat "out/${OUT}-preview.txt"
  exit 0
fi

echo "[$OUT] режу паузы/паразитов (если есть речь)"
if [ -s public/edit/filter.txt ]; then
  ffmpeg -y -i public/edit/input.mp4 -filter_complex_script public/edit/filter.txt \
    -map "[outv]" -map "[outa]" -r 30 -fps_mode cfr -pix_fmt yuv420p -movflags +faststart public/edit/cut.mp4
else
  ffmpeg -y -i public/edit/input.mp4 -r 30 -fps_mode cfr -pix_fmt yuv420p public/edit/cut.mp4
fi

echo "[$OUT] картинка"
if [ "$ENHANCE" = "yes" ]; then
  ffmpeg -y -i public/edit/cut.mp4 -filter_complex \
    "[0:v]hqdn3d=1.5:1.5:6:6,eq=contrast=1.05:brightness=0.04:saturation=1.10:gamma=1.05[base];[base]split[s1][s2];[s2]gblur=sigma=7[soft];[s1][soft]blend=all_mode=softlight:all_opacity=0.14,unsharp=5:5:0.6:5:5:0.0[outv]" \
    -map "[outv]" -an -r 30 -fps_mode cfr -pix_fmt yuv420p -movflags +faststart public/edit/video.mp4
else
  ffmpeg -y -i public/edit/cut.mp4 -map 0:v -c:v copy -an public/edit/video.mp4
fi

# ---- (Звук) по выбранной опции ----
VDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/video.mp4)
AUDIONOTE=""
POLISH="deesser,acompressor=threshold=-18dB:ratio=2.5:attack=15:release=150,loudnorm=I=-16:LRA=7:TP=-1.5,alimiter=limit=0.97"
have_cut_audio=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 public/edit/cut.mp4 2>/dev/null | head -1)

make_silence(){ ffmpeg -y -f lavfi -t "$VDUR" -i anullsrc=r=48000:cl=stereo -c:a aac -b:a 96k public/edit/final.m4a; }

case "$AUDIO_OPT" in
  mute)
    echo "[$OUT] звук: выключен"; make_silence; AUDIOSRC="public/edit/final.m4a"; AUDIONOTE="без звука" ;;
  voiceover)
    if [ -n "$VOICEOVER_URL" ]; then
      echo "[$OUT] звук: закадровая озвучка из файла"
      VOID=$(printf '%s' "$VOICEOVER_URL" | grep -oE '[-_A-Za-z0-9]{25,}' | head -1); [ -z "$VOID" ] && VOID="$VOICEOVER_URL"
      gdown "$VOID" -O public/edit/vo.src || curl -sL "$VOICEOVER_URL" -o public/edit/vo.src || true
      ffmpeg -y -i public/edit/vo.src -ac 2 -ar 48000 -c:a aac -b:a 160k public/edit/final.m4a && AUDIOSRC="public/edit/final.m4a" && AUDIONOTE="закадровая озвучка"
    fi
    if [ -z "$AUDIOSRC" ]; then echo "[$OUT] озвучка не получена — оставляю оригинал"; fi ;;
esac

if [ -z "$AUDIOSRC" ]; then
  if [ -z "$have_cut_audio" ]; then
    echo "[$OUT] в кадре нет звука — тишина"; make_silence; AUDIOSRC="public/edit/final.m4a"; AUDIONOTE="без звука"
  elif [ "$AUDIO_OPT" = "keep" ] || [ "$AUDIO_OPT" = "music" ]; then
    ffmpeg -y -i public/edit/cut.mp4 -vn -ac 2 -ar 48000 -c:a aac -b:a 160k public/edit/final.m4a
    AUDIOSRC="public/edit/final.m4a"
    AUDIONOTE="оригинальный звук"; [ "$AUDIO_OPT" = "music" ] && AUDIONOTE="оригинальный звук (оставлено место под музыку из Instagram)"
  else
    # natural / room_echo / strong_repair — очистка речи с контролем качества
    MODE="$AUDIO_OPT"
    ffmpeg -y -i public/edit/cut.mp4 -vn -ac 1 -ar 48000 public/edit/orig.wav
    if [ "$MODE" = "natural" ]; then
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
    # контроль качества → откат на оригинал
    fb=0; [ -s public/edit/proc.wav ] || fb=1
    od=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/orig.wav 2>/dev/null || echo 0)
    pd=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/proc.wav 2>/dev/null || echo 0)
    big=$(python3 -c "print(1 if abs(${od:-0}-${pd:-0})>0.35 else 0)" 2>/dev/null || echo 1)
    mean=$(ffmpeg -i public/edit/proc.wav -af volumedetect -f null - 2>&1 | grep -oE "mean_volume: -?[0-9.]+" | grep -oE "\-?[0-9.]+" | head -1)
    low=$(python3 -c "print(1 if ${mean:--99} < -45 else 0)" 2>/dev/null || echo 0)
    if [ "$big" = "1" ] || [ "$low" = "1" ] || [ "$fb" = "1" ]; then
      cp public/edit/orig.wav public/edit/final.wav; AUDIONOTE="оригинал (обработка ухудшала звук)"
    else
      cp public/edit/proc.wav public/edit/final.wav; AUDIONOTE="очистка: $MODE"
    fi
    ffmpeg -y -i public/edit/final.wav -ac 2 -ar 48000 -c:a aac -b:a 160k public/edit/final.m4a
    AUDIOSRC="public/edit/final.m4a"
  fi
fi

echo "[$OUT] свожу видео+звук (apad+shortest — без рассинхрона)"
ffmpeg -y -i public/edit/video.mp4 -i "$AUDIOSRC" \
  -filter_complex "[1:a]apad[a]" -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart public/edit/cleaned.mp4

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 public/edit/cleaned.mp4)
node -e "const fs=require('fs');const f='public/edit/subs.json';const j=JSON.parse(fs.readFileSync(f,'utf8'));const d=parseFloat(process.argv[1]);if(d>0)j.durationInSeconds=d;fs.writeFileSync(f,JSON.stringify(j,null,2))" "$DUR"

echo "[$OUT] рендер субтитров/подписей"
npx remotion render src/index.ts Subtitle-Edit --props=./public/edit/subs.json --output "out/${OUT}.mp4" --log=error

# ---- (Проверка) A/V sync, загрузка, хвост ----
FDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "out/${OUT}.mp4" 2>/dev/null || echo 0)
VT=$(ffmpeg -i "out/${OUT}.mp4" -map 0:v:0 -f null - 2>&1 | grep -oE 'time=[0-9:.]+' | tail -1 | sed 's/time=//')
AT=$(ffmpeg -i "out/${OUT}.mp4" -map 0:a:0 -f null - 2>&1 | grep -oE 'time=[0-9:.]+' | tail -1 | sed 's/time=//')
SYNCMS=$(python3 -c "
def s(t):
    p=str(t).split(':')
    try: return float(p[0])*3600+float(p[1])*60+float(p[2]) if len(p)==3 else float(t)
    except: return 0.0
print(round(abs(s('${VT:-0}')-s('${AT:-0}'))*1000))
" 2>/dev/null || echo 999)
LOADS=$([ "$(python3 -c "print(1 if ${FDUR:-0}>0.5 else 0)")" = "1" ] && echo OK || echo "ПОВРЕЖДЁН")
read SRCD LSE TAIL CLD TYP < <(node -e "const r=require('./public/edit/report.json');console.log(r.sourceDuration,r.lastSpeechEnd||0,r.tailAdded,r.cleanedDuration,r.videoType)" 2>/dev/null || echo "0 0 0 0 ?")
STATUS="готово"
[ "$LOADS" != "OK" ] && STATUS="ПОВРЕЖДЁН — пересобрать"
[ "$(python3 -c "print(1 if ${SYNCMS:-999}>80 else 0)")" = "1" ] && STATUS="РАССИНХРОН — пересобрать"
cp public/edit/raw.src "out/${OUT}-original.mov" 2>/dev/null || cp public/edit/input.mp4 "out/${OUT}-original.mp4" 2>/dev/null || true
printf '| %s | %s | %s | %s | %s | %s | %s мс | %s | %s |\n' \
  "$OUT" "$TYP" "$SRCD" "$LSE" "$TAIL" "$FDUR" "$SYNCMS" "$AUDIONOTE" "$STATUS" >> out/report.md
echo "[$OUT] готово → out/${OUT}.mp4 | тип ${TYP} | sync ${SYNCMS}мс | звук ${AUDIONOTE} | ${STATUS}"
