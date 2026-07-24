// Урок: контент (Markdown+KaTeX), материалы, отметка о прохождении.
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { isStaff } from "@/lib/rbac";
import { isLocale, t, pickPair, type Locale } from "@/lib/i18n";
import { mdToHtml } from "@/lib/md";
import { tr } from "@/components/site/cards";
import { LessonCompleteButton } from "@/components/site/CourseActions";
import { signFileUrl } from "@/lib/files";

export default async function LessonPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const auth = await getAuth();
  if (!auth) redirect(`/${locale}/login`);

  const lesson = await prisma.lesson.findFirst({
    where: { id, deletedAt: null },
    include: {
      translations: true,
      resources: { orderBy: { sort: "asc" } },
      module: {
        include: {
          course: {
            include: { modules: { orderBy: { sort: "asc" }, include: { lessons: { where: { deletedAt: null, status: "PUBLISHED" }, orderBy: { sort: "asc" } } } } },
          },
        },
      },
    },
  });
  if (!lesson || (lesson.status !== "PUBLISHED" && !isStaff(auth.roles))) notFound();

  const course = lesson.module.course;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: auth.userId, courseId: course.id } },
    include: { lessonProgress: true },
  });
  if (!enrollment && !isStaff(auth.roles)) redirect(`/${locale}/courses/${course.slug}`);

  const done = new Set(enrollment?.lessonProgress.map((lp) => lp.lessonId) ?? []);
  if (course.sequential && enrollment && !isStaff(auth.roles)) {
    const all = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const idx = all.indexOf(lesson.id);
    if (all.slice(0, idx).some((lid) => !done.has(lid))) redirect(`/${locale}/courses/${course.slug}`);
  }

  const trn = tr(lesson.translations, locale);
  const html = mdToHtml(trn?.contentMd ?? "");

  // следующий урок
  const all = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const nextId = all[all.indexOf(lesson.id) + 1];

  return (
    <div className="container-app max-w-3xl py-10">
      <Link href={`/${locale}/courses/${course.slug}`} className="text-sm font-semibold text-slate-400 hover:underline">
        ← {t(locale, "common.back")}
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold">{trn?.title}</h1>

      {lesson.videoUrl && (
        <div className="card mt-5 overflow-hidden">
          <video controls className="w-full" src={lesson.videoUrl} />
        </div>
      )}

      <article className="prose-md mt-4" dangerouslySetInnerHTML={{ __html: html }} />

      {lesson.resources.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="font-bold">📎 {t(locale, "lesson.materials")}</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {lesson.resources.map((r) => (
              <li key={r.id}>
                <a
                  className="font-medium hover:underline"
                  style={{ color: "var(--primary)" }}
                  href={r.fileAssetId ? signFileUrl(r.fileAssetId, 3600) : r.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {pickPair(locale, r.titleKk, r.titleRu)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <LessonCompleteButton locale={locale} lessonId={lesson.id} done={done.has(lesson.id)} />
        {nextId && (
          <Link href={`/${locale}/lesson/${nextId}`} className="btn-outline">
            →
          </Link>
        )}
      </div>
    </div>
  );
}
