// Задание: описание, сдача (текст/файл), статусы, оценка и комментарий.
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { isLocale, t, fmtDate, pickPair, type Locale } from "@/lib/i18n";
import { SubmitAssignmentForm } from "@/components/site/SubmitAssignment";

export default async function AssignmentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const auth = await getAuth();
  if (!auth) redirect(`/${locale}/login`);

  const asg = await prisma.assignment.findFirst({
    where: { id, deletedAt: null, status: "PUBLISHED" },
    include: { course: true },
  });
  if (!asg) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: auth.userId, courseId: asg.courseId } },
  });
  if (!enrollment) redirect(`/${locale}/courses/${asg.course.slug}`);

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId: asg.id, studentId: auth.userId },
    orderBy: { attemptNo: "desc" },
  });
  const latest = submissions[0];
  const canSubmit = !latest || (asg.allowResubmit && latest.status !== "SUBMITTED");

  return (
    <div className="container-app max-w-3xl py-10">
      <Link href={`/${locale}/courses/${asg.course.slug}`} className="text-sm font-semibold text-slate-400 hover:underline">
        ← {t(locale, "common.back")}
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold">📝 {pickPair(locale, asg.titleKk, asg.titleRu)}</h1>
      {asg.dueAt && (
        <p className="mt-2 text-sm font-semibold text-slate-500">
          {t(locale, "assignment.due")}: {fmtDate(locale, asg.dueAt, true)} · {t(locale, "assignment.score")}: {asg.maxScore}
        </p>
      )}
      <p className="mt-4 whitespace-pre-line text-slate-700">{pickPair(locale, asg.descriptionKk, asg.descriptionRu)}</p>

      {submissions.length > 0 && (
        <section className="mt-6 space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-600">
                  #{s.attemptNo} · {fmtDate(locale, s.submittedAt, true)}
                </span>
                {s.status === "GRADED" ? (
                  <span className="chip bg-emerald-100 text-emerald-700">
                    {t(locale, "assignment.graded")}: {s.score}/{asg.maxScore}
                  </span>
                ) : s.status === "RETURNED" ? (
                  <span className="chip bg-amber-100 text-amber-700">↩</span>
                ) : (
                  <span className="chip bg-sky-100 text-sky-700">{t(locale, "assignment.submitted")}</span>
                )}
              </div>
              {s.text && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{s.text}</p>}
              {s.feedback && (
                <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="font-semibold">{t(locale, "assignment.feedback")}:</span> {s.feedback}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {canSubmit && (
        <SubmitAssignmentForm
          locale={locale}
          assignmentId={asg.id}
          allowText={asg.allowText}
          allowFile={asg.allowFile}
          resubmit={submissions.length > 0}
        />
      )}
    </div>
  );
}
