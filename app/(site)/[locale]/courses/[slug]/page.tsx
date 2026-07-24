// Страница курса: модули, уроки (замки при последовательном прохождении),
// задания, объявления, прогресс, запись/покупка, сертификат.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { isLocale, t, fmtDate, fmtTenge, pickPair, type Locale } from "@/lib/i18n";
import { tr } from "@/components/site/cards";
import { ProgressBar } from "@/components/ui";
import { CourseEnrollButton } from "@/components/site/CourseActions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const l = isLocale(raw) ? raw : "kk";
  const c = await prisma.course.findFirst({ where: { slug, status: "PUBLISHED" }, include: { translations: true } });
  const trn = c ? tr(c.translations, l) : null;
  return {
    title: trn?.seoTitle || trn?.title || slug,
    description: (trn?.seoDescription || trn?.description || "").slice(0, 160),
    alternates: {
      canonical: `/${l}/courses/${slug}`,
      languages: { kk: `/kk/courses/${slug}`, ru: `/ru/courses/${slug}` },
    },
  };
}

export default async function CoursePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const c = await prisma.course.findFirst({
    where: { slug, deletedAt: null, status: "PUBLISHED" },
    include: {
      translations: true,
      subject: true,
      gradeLevel: true,
      teachers: true,
      modules: {
        orderBy: { sort: "asc" },
        include: {
          lessons: { where: { deletedAt: null, status: "PUBLISHED" }, orderBy: { sort: "asc" }, include: { translations: true } },
          assignments: { where: { deletedAt: null, status: "PUBLISHED" } },
        },
      },
      announcements: { orderBy: { publishedAt: "desc" }, take: 3 },
    },
  });
  if (!c) notFound();

  const trn = tr(c.translations, locale);
  const auth = await getAuth();

  let enrollment: { progressPct: number } | null = null;
  let doneLessons = new Set<string>();
  let certificateCode: string | null = null;
  let paidCourse = false;
  if (auth) {
    const en = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: auth.userId, courseId: c.id } },
      include: { lessonProgress: true, certificate: true },
    });
    if (en) {
      enrollment = { progressPct: en.progressPct };
      doneLessons = new Set(en.lessonProgress.map((lp) => lp.lessonId));
      certificateCode = en.certificate?.code ?? null;
    }
    if (c.accessType === "PAID") {
      paidCourse = !!(await prisma.payment.findFirst({
        where: { userId: auth.userId, refType: "COURSE", refId: c.id, status: "PAID" },
      }));
    }
  }

  const teacherProfiles = await prisma.profile.findMany({
    where: { userId: { in: c.teachers.map((x) => x.userId) } },
  });

  const allLessonIds = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const unlocked = (lessonId: string) => {
    if (!c.sequential || !enrollment) return !c.sequential ? !!enrollment : false;
    const idx = allLessonIds.indexOf(lessonId);
    return allLessonIds.slice(0, idx).every((id) => doneLessons.has(id));
  };

  return (
    <div className="container-app grid gap-8 py-10 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          <span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            {pickPair(locale, c.subject.nameKk, c.subject.nameRu)}
          </span>
          {c.gradeLevel && <span className="chip bg-slate-100 text-slate-600">{pickPair(locale, c.gradeLevel.nameKk, c.gradeLevel.nameRu)}</span>}
          {c.accessType === "FREE" ? (
            <span className="chip bg-emerald-100 text-emerald-700">{t(locale, "common.free")}</span>
          ) : (
            <span className="chip" style={{ background: "var(--accent-soft)", color: "#92400e" }}>{fmtTenge(locale, c.priceKzt ?? 0)}</span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-extrabold">{trn?.title}</h1>
        <p className="mt-3 text-slate-600">{trn?.description}</p>
        {teacherProfiles.length > 0 && (
          <p className="mt-2 text-sm text-slate-500">
            {t(locale, "course.teacher")}: {teacherProfiles.map((p) => `${p.firstName} ${p.lastName}`.trim()).join(", ")}
          </p>
        )}

        {c.announcements.length > 0 && (
          <section className="card mt-6 p-5">
            <h2 className="font-bold">📣 {t(locale, "course.announcements")}</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {c.announcements.map((an) => (
                <li key={an.id}>
                  <span className="font-semibold">{pickPair(locale, an.titleKk, an.titleRu)}</span>{" "}
                  <span className="text-slate-500">— {pickPair(locale, an.bodyKk, an.bodyRu)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-3 text-xl font-bold">{t(locale, "course.modules")}</h2>
          <div className="space-y-4">
            {c.modules.map((m, mi) => (
              <div key={m.id} className="card p-5">
                <h3 className="font-bold text-slate-800">
                  {mi + 1}. {pickPair(locale, m.titleKk, m.titleRu)}
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {m.lessons.map((l) => {
                    const lt = tr(l.translations, locale);
                    const done = doneLessons.has(l.id);
                    const canOpen = enrollment && unlocked(l.id);
                    return (
                      <li key={l.id} className="flex items-center gap-2">
                        <span aria-hidden className="w-5 text-center">
                          {done ? "✅" : canOpen ? "▶️" : "🔒"}
                        </span>
                        {canOpen ? (
                          <Link href={`/${locale}/lesson/${l.id}`} className="font-medium text-slate-700 hover:underline">
                            {lt?.title}
                          </Link>
                        ) : (
                          <span className="text-slate-400" title={t(locale, "course.lessonLocked")}>
                            {lt?.title}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {m.assignments.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                    {m.assignments.map((asg) => (
                      <li key={asg.id} className="flex items-center gap-2 text-sm">
                        <span aria-hidden>📝</span>
                        {enrollment ? (
                          <Link href={`/${locale}/assignment/${asg.id}`} className="font-medium text-slate-700 hover:underline">
                            {pickPair(locale, asg.titleKk, asg.titleRu)}
                          </Link>
                        ) : (
                          <span className="text-slate-400">{pickPair(locale, asg.titleKk, asg.titleRu)}</span>
                        )}
                        {asg.dueAt && (
                          <span className="text-xs text-slate-400">
                            · {t(locale, "assignment.due")}: {fmtDate(locale, asg.dueAt)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside>
        <div className="card sticky top-24 space-y-4 p-5">
          {enrollment ? (
            <>
              <p className="text-sm font-semibold text-slate-500">{t(locale, "course.progress")}: {enrollment.progressPct}%</p>
              <ProgressBar pct={enrollment.progressPct} label={t(locale, "course.progress")} />
              {certificateCode && (
                <Link href={`/${locale}/certificates/${certificateCode}`} className="btn-accent w-full">
                  🎓 {t(locale, "course.certificate")}
                </Link>
              )}
            </>
          ) : (
            <CourseEnrollButton
              locale={locale}
              slug={c.slug}
              courseId={c.id}
              authed={!!auth}
              accessType={c.accessType}
              paid={paidCourse}
              selfEnroll={c.selfEnroll}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
