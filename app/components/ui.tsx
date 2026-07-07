"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { schoolById, type ApiCourse, type School } from "@/lib/types";

const ACCENT: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
};

export function SchoolBadge({ school }: { school: School }) {
  const { tr } = useI18n();
  return (
    <span className={`chip ${ACCENT[school.accent] ?? "bg-slate-100 text-slate-700"}`}>
      {tr(school.name)}
    </span>
  );
}

export function PriceTag({ course }: { course: ApiCourse }) {
  const { t } = useI18n();
  const { owns } = useSession();
  if (owns(course.id))
    return <span className="chip bg-emerald-100 text-emerald-700">✓ {t("owned")}</span>;
  if (course.priceKzt === 0)
    return <span className="chip bg-emerald-100 text-emerald-700">{t("free")}</span>;
  return (
    <span className="chip bg-slate-100 text-slate-700">
      {course.priceKzt.toLocaleString("ru-RU")} ₸
    </span>
  );
}

export function CourseCard({ course }: { course: ApiCourse }) {
  const { tr } = useI18n();
  const school = schoolById(course.school);
  return (
    <Link
      href={`/course/${course.id}`}
      className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <span className="text-4xl">{course.cover}</span>
        <SchoolBadge school={school} />
      </div>
      <h3 className="mt-3 font-bold leading-snug text-slate-800 group-hover:text-brand">
        {tr(course.title)}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{tr(course.description)}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-400">{tr(course.level)}</span>
        <PriceTag course={course} />
      </div>
    </Link>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-brand" />
    </div>
  );
}
