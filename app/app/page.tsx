"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import { SCHOOLS, type ApiCourse } from "@/lib/types";
import { CourseCard, Spinner } from "@/components/ui";

const ACCENT_RING: Record<string, string> = {
  emerald: "from-emerald-500 to-teal-500",
  sky: "from-sky-500 to-blue-500",
  amber: "from-amber-500 to-orange-500",
};

export default function Home() {
  const { t, tr } = useI18n();
  const { me, loading } = useSession();
  const [courses, setCourses] = useState<ApiCourse[] | null>(null);

  useEffect(() => {
    api<{ courses: ApiCourse[] }>("/api/courses").then((d) => setCourses(d.courses)).catch(() => setCourses([]));
  }, []);

  if (loading || courses === null) return <Spinner />;

  // ————— Authed: dashboard —————
  if (me) {
    const myCourses = courses.filter(
      (c) => c.priceKzt === 0 || me.enrolledCourseIds.includes(c.id)
    );
    return (
      <div className="container-app py-10">
        <div className="card flex flex-col justify-between gap-4 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-extrabold">
              {t("welcome")}, {me.user.name.split(" ")[0]}! 👋
            </h1>
            <p className="mt-1 text-indigo-100">{t("heroSubtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 px-4 py-2 text-center">
              <div className="text-2xl font-extrabold">⚡ {me.user.xp}</div>
              <div className="text-[11px] font-medium text-indigo-100">{t("totalXp")}</div>
            </div>
            <Link
              href="/challenges"
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand transition hover:bg-indigo-50"
            >
              {t("continueLearning")} →
            </Link>
          </div>
        </div>

        <h2 className="mt-10 mb-4 text-xl font-bold text-slate-800">{t("myCourses")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myCourses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>

        <div className="mt-10 mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{t("catalog")}</h2>
          <Link href="/catalog" className="text-sm font-semibold text-brand hover:underline">
            {t("allSchools")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.slice(0, 3).map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </div>
    );
  }

  // ————— Guest: landing —————
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-50 to-transparent" />
        <div className="container-app relative py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="chip bg-indigo-100 text-brand">{t("tagline")}</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
              {t("heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn-brand !px-7 !py-3 text-base">
                {t("startFree")} →
              </Link>
              <Link href="/catalog" className="btn-outline !px-7 !py-3 text-base">
                {t("catalog")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-app py-8">
        <h2 className="mb-5 text-center text-xl font-bold text-slate-800">
          {t("chooseSchool")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {SCHOOLS.map((s) => {
            const count = courses.filter((c) => c.school === s.id).length;
            return (
              <Link
                key={s.id}
                href={`/catalog?school=${s.id}`}
                className="card group relative overflow-hidden p-6 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-20 ${ACCENT_RING[s.accent]}`}
                />
                <div className="text-2xl font-extrabold text-slate-800 group-hover:text-brand">
                  {tr(s.name)}
                </div>
                <p className="mt-1 text-sm text-slate-500">{tr(s.full)}</p>
                <p className="mt-4 text-xs font-semibold text-slate-400">
                  {count} {t("coursesCount")}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-app py-10">
        <h2 className="mb-6 text-center text-xl font-bold text-slate-800">
          {t("featuresTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: "🎯", t: t("f1t"), d: t("f1d") },
            { icon: "🏆", t: t("f2t"), d: t("f2d") },
            { icon: "🌐", t: t("f3t"), d: t("f3d") },
          ].map((f) => (
            <div key={f.t} className="card p-6">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 font-bold text-slate-800">{f.t}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-app py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{t("catalog")}</h2>
          <Link href="/catalog" className="text-sm font-semibold text-brand hover:underline">
            {t("allSchools")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.slice(0, 3).map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
