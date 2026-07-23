"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Lang } from "./types";

interface LT { kk: string; ru: string }
const UI: Record<string, LT> = {
  tagline: {
    kk: "Қазақ сөздерін интервалды қайталаумен үйрен",
    ru: "Учи казахские слова методом интервального повторения",
  },
  decks: { kk: "Жиынтықтар", ru: "Наборы" },
  progress: { kk: "Прогресс", ru: "Прогресс" },
  study: { kk: "Оқу", ru: "Учить" },
  review: { kk: "Қайталау", ru: "Повторить" },
  start: { kk: "Бастау", ru: "Начать" },
  cont: { kk: "Жалғастыру", ru: "Продолжить" },
  due: { kk: "Қайталауға", ru: "К повторению" },
  fresh: { kk: "Жаңа", ru: "Новые" },
  learned: { kk: "Меңгерілген", ru: "Изучено" },
  words: { kk: "сөз", ru: "слов" },
  streak: { kk: "Қатарынан күн", ru: "Дней подряд" },
  reviewsToday: { kk: "Бүгін қайталанды", ru: "Повторено сегодня" },
  dueNow: { kk: "Қазір қолжетімді", ru: "Доступно сейчас" },
  totalWords: { kk: "Барлық сөз", ru: "Всего слов" },
  showAnswer: { kk: "Жауапты көрсету", ru: "Показать ответ" },
  again: { kk: "Қайтадан", ru: "Снова" },
  hard: { kk: "Қиын", ru: "Трудно" },
  good: { kk: "Жақсы", ru: "Хорошо" },
  easy: { kk: "Оңай", ru: "Легко" },
  sessionDone: { kk: "Сессия аяқталды!", ru: "Сессия завершена!" },
  reviewedN: { kk: "сөз қайталадыңыз", ru: "слов повторено" },
  backToDecks: { kk: "Жиынтықтарға", ru: "К наборам" },
  nothingDue: { kk: "Қайталайтын сөз жоқ 🎉", ru: "Нет слов для повторения 🎉" },
  allCaughtUp: {
    kk: "Бәрін қайталап болдың — кейінірек оралт.",
    ru: "Всё повторено — загляни позже.",
  },
  heroTitle: { kk: "Қазақ тілін сөзбе-сөз меңгер", ru: "Осваивай казахский слово за словом" },
  heroSub: {
    kk: "Ғылыми интервалды қайталау әдісі есте сақтауға көмектеседі. Тіркелудің қажеті жоқ.",
    ru: "Научный метод интервального повторения помогает запоминать надолго. Без регистрации.",
  },
  chooseDeck: { kk: "Жиынтық таңда", ru: "Выбери набор" },
  keepGoing: { kk: "Жалғастыр!", ru: "Так держать!" },
  yourProgress: { kk: "Сенің прогресің", ru: "Твой прогресс" },
  card: { kk: "карта", ru: "карт." },
  flipHint: { kk: "Есіңе түсір де, жауапты аш", ru: "Вспомни, затем открой ответ" },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
  tr: (o: { kk: string; ru: string } | null | undefined) => string;
}
const C = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("kk");
  useEffect(() => {
    const s = localStorage.getItem("lang") as Lang | null;
    if (s === "kk" || s === "ru") setLangState(s);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };
  const t = (k: string) => UI[k]?.[lang] ?? k;
  const tr = (o: { kk: string; ru: string } | null | undefined) => (o ? o[lang] : "");
  return <C.Provider value={{ lang, setLang, t, tr }}>{children}</C.Provider>;
}

export function useI18n() {
  const c = useContext(C);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
