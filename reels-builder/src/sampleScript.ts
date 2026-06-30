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
