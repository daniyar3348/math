// Карточки каталогов (server-совместимые, чистые).
import Link from "next/link";
import { t, fmtDate, fmtTenge, pickPair, type Locale } from "@/lib/i18n";

export interface CourseCardData {
  slug: string;
  title: string;
  description: string;
  subject: string;
  grade: string | null;
  accessType: "FREE" | "PAID";
  priceKzt: number | null;
  students: number;
  teachers: string[];
}

export function CourseCard({ locale, c }: { locale: Locale; c: CourseCardData }) {
  return (
    <Link
      href={`/${locale}/courses/${c.slug}`}
      className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          {c.subject}
        </span>
        {c.accessType === "FREE" ? (
          <span className="chip bg-emerald-100 text-emerald-700">{t(locale, "common.free")}</span>
        ) : (
          <span className="chip" style={{ background: "var(--accent-soft)", color: "#92400e" }}>
            {fmtTenge(locale, c.priceKzt ?? 0)}
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900 group-hover:underline">{c.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.description}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>{c.grade ?? ""}</span>
        <span>{c.teachers[0] ?? ""}</span>
      </div>
    </Link>
  );
}

export interface ChallengeCardData {
  slug: string;
  title: string;
  description: string;
  subject: string | null;
  grade: string | null;
  accessType: "FREE" | "PAID";
  priceKzt: number | null;
  startAt: Date | string;
  endAt: Date | string;
  participants: number;
  state: "planned" | "active" | "finished";
}

export function ChallengeCard({ locale, c }: { locale: Locale; c: ChallengeCardData }) {
  const stateChip = {
    planned: { text: t(locale, "challenge.status.planned"), cls: "bg-sky-100 text-sky-700" },
    active: { text: t(locale, "challenge.status.active"), cls: "bg-emerald-100 text-emerald-700" },
    finished: { text: t(locale, "challenge.status.finished"), cls: "bg-slate-200 text-slate-600" },
  }[c.state];

  return (
    <Link
      href={`/${locale}/challenges/${c.slug}`}
      className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`chip ${stateChip.cls}`}>{stateChip.text}</span>
        {c.accessType === "FREE" ? (
          <span className="chip bg-emerald-100 text-emerald-700">{t(locale, "common.free")}</span>
        ) : (
          <span className="chip" style={{ background: "var(--accent-soft)", color: "#92400e" }}>
            {fmtTenge(locale, c.priceKzt ?? 0)}
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900 group-hover:underline">{c.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.description}</p>
      <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <p>
          {t(locale, "challenge.dates")}: {fmtDate(locale, c.startAt)} — {fmtDate(locale, c.endAt)}
        </p>
        <div className="flex justify-between">
          <span>
            {t(locale, "challenge.participants")}: {c.participants}
          </span>
          <span className="inline-flex gap-1">{[c.subject, c.grade].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
    </Link>
  );
}

/** Хелпер выбора перевода из массива prisma-переводов. */
export function tr<T extends { locale: string }>(rows: T[], locale: Locale): T | undefined {
  return rows.find((r) => r.locale === locale) ?? rows[0];
}

export function pair(locale: Locale, kk: string, ru: string) {
  return pickPair(locale, kk, ru);
}
