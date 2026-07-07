"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import {
  schoolById,
  type ApiCourse,
  type ApiLesson,
  type ApiChallengeMeta,
} from "@/lib/types";
import { SchoolBadge, PriceTag, Spinner } from "@/components/ui";

interface CourseData {
  course: ApiCourse;
  lessons: ApiLesson[];
  challenges: ApiChallengeMeta[];
  unlocked: boolean;
}

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { t, tr } = useI18n();
  const { me } = useSession();
  const [data, setData] = useState<CourseData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api<CourseData>(`/api/courses/${id}`)
      .then(setData)
      .catch(() => setErr(true));
    // refetch when session changes (purchase unlocks content)
  }, [id, me?.enrolledCourseIds.length]);

  if (err)
    return <div className="container-app py-20 text-center text-slate-500">404 — {id}</div>;
  if (!data) return <Spinner />;

  const { course, lessons, challenges, unlocked } = data;
  const school = schoolById(course.school);

  return (
    <div className="container-app py-10">
      <Link href="/catalog" className="text-sm font-semibold text-slate-400 hover:text-brand">
        ← {t("catalog")}
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="text-5xl">{course.cover}</span>
            <div>
              <SchoolBadge school={school} />
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {tr(course.title)}
              </h1>
            </div>
          </div>
          <p className="mt-4 text-slate-600">{tr(course.description)}</p>

          <h2 className="mt-8 text-lg font-bold text-slate-800">{t("lessons")}</h2>
          <div className="mt-3 space-y-3">
            {lessons.map((l, i) => (
              <div key={l.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-indigo-100 text-sm font-bold text-brand">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800">{tr(l.title)}</h3>
                    {l.body ? (
                      <p className="mt-1 text-sm text-slate-500">{tr(l.body)}</p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-400">🔒 {t("buyToUnlock")}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-lg font-bold text-slate-800">{t("challenges")}</h2>
          <div className="mt-3 space-y-3">
            {challenges.map((ch) => {
              const best = me?.bestScores[ch.id];
              return (
                <div key={ch.id} className="card flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800">{tr(ch.title)}</h3>
                    <p className="text-sm text-slate-500">{tr(ch.description)}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="chip bg-amber-100 text-amber-700">⚡ {ch.xp} XP</span>
                      <span className="chip bg-slate-100 text-slate-600">
                        ⏱ {Math.round(ch.timeLimitSec / 60)} {t("minutes")}
                      </span>
                      <span className="chip bg-slate-100 text-slate-600">
                        {ch.questionCount} {t("questionsCount")}
                      </span>
                      {best != null && (
                        <span className="chip bg-emerald-100 text-emerald-700">✓ {best}%</span>
                      )}
                    </div>
                  </div>
                  {!ch.locked ? (
                    <Link href={`/challenge/${ch.id}`} className="btn-brand flex-none !py-2">
                      {t("open")}
                    </Link>
                  ) : (
                    <span className="chip flex-none bg-slate-100 text-slate-400">🔒</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="lg:col-span-1">
          <div className="card sticky top-24 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">{t("level")}</span>
              <span className="text-sm font-semibold text-slate-700">{tr(course.level)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">{t("price")}</span>
              <PriceTag course={course} />
            </div>
            <div className="mt-5">
              {unlocked ? (
                <Link
                  href={challenges[0] ? `/challenge/${challenges[0].id}` : "#"}
                  className="btn-brand w-full !py-3"
                >
                  {t("startChallenge")} →
                </Link>
              ) : (
                <Link href={`/checkout/${course.id}`} className="btn-brand w-full !py-3">
                  {t("buy")} · {course.priceKzt.toLocaleString("ru-RU")} ₸
                </Link>
              )}
            </div>
            {!unlocked && (
              <p className="mt-3 text-center text-xs text-slate-400">{t("buyToUnlock")}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
