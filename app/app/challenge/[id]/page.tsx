"use client";

// Challenge runner на серверных попытках:
// /start открывает попытку → каждый ответ фиксируется сервером (первый —
// зачётный, время контролирует сервер) → /submit считает счёт ТОЛЬКО из
// записанных сервером ответов.

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { api, post, ApiError } from "@/lib/api";
import type {
  ApiChallengeMeta,
  ApiQuestion,
  AnswerResult,
  SubmitResult,
} from "@/lib/types";
import { Spinner } from "@/components/ui";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ChallengeData {
  challenge: ApiChallengeMeta & { coursePriceKzt?: number };
  questions: ApiQuestion[] | null;
}

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { t, tr } = useI18n();
  const { me, loading: sessionLoading, refresh } = useSession();

  const [data, setData] = useState<ChallengeData | null>(null);
  const [err, setErr] = useState(false);
  const attemptRef = useRef<string | null>(null);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [guestDone, setGuestDone] = useState(false);
  const localCorrectRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => {
    setData(null);
    attemptRef.current = null;
    api<ChallengeData>(`/api/challenges/${id}`)
      .then(async (d) => {
        if (d.questions) {
          const s = await post<{ attemptId: string; timeLimitSec: number }>(
            `/api/challenges/${id}/start`
          );
          attemptRef.current = s.attemptId;
          setTimeLeft(s.timeLimitSec);
        }
        setData(d);
      })
      .catch(() => setErr(true));
  }, [id]);

  useEffect(load, [load]);

  const finish = useCallback(async () => {
    if (result || guestDone) return;
    if (!me) {
      // Гость: серверная сдача требует входа — показываем локальный итог.
      setGuestDone(true);
      return;
    }
    try {
      const r = await post<SubmitResult>(`/api/challenges/${id}/submit`, {
        attemptId: attemptRef.current,
      });
      setResult(r);
      refresh(); // XP в шапке — из БД
    } catch {
      setErr(true);
    }
  }, [id, result, guestDone, me, refresh]);

  // Таймер (клиентский — для UX; сервер проверяет время сам)
  useEffect(() => {
    if (result || guestDone || !data?.questions) return;
    if (timeLeft <= 0) {
      finish();
      return;
    }
    const tid = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(tid);
  }, [timeLeft, result, guestDone, data, finish]);

  if (err) return <div className="container-app py-20 text-center text-slate-500">404</div>;
  if (!data || sessionLoading) return <Spinner />;

  const { challenge, questions } = data;

  if (!questions) {
    return (
      <div className="container-app py-20 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-4 text-xl font-bold text-slate-800">{t("courseLocked")}</h1>
        <p className="mt-2 text-slate-500">{t("buyToUnlock")}</p>
        <Link href={`/checkout/${challenge.courseId}`} className="btn-brand mt-6 !py-3">
          {t("buy")}
          {challenge.coursePriceKzt
            ? ` · ${challenge.coursePriceKzt.toLocaleString("ru-RU")} ₸`
            : ""}
        </Link>
      </div>
    );
  }

  const total = questions.length;

  // Экран результата (после серверной сдачи ИЛИ локальный для гостя)
  if (result || guestDone) {
    const scorePct = result
      ? result.scorePct
      : Math.round((localCorrectRef.current / total) * 100);
    const correctCount = result ? result.correctCount : localCorrectRef.current;
    const pass = scorePct >= 60;
    return (
      <div className="container-app py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <div className="text-6xl">{pass ? "🎉" : "💪"}</div>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{t("yourResult")}</h1>
          <div className="mt-6 flex items-center justify-center gap-8">
            <div>
              <div className="text-4xl font-extrabold text-brand">{scorePct}%</div>
              <div className="text-xs font-medium text-slate-400">
                {correctCount}/{total}
              </div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-amber-500">
                +{result ? result.gainedXp : 0}
              </div>
              <div className="text-xs font-medium text-slate-400">{t("earnedXp")}</div>
            </div>
          </div>
          {guestDone && (
            <p className="mt-4 text-sm text-slate-500">
              {t("needLogin")} —{" "}
              <Link href="/register" className="font-semibold text-brand hover:underline">
                {t("register")}
              </Link>
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => {
                localCorrectRef.current = 0;
                setIdx(0);
                setPicked(null);
                setFeedback(null);
                setResult(null);
                setGuestDone(false);
                load();
              }}
              className="btn-outline !py-3"
            >
              ↻ {t("retry")}
            </button>
            <Link href={`/course/${challenge.courseId}`} className="btn-brand !py-3">
              {t("backToCourse")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const answered = feedback !== null;
  const isLast = idx === total - 1;

  const pick = async (optId: string) => {
    if (answered || checking || !attemptRef.current) return;
    setChecking(true);
    setPicked(optId);
    try {
      const fb = await post<AnswerResult>(`/api/challenges/${id}/answer`, {
        attemptId: attemptRef.current,
        questionId: q.id,
        optionId: optId,
      });
      if (fb.correct) localCorrectRef.current += 1;
      setFeedback(fb);
    } catch (e) {
      setPicked(null);
      if (e instanceof ApiError && e.message === "time_over") finish();
    } finally {
      setChecking(false);
    }
  };

  const goNext = () => {
    if (isLast) {
      finish();
    } else {
      setIdx((i) => i + 1);
      setPicked(null);
      setFeedback(null);
    }
  };

  return (
    <div className="container-app max-w-2xl py-10">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500">
          {t("question")} {idx + 1}/{total}
        </span>
        <span
          className={`chip ${
            timeLeft <= 30 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
          }`}
        >
          ⏱ {fmt(timeLeft)}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${((idx + (answered ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      <div className="card mt-6 p-6">
        <h2 className="text-lg font-bold text-slate-900">{tr(q.prompt)}</h2>
        <div className="mt-5 space-y-3">
          {q.options.map((o) => {
            const isCorrect = feedback?.correctOptionId === o.id;
            const isPicked = o.id === picked;
            let cls = "border-slate-200 hover:border-brand";
            if (answered) {
              if (isCorrect) cls = "border-emerald-400 bg-emerald-50";
              else if (isPicked) cls = "border-red-400 bg-red-50";
              else cls = "border-slate-200 opacity-60";
            } else if (isPicked && checking) {
              cls = "border-indigo-300 bg-indigo-50";
            }
            return (
              <button
                key={o.id}
                onClick={() => pick(o.id)}
                disabled={answered || checking}
                className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-slate-700 transition ${cls}`}
              >
                <span>{tr(o.text)}</span>
                {answered && isCorrect && <span className="text-emerald-600">✓</span>}
                {answered && isPicked && !isCorrect && (
                  <span className="text-red-500">✕</span>
                )}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            className={`mt-5 rounded-xl p-4 text-sm ${
              feedback.correct
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            <div className="font-bold">{feedback.correct ? t("correct") : t("wrong")}</div>
            <p className="mt-1">{tr(feedback.explanation)}</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {!me && (
          <p className="text-xs text-slate-400">
            {t("needLogin")} —{" "}
            <Link href="/login" className="font-semibold text-brand hover:underline">
              {t("login")}
            </Link>
          </p>
        )}
        <button onClick={goNext} disabled={!answered} className="btn-brand ml-auto !py-3">
          {isLast ? t("finish") : t("next")} →
        </button>
      </div>
    </div>
  );
}
