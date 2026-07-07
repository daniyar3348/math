"use client";

// Checkout: creates a pending payment in the DB, then confirms it
// (sandbox stand-in for the Kaspi Pay redirect + webhook) — the enrollment
// is granted server-side on confirmation.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { api, post } from "@/lib/api";
import { schoolById, type ApiCourse } from "@/lib/types";
import { SchoolBadge, Spinner } from "@/components/ui";

type Phase = "idle" | "processing" | "done";

export default function CheckoutPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { t, tr } = useI18n();
  const { me, loading, refresh, owns } = useSession();
  const [phase, setPhase] = useState<Phase>("idle");
  const [course, setCourse] = useState<ApiCourse | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api<{ course: ApiCourse }>(`/api/courses/${courseId}`)
      .then((d) => setCourse(d.course))
      .catch(() => setErr(true));
  }, [courseId]);

  if (err) return <div className="container-app py-20 text-center">404</div>;
  if (loading || !course) return <Spinner />;

  if (!me) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-slate-500">{t("needLogin")}</p>
        <Link href="/login" className="btn-brand mt-4 !py-3">
          {t("login")}
        </Link>
      </div>
    );
  }

  const school = schoolById(course.school);
  const alreadyOwned = owns(course.id);

  const pay = async () => {
    setPhase("processing");
    try {
      const created = await post<{ paymentId?: string; alreadyOwned?: boolean }>(
        "/api/checkout",
        { courseId: course.id }
      );
      if (created.alreadyOwned) {
        setPhase("done");
        return;
      }
      // Simulated Kaspi redirect delay; in production the user pays in the
      // Kaspi app and their webhook confirms the payment.
      await new Promise((r) => setTimeout(r, 1500));
      await post("/api/checkout/confirm", { paymentId: created.paymentId });
      await refresh();
      setPhase("done");
    } catch {
      setPhase("idle");
    }
  };

  if (phase === "done" || alreadyOwned) {
    return (
      <div className="container-app max-w-md py-16 text-center">
        <div className="card p-8">
          <div className="text-6xl">✅</div>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{t("paySuccess")}</h1>
          <p className="mt-2 text-slate-500">{tr(course.title)}</p>
          <Link href={`/course/${course.id}`} className="btn-brand mt-6 w-full !py-3">
            {t("goToCourse")} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app max-w-md py-12">
      <h1 className="text-2xl font-extrabold text-slate-900">{t("checkout")}</h1>

      <div className="card mt-6 p-6">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{course.cover}</span>
          <div>
            <SchoolBadge school={school} />
            <h2 className="mt-1 font-bold text-slate-800">{tr(course.title)}</h2>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="font-semibold text-slate-500">{t("price")}</span>
          <span className="text-2xl font-extrabold text-slate-900">
            {course.priceKzt.toLocaleString("ru-RU")} ₸
          </span>
        </div>

        <button
          onClick={pay}
          disabled={phase === "processing"}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff3d3d] px-5 py-3.5 text-base font-bold text-white transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
        >
          {phase === "processing" ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {t("processing")}
            </>
          ) : (
            <>💳 {t("payWithKaspi")}</>
          )}
        </button>
        <p className="mt-3 text-center text-xs text-slate-400">{t("paySandboxNote")}</p>
      </div>
    </div>
  );
}
