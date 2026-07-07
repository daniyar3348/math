"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Lang, LocalizedText } from "./types";

type Dict = Record<string, LocalizedText>;

// UI strings (kk = default). Add keys here as needed.
export const UI: Dict = {
  tagline: {
    kk: "БИЛ, НЗМ және ҚТЛ-ге математикадан дайындық",
    ru: "Подготовка по математике в БИЛ, НИШ и КТЛ",
  },
  heroTitle: {
    kk: "Таңдаулы мектептерге математикадан дайындал",
    ru: "Готовься по математике в лучшие школы",
  },
  heroSubtitle: {
    kk: "Челлендждер, XP және рейтинг арқылы БИЛ, НЗМ, ҚТЛ емтихандарын ойнап меңгер.",
    ru: "Осваивай экзамены БИЛ, НИШ, КТЛ играя — через челленджи, XP и рейтинг.",
  },
  start: { kk: "Бастау", ru: "Начать" },
  startFree: { kk: "Тегін бастау", ru: "Начать бесплатно" },
  catalog: { kk: "Курстар", ru: "Курсы" },
  challenges: { kk: "Челленджер", ru: "Челленджи" },
  leaderboard: { kk: "Рейтинг", ru: "Рейтинг" },
  profile: { kk: "Профиль", ru: "Профиль" },
  login: { kk: "Кіру", ru: "Войти" },
  logout: { kk: "Шығу", ru: "Выйти" },
  register: { kk: "Тіркелу", ru: "Регистрация" },
  allSchools: { kk: "Барлық мектептер", ru: "Все школы" },
  free: { kk: "Тегін", ru: "Бесплатно" },
  buy: { kk: "Сатып алу", ru: "Купить" },
  owned: { kk: "Ашық", ru: "Доступен" },
  open: { kk: "Ашу", ru: "Открыть" },
  lessons: { kk: "Сабақтар", ru: "Уроки" },
  startChallenge: { kk: "Челлендж бастау", ru: "Начать челлендж" },
  level: { kk: "Деңгей", ru: "Уровень" },
  xp: { kk: "XP", ru: "XP" },
  minutes: { kk: "мин", ru: "мин" },
  question: { kk: "Сұрақ", ru: "Вопрос" },
  next: { kk: "Келесі", ru: "Далее" },
  finish: { kk: "Аяқтау", ru: "Завершить" },
  correct: { kk: "Дұрыс!", ru: "Верно!" },
  wrong: { kk: "Қате", ru: "Неверно" },
  yourResult: { kk: "Нәтижең", ru: "Твой результат" },
  earnedXp: { kk: "Жиналған XP", ru: "Заработано XP" },
  backToCourse: { kk: "Курсқа оралу", ru: "Вернуться к курсу" },
  retry: { kk: "Қайталау", ru: "Пройти снова" },
  rank: { kk: "Орын", ru: "Место" },
  student: { kk: "Оқушы", ru: "Ученик" },
  totalXp: { kk: "Жалпы XP", ru: "Всего XP" },
  region: { kk: "Аймақ", ru: "Регион" },
  allRegions: { kk: "Барлық аймақтар", ru: "Все регионы" },
  yourName: { kk: "Атың", ru: "Имя" },
  loginTitle: { kk: "Кіру", ru: "Вход" },
  registerTitle: { kk: "Тіркелу", ru: "Регистрация" },
  email: { kk: "Email", ru: "Email" },
  password: { kk: "Құпиясөз", ru: "Пароль" },
  grade: { kk: "Сынып", ru: "Класс" },
  enter: { kk: "Кіру", ru: "Войти" },
  createAccount: { kk: "Аккаунт құру", ru: "Создать аккаунт" },
  noAccount: { kk: "Аккаунт жоқ па?", ru: "Нет аккаунта?" },
  haveAccount: { kk: "Аккаунт бар ма?", ru: "Уже есть аккаунт?" },
  medals: { kk: "Медальдар", ru: "Медали" },
  completed: { kk: "Аяқталған челленджер", ru: "Пройдено челленджей" },
  noPurchases: { kk: "Сатып алынған курстар жоқ", ru: "Нет купленных курсов" },
  myCourses: { kk: "Менің курстарым", ru: "Мои курсы" },
  myAttempts: { kk: "Соңғы әрекеттер", ru: "Последние попытки" },
  date: { kk: "Күні", ru: "Дата" },
  score: { kk: "Ұпай", ru: "Результат" },
  checkout: { kk: "Төлем", ru: "Оплата" },
  payWithKaspi: { kk: "Kaspi арқылы төлеу", ru: "Оплатить через Kaspi" },
  paySandboxNote: {
    kk: "Демо-режим: нақты ақша алынбайды.",
    ru: "Демо-режим: реальные деньги не списываются.",
  },
  processing: { kk: "Өңделуде…", ru: "Обработка…" },
  paySuccess: { kk: "Төлем сәтті өтті!", ru: "Оплата прошла успешно!" },
  goToCourse: { kk: "Курсқа өту", ru: "Перейти к курсу" },
  needLogin: { kk: "Алдымен кіру қажет", ru: "Сначала войдите" },
  price: { kk: "Бағасы", ru: "Цена" },
  courseLocked: { kk: "Курс жабық", ru: "Курс закрыт" },
  buyToUnlock: {
    kk: "Челленджді ашу үшін курсты сатып алыңыз.",
    ru: "Купите курс, чтобы открыть челлендж.",
  },
  timeLeft: { kk: "Қалған уақыт", ru: "Осталось" },
  featuresTitle: { kk: "Неге біз?", ru: "Почему мы?" },
  f1t: { kk: "Мектеп форматы", ru: "Формат школ" },
  f1d: {
    kk: "Есептер БИЛ, НЗМ, ҚТЛ емтихандарының форматына бейімделген.",
    ru: "Задачи адаптированы под формат экзаменов БИЛ, НИШ, КТЛ.",
  },
  f2t: { kk: "Геймификация", ru: "Геймификация" },
  f2d: {
    kk: "XP жинап, медаль ал, рейтингте көтеріл.",
    ru: "Зарабатывай XP, получай медали, поднимайся в рейтинге.",
  },
  f3t: { kk: "Екі тілде", ru: "На двух языках" },
  f3d: {
    kk: "Барлық материал қазақ және орыс тілінде.",
    ru: "Все материалы на казахском и русском языке.",
  },
  chooseSchool: { kk: "Мектебіңді таңда", ru: "Выбери свою школу" },
  coursesCount: { kk: "курс", ru: "курс(ов)" },
  footer: {
    kk: "БИЛ, НЗМ, ҚТЛ-ге математикадан дайындық платформасы",
    ru: "Платформа подготовки по математике в БИЛ, НИШ, КТЛ",
  },
  welcome: { kk: "Қош келдің", ru: "С возвращением" },
  continueLearning: { kk: "Оқуды жалғастыр", ru: "Продолжить обучение" },
  adminPanel: { kk: "Админ", ru: "Админ" },
  loading: { kk: "Жүктелуде…", ru: "Загрузка…" },
  errFillAll: { kk: "Барлық өрісті толтырыңыз", ru: "Заполните все поля" },
  errEmailTaken: { kk: "Бұл email тіркелген", ru: "Этот email уже зарегистрирован" },
  errInvalidCreds: { kk: "Email немесе құпиясөз қате", ru: "Неверный email или пароль" },
  errShortPassword: {
    kk: "Құпиясөз кемінде 6 таңба",
    ru: "Пароль — не менее 6 символов",
  },
  errBadEmail: { kk: "Email дұрыс емес", ru: "Некорректный email" },
  errGeneric: { kk: "Қате шықты, қайталап көріңіз", ru: "Ошибка, попробуйте ещё раз" },
  errRateLimited: {
    kk: "Тым көп әрекет — бір минуттан кейін қайталаңыз",
    ru: "Слишком много попыток — повторите через минуту",
  },
  errTooLong: { kk: "Мәтін тым ұзын", ru: "Слишком длинный текст" },
  errRegistrationFailed: {
    kk: "Тіркелу мүмкін болмады. Аккаунтыңыз бар болса — кіріңіз.",
    ru: "Не удалось зарегистрироваться. Если у вас есть аккаунт — войдите.",
  },
  errBadTotp: { kk: "Код қате", ru: "Неверный код" },
  errTimeOver: { kk: "Уақыт бітті", ru: "Время вышло" },
  totpPrompt: {
    kk: "Аутентификатордан 6 таңбалы код",
    ru: "6-значный код из приложения-аутентификатора",
  },
  changePassword: { kk: "Құпиясөзді өзгерту", ru: "Сменить пароль" },
  currentPassword: { kk: "Қазіргі құпиясөз", ru: "Текущий пароль" },
  newPassword: { kk: "Жаңа құпиясөз", ru: "Новый пароль" },
  saved: { kk: "Сақталды ✓", ru: "Сохранено ✓" },
  security: { kk: "Қауіпсіздік", ru: "Безопасность" },
  questionsCount: { kk: "сұрақ", ru: "вопрос(ов)" },
};

const ERR_MAP: Record<string, string> = {
  fill_all: "errFillAll",
  email_taken: "errEmailTaken",
  invalid_credentials: "errInvalidCreds",
  short_password: "errShortPassword",
  bad_email: "errBadEmail",
  rate_limited: "errRateLimited",
  too_long: "errTooLong",
  registration_failed: "errRegistrationFailed",
  bad_totp: "errBadTotp",
  time_over: "errTimeOver",
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof UI | string) => string;
  tr: (lt: LocalizedText | null | undefined) => string;
  terr: (code: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("kk");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "kk" || saved === "ru") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  const tr = (lt: LocalizedText | null | undefined) => (lt ? lt[lang] : "");
  const t = (key: string) => {
    const entry = UI[key];
    return entry ? entry[lang] : key;
  };
  const terr = (code: string) => t(ERR_MAP[code] ?? "errGeneric");

  return (
    <Ctx.Provider value={{ lang, setLang, t, tr, terr }}>{children}</Ctx.Provider>
  );
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}
