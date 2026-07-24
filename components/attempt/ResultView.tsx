"use client";

// Результат попытки: балл/статус, разбор по вопросам (по политике теста),
// диагностика по темам (SVG-бары), рекомендации.
import { useEffect, useState } from "react";
import Link from "next/link";
import katex from "katex";
import { t, pickPair, type Locale } from "@/lib/i18n";
import { Skeleton } from "@/components/ui";

interface PerQuestion {
  questionId: string;
  type: string;
  points: number;
  score: number;
  answered: boolean;
  manualPending: boolean;
  reviewComment: string;
  translations: { locale: string; prompt: string; explanation: string }[];
  correctChoiceIds?: string[];
  choices?: { id: string; textKk: string; textRu: string }[];
  response?: Record<string, unknown> | null;
}

interface ResultData {
  result: {
    id: string;
    status: string;
    pendingManual: boolean;
    scoresVisible: boolean;
    correctVisible?: boolean;
    testSlug: string;
    mode: string;
    translations: { locale: string; title: string }[];
    totalScore?: number | null;
    autoScore?: number;
    maxScore?: number;
    pct?: number;
    passed?: boolean | null;
    passPct?: number;
    perQuestion?: PerQuestion[];
    diagnostics?: {
      topics: { id: string; nameKk: string; nameRu: string; pct: number; score: number; max: number }[];
      strengths: { id: string; nameKk: string; nameRu: string; pct: number }[];
      weaknesses: { id: string; nameKk: string; nameRu: string; pct: number }[];
    } | null;
  };
}

function esc(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function mathHtml(s: string) {
  return esc(s)
    .replace(/\$\$([^$]+)\$\$/g, (_, tex) => katex.renderToString(tex, { displayMode: true, throwOnError: false }))
    .replace(/\$([^$\n]+)\$/g, (_, tex) => katex.renderToString(tex, { throwOnError: false }));
}

export function ResultView({ locale, attemptId }: { locale: Locale; attemptId: string }) {
  const [data, setData] = useState<ResultData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/attempts/${attemptId}/result`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setData(await r.json());
      })
      .catch(() => setError(true));
  }, [attemptId]);

  if (error)
    return (
      <div className="container-app py-20 text-center" role="alert">
        <p className="text-4xl">⚠️</p>
        <p className="mt-3 font-semibold">{t(locale, "common.error")}</p>
      </div>
    );
  if (!data)
    return (
      <div className="container-app max-w-3xl space-y-4 py-10" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  const r = data.result;
  const title = r.translations.find((x) => x.locale === locale)?.title ?? "";

  if (!r.scoresVisible) {
    return (
      <div className="container-app max-w-2xl py-14 text-center">
        <p aria-hidden className="text-5xl">⏳</p>
        <h1 className="mt-3 text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-slate-500">{t(locale, "test.pendingReview")}</p>
        <Link href={`/${locale}/dashboard`} className="btn-primary mt-6">
          {t(locale, "nav.dashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app max-w-3xl py-10">
      <h1 className="text-2xl font-extrabold">{title}</h1>

      {/* Итог */}
      <section className="card mt-5 p-6 text-center">
        {r.pendingManual && (
          <p className="chip mx-auto mb-3 bg-amber-100 text-amber-700">⏳ {t(locale, "test.pendingReview")}</p>
        )}
        <p aria-hidden className="text-6xl">{r.passed ? "🎉" : r.pendingManual ? "🕐" : "💪"}</p>
        <p className="mt-3 text-4xl font-black" style={{ color: "var(--primary)" }}>
          {r.pct}%
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {t(locale, "test.yourScore")}: {r.totalScore ?? r.autoScore} / {r.maxScore} · {t(locale, "test.passScore")}: {r.passPct}%
        </p>
        {r.passed != null && (
          <p className={`mt-3 text-lg font-extrabold ${r.passed ? "text-emerald-600" : "text-red-500"}`}>
            {r.passed ? t(locale, "test.passed") : t(locale, "test.failed")}
          </p>
        )}
      </section>

      {/* Диагностика по темам */}
      {r.diagnostics && r.diagnostics.topics.length > 0 && (
        <section className="card mt-5 p-6">
          <h2 className="font-bold">📊 {t(locale, "test.diag.byTopic")}</h2>
          <div className="mt-4 space-y-3">
            {r.diagnostics.topics.map((tp) => (
              <div key={tp.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-700">{pickPair(locale, tp.nameKk, tp.nameRu)}</span>
                  <span className="font-bold" style={{ color: "var(--primary)" }}>{tp.pct}%</span>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${pickPair(locale, tp.nameKk, tp.nameRu)}: ${tp.pct}%`}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${tp.pct}%`, background: tp.pct >= 70 ? "#10b981" : tp.pct >= 50 ? "var(--accent)" : "#ef4444" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-emerald-600">💪 {t(locale, "test.diag.strengths")}</h3>
              <ul className="mt-1 text-sm text-slate-600">
                {r.diagnostics.strengths.map((s) => (
                  <li key={s.id}>• {pickPair(locale, s.nameKk, s.nameRu)}</li>
                ))}
                {r.diagnostics.strengths.length === 0 && <li className="text-slate-400">—</li>}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-500">🎯 {t(locale, "test.diag.weaknesses")}</h3>
              <ul className="mt-1 text-sm text-slate-600">
                {r.diagnostics.weaknesses.map((s) => (
                  <li key={s.id}>• {pickPair(locale, s.nameKk, s.nameRu)}</li>
                ))}
                {r.diagnostics.weaknesses.length === 0 && <li className="text-slate-400">—</li>}
              </ul>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            {t(locale, "test.diag.recommended")}:{" "}
            <Link className="font-semibold hover:underline" style={{ color: "var(--primary)" }} href={`/${locale}/courses`}>
              {t(locale, "nav.courses")} →
            </Link>
          </p>
        </section>
      )}

      {/* Разбор по вопросам */}
      {r.perQuestion && (
        <section className="mt-5 space-y-3">
          {r.perQuestion.map((q, i) => {
            const tr = q.translations.find((x) => x.locale === locale) ?? q.translations[0];
            const full = q.score >= q.points;
            return (
              <details key={q.questionId} className="card p-4">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span
                    aria-hidden
                    className={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-black text-white ${
                      q.manualPending ? "bg-slate-400" : full ? "bg-emerald-500" : q.score > 0 ? "bg-amber-500" : "bg-red-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate font-semibold text-slate-800" dangerouslySetInnerHTML={{ __html: mathHtml(tr?.prompt ?? "") }} />
                  <span className="text-sm font-bold text-slate-500">
                    {q.manualPending ? "⏳" : `${q.score}/${q.points}`}
                  </span>
                </summary>
                <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
                  {r.correctVisible && q.correctChoiceIds && q.choices && (
                    <p className="text-slate-600">
                      <span className="font-semibold">{t(locale, "test.correctAnswer")}:</span>{" "}
                      {q.choices
                        .filter((c) => q.correctChoiceIds!.includes(c.id))
                        .map((c) => pickPair(locale, c.textKk, c.textRu))
                        .join(", ")}
                    </p>
                  )}
                  {tr?.explanation && (
                    <p className="mt-2 rounded-lg bg-slate-50 p-3 text-slate-700">
                      <span className="font-semibold">{t(locale, "test.explanation")}:</span> {tr.explanation}
                    </p>
                  )}
                  {q.reviewComment && (
                    <p className="mt-2 rounded-lg p-3" style={{ background: "var(--accent-soft)" }}>
                      <span className="font-semibold">{t(locale, "assignment.feedback")}:</span> {q.reviewComment}
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/${locale}/dashboard`} className="btn-primary">
          {t(locale, "nav.dashboard")}
        </Link>
        <Link href={`/${locale}/challenges`} className="btn-outline">
          {t(locale, "nav.challenges")}
        </Link>
      </div>
    </div>
  );
}
