"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export function CourseEnrollButton(p: {
  locale: Locale;
  slug: string;
  courseId: string;
  authed: boolean;
  accessType: "FREE" | "PAID";
  paid: boolean;
  selfEnroll: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!p.authed) {
    return (
      <a href={`/${p.locale}/login`} className="btn-primary w-full !py-3">
        {t(p.locale, "nav.login")}
      </a>
    );
  }
  if (!p.selfEnroll) return <p className="text-center text-sm text-slate-500">—</p>;

  const act = async () => {
    setBusy(true);
    setError("");
    try {
      if (p.accessType === "PAID" && !p.paid) {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refType: "COURSE", refId: p.courseId }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error);
        router.push(`/${p.locale}/pay/${j.paymentId}`);
        return;
      }
      const res = await fetch(`/api/courses/${p.slug}/enroll`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(t(p.locale, "common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button onClick={act} disabled={busy} className="btn-primary w-full !py-3">
        {p.accessType === "PAID" && !p.paid ? t(p.locale, "pay.buy") : t(p.locale, "course.enroll")}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function LessonCompleteButton(p: { locale: Locale; lessonId: string; done: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (p.done) {
    return <span className="chip bg-emerald-100 text-emerald-700">✓ {t(p.locale, "lesson.done")}</span>;
  }
  const complete = async () => {
    setBusy(true);
    const res = await fetch(`/api/lessons/${p.lessonId}/complete`, { method: "POST" });
    setBusy(false);
    if (res.ok) router.refresh();
  };
  return (
    <button onClick={complete} disabled={busy} className="btn-primary">
      {t(p.locale, "lesson.markDone")}
    </button>
  );
}
