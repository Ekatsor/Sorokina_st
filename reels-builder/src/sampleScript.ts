import type { ReelScript } from "./types";

export const laserScript: ReelScript = {
  theme: "laser",
  format: "talking-head-broll",
  duration: 30,
  tone: "calm-premium",
  title: "Лазер без мифов",
  spokenLines: [
    { text: "Я слышу это каждый день.", startSec: 0.5, endSec: 2.5 },
    { text: "«Больно. Дорого. Не навсегда».", startSec: 3.0, endSec: 5.5 },
    { text: "Разберём каждый миф честно.", startSec: 6.0, endSec: 8.5 },
    { text: "Боль — это вопрос настроек, не лазера.", startSec: 10.0, endSec: 13.0 },
    { text: "Правильный параметр под вашу кожу — и всё иначе.", startSec: 13.5, endSec: 17.5 },
    { text: "Дорого? Или один раз и навсегда?", startSec: 18.5, endSec: 21.5 },
    { text: "Считайте вместе со мной.", startSec: 22.0, endSec: 24.0 },
  ],
  frames: [
    { clipIndex: 0, startSec: 0, endSec: 9 },
    { clipIndex: 1, startSec: 9, endSec: 18, caption: "Диодный лазер 810 нм — голень 12 мин" },
    { clipIndex: 2, startSec: 18, endSec: 27, caption: "До и после · 6 сеансов" },
  ],
  cta: "Запись — ссылка в шапке профиля",
};

export const pdrnScript: ReelScript = {
  theme: "pdrn",
  format: "expert-observation",
  duration: 45,
  tone: "soft-caring",
  title: "PDRN — что это такое на самом деле",
  spokenLines: [
    { text: "PDRN — это не уколы молодости.", startSec: 1.0, endSec: 4.0 },
    { text: "Это ДНК лосося.", startSec: 4.5, endSec: 6.5 },
    { text: "Звучит странно. Работает удивительно.", startSec: 7.0, endSec: 10.0 },
    { text: "Ваша кожа буквально учится восстанавливаться.", startSec: 11.0, endSec: 14.5 },
    { text: "Не маскировать — а регенерировать.", startSec: 15.0, endSec: 18.0 },
    { text: "Подходит после лазера, стресса, зимы.", startSec: 20.0, endSec: 24.0 },
    { text: "Первый результат — уже после второй процедуры.", startSec: 25.0, endSec: 29.0 },
    { text: "Это не магия. Это биохимия.", startSec: 30.0, endSec: 33.0 },
  ],
  frames: [
    { clipIndex: 0, startSec: 0, endSec: 10 },
    { clipIndex: 1, startSec: 10, endSec: 22, caption: "Зона декольте — восстановление" },
    { clipIndex: 2, startSec: 22, endSec: 35, caption: "Результат через 3 недели" },
    { clipIndex: 3, startSec: 35, endSec: 42 },
  ],
  cta: "DM для записи или вопроса",
};

export const clientStoryScript: ReelScript = {
  theme: "cleansing",
  format: "client-story",
  duration: 60,
  tone: "lively-humor",
  title: "«Я думала, это не для меня»",
  spokenLines: [
    { text: "Она пришла ко мне год назад.", startSec: 1.0, endSec: 3.5 },
    { text: "«Екатерина, я никогда не ходила к косметологу».", startSec: 4.0, endSec: 7.5 },
    { text: "«Думала, это для других».", startSec: 8.0, endSec: 10.5 },
    { text: "Мы начали с простой чистки.", startSec: 12.0, endSec: 14.5 },
    { text: "Без давления. Без «а ещё нужно вот это».", startSec: 15.0, endSec: 18.5 },
    { text: "Через месяц она прислала фото.", startSec: 20.0, endSec: 22.5 },
    { text: "«Муж спросил: ты что-то изменила?»", startSec: 23.0, endSec: 26.0 },
    { text: "Она ничего особенного не изменила.", startSec: 27.0, endSec: 30.0 },
    { text: "Просто выбрала себя.", startSec: 30.5, endSec: 33.0 },
    { text: "Один раз.", startSec: 33.5, endSec: 35.5 },
    { text: "И это стало привычкой.", startSec: 36.0, endSec: 38.5 },
  ],
  frames: [
    { clipIndex: 0, startSec: 0, endSec: 11 },
    { clipIndex: 1, startSec: 11, endSec: 25, caption: "Комбинированная чистка лица" },
    { clipIndex: 2, startSec: 25, endSec: 40, caption: "Результат через 4 недели" },
    { clipIndex: 3, startSec: 40, endSec: 57 },
  ],
  cta: "Приходите. Без стыда. Без оправданий.",
};

// 30 сек · Коллаген (живот) · до / процесс / после — из папки на Google Drive
// «Коллаген живот». Media задаётся через driveId — при рендере
// scripts/prepare-media.mjs скачивает файлы (gdown) и конвертирует HEIC-фото
// в JPEG, так что этот сценарий предназначен для запуска через
// workflow_dispatch с props_json, а не для прямого рендера дефолтных props.
export const collagenScript: ReelScript = {
  theme: "collagen",
  format: "process-captions",
  duration: 30,
  tone: "lively-humor",
  title: "Коллаген для живота — до, процесс, после",
  spokenLines: [
    { text: "Показываю, как это выглядит на самом деле.", startSec: 0.4, endSec: 2.4 },
    { text: "Процесс — от начала до конца.", startSec: 9.0, endSec: 11.0 },
    { text: "Результат — без фильтров и уловок.", startSec: 23.5, endSec: 25.5 },
  ],
  frames: [
    // ДО — 4 фото
    { clipIndex: 0, startSec: 0.0, endSec: 1.0, kind: "photo", driveId: "1nyW5CvyNNLfcHzIQ1DKfXunbWKUxPgMt", caption: "ДО" },
    { clipIndex: 1, startSec: 1.0, endSec: 2.0, kind: "photo", driveId: "13rwja4SJyHa6oKCgN3g4wPTW2YyYb4Ua" },
    { clipIndex: 2, startSec: 2.0, endSec: 3.0, kind: "photo", driveId: "1tueEn-8uBJSHxRuwvMANld8Z1RxAVBW1" },
    { clipIndex: 3, startSec: 3.0, endSec: 4.0, kind: "photo", driveId: "1zFk5Jx0-wp4ZVWnn3yXkmaOJ5wqck42o" },
    // ПРОЦЕСС — 10 коротких клипов (крупные непрерывные записи процедуры
    // намеренно пропущены — по несколько ГБ каждая, для 30-секундного
    // динамичного монтажа не нужны)
    { clipIndex: 4, startSec: 4.0, endSec: 5.6, kind: "video", driveId: "1E-xDxFpwHgbwZPQsh-vJw3koFIHirV79", caption: "ПРОЦЕСС" },
    { clipIndex: 5, startSec: 5.6, endSec: 7.2, kind: "video", driveId: "1PxpfSXMExQZ3YTeF8b7C4Ea9QM3HDWrw" },
    { clipIndex: 6, startSec: 7.2, endSec: 8.8, kind: "video", driveId: "1s1CTGUqgtOKNtPPki5T1Zay0o08B3CVT" },
    { clipIndex: 7, startSec: 8.8, endSec: 10.4, kind: "video", driveId: "1CpfEDPu0YDBfPUitxTwSru2l0HifHGVO" },
    { clipIndex: 8, startSec: 10.4, endSec: 12.0, kind: "video", driveId: "1vhvZS9o3Q8IVeQwgPqTIer72toeqSG8j" },
    { clipIndex: 9, startSec: 12.0, endSec: 13.6, kind: "video", driveId: "1wtugZSy2E-l4lNUL0i6BS1Jf7s-5cF_p" },
    { clipIndex: 10, startSec: 13.6, endSec: 15.2, kind: "video", driveId: "11Ik0H-wLFAQcfUpz55jujc2hgTzkqda7" },
    { clipIndex: 11, startSec: 15.2, endSec: 16.8, kind: "video", driveId: "11PcdQ6SsM4IgzqVXxyPZKitTlPZekij3" },
    { clipIndex: 12, startSec: 16.8, endSec: 18.4, kind: "video", driveId: "1f6fO5l3eHE0ZXQZzY6UBm3g9x2UTq40D" },
    { clipIndex: 13, startSec: 18.4, endSec: 20.0, kind: "video", driveId: "1RbCHMt9BQfumsXVtebGBduqrAy-c9huA" },
    // ПОСЛЕ — 7 фото
    { clipIndex: 14, startSec: 20.0, endSec: 21.0, kind: "photo", driveId: "1CcSdxYvflf2x9TKm1mpL-Qm7AHcqv4Xv", caption: "ПОСЛЕ" },
    { clipIndex: 15, startSec: 21.0, endSec: 22.0, kind: "photo", driveId: "1b11YcfKva2xcgKS2N-R7rREKbPOK4-jI" },
    { clipIndex: 16, startSec: 22.0, endSec: 23.0, kind: "photo", driveId: "1KU3osM2L5msY5SGlokIfr2sQ-HPMFKcR" },
    { clipIndex: 17, startSec: 23.0, endSec: 24.0, kind: "photo", driveId: "1o8DZ9t2pMtZiF_ZHsi7fz05EiV6MJKxI" },
    { clipIndex: 18, startSec: 24.0, endSec: 25.0, kind: "photo", driveId: "1uN-pAEU3fBkehIgrwxvFVbKvc0m_MVTs" },
    { clipIndex: 19, startSec: 25.0, endSec: 26.0, kind: "photo", driveId: "1C4v9RkqaLJ3-s1aFM6qEYKngv4Dth3TO" },
    { clipIndex: 20, startSec: 26.0, endSec: 27.0, kind: "photo", driveId: "1HSMJ-JzzdC-HeaF6b-fM_LqijVTyR8bi", caption: "РЕЗУЛЬТАТ" },
  ],
  cta: "Записаться — ссылка в шапке профиля",
};
