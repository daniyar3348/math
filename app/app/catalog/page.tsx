"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { SCHOOLS, type ApiCourse, type SchoolId } from "@/lib/types";
import { CourseCard, Spinner } from "@/components/ui";

function CatalogInner() {
  const { t, tr } = useI18n();
  const params = useSearchParams();
  const initial = params.get("school");
  const [filter, setFilter] = useState<SchoolId | "all">(
    initial === "bil" || initial === "nish" || initial === "ktl" ? initial : "all"
  );
  const [courses, setCourses] = useState<ApiCourse[] | null>(null);

  useEffect(() => {
    api<{ courses: ApiCourse[] }>("/api/courses")
      .then((d) => setCourses(d.courses))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    const s = params.get("school");
    if (s === "bil" || s === "nish" || s === "ktl") setFilter(s);
  }, [params]);

  if (courses === null) return <Spinner />;
  const list = filter === "all" ? courses : courses.filter((c) => c.school === filter);

  return (
    <div className="container-app py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">{t("catalog")}</h1>
      <p className="mt-2 text-slate-500">{t("tagline")}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? "btn-brand !py-2" : "btn-outline !py-2"}
        >
          {t("allSchools")}
        </button>
        {SCHOOLS.map((s) => (
          <button
            key={s.id}
            onClick={() => setFilter(s.id)}
            className={filter === s.id ? "btn-brand !py-2" : "btn-outline !py-2"}
          >
            {tr(s.name)}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CatalogInner />
    </Suspense>
  );
}
