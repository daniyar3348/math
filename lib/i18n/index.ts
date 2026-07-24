// i18n ядро: локали, словари, форматирование дат/чисел/валюты (Asia/Almaty, ₸).
import { dictionaries, type DictKey } from "./dictionaries";

export const LOCALES = ["kk", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "kk";

export function isLocale(x: string | undefined | null): x is Locale {
  return x === "kk" || x === "ru";
}

export function t(locale: Locale, key: DictKey, params?: Record<string, string | number>): string {
  let s: string = dictionaries[locale][key] ?? dictionaries.ru[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/** Выбор локализованного поля из пары/переводов. */
export function pick<T extends { locale: string }>(rows: T[], locale: Locale): T | undefined {
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === (locale === "kk" ? "ru" : "kk"));
}

export function pickPair(locale: Locale, kk: string, ru: string): string {
  return locale === "kk" ? kk || ru : ru || kk;
}

const TZ = "Asia/Almaty";

export function fmtDate(locale: Locale, d: Date | string | null | undefined, withTime = false): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-RU", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function fmtNumber(locale: Locale, n: number): string {
  return new Intl.NumberFormat(locale === "kk" ? "kk-KZ" : "ru-RU").format(n);
}

export function fmtTenge(locale: Locale, n: number): string {
  return `${fmtNumber(locale, n)} ₸`;
}

export function otherLocale(l: Locale): Locale {
  return l === "kk" ? "ru" : "kk";
}
