// Страница курса: модули/уроки/задания (метаданные), прогресс и доступ ученика.
// Полный контент урока отдаёт /api/lessons/[id] с проверкой prerequisite.
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { getAuth } from "@/lib/auth/guard";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
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
      announcements: { orderBy: { publishedAt: "desc" }, take: 5 },
    },
  });
  if (!c) throw err.notFound();

  const a = await getAuth();
  let enrollment: { id: string; progressPct: number; completedAt: Date | null } | null = null;
  let completedLessonIds: string[] = [];
  let certificateCode: string | null = null;
  if (a) {
    const en = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: a.userId, courseId: c.id } },
      include: { lessonProgress: true, certificate: true },
    });
    if (en) {
      enrollment = { id: en.id, progressPct: en.progressPct, completedAt: en.completedAt };
      completedLessonIds = en.lessonProgress.map((lp) => lp.lessonId);
      certificateCode = en.certificate?.code ?? null;
    }
  }

  const teacherProfiles = await prisma.profile.findMany({
    where: { userId: { in: c.teachers.map((t) => t.userId) } },
  });

  // последовательное прохождение: урок доступен, если все предыдущие пройдены
  const allLessons = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const isUnlocked = (lessonId: string) => {
    if (!c.sequential) return true;
    const idx = allLessons.indexOf(lessonId);
    return allLessons.slice(0, idx).every((id) => completedLessonIds.includes(id));
  };

  return ok({
    course: {
      id: c.id,
      slug: c.slug,
      coverFileId: c.coverFileId,
      accessType: c.accessType,
      priceKzt: c.priceKzt,
      level: c.level,
      sequential: c.sequential,
      selfEnroll: c.selfEnroll,
      certificateEnabled: c.certificateEnabled,
      translations: c.translations,
      subject: { nameKk: c.subject.nameKk, nameRu: c.subject.nameRu },
      grade: c.gradeLevel ? { nameKk: c.gradeLevel.nameKk, nameRu: c.gradeLevel.nameRu } : null,
      teachers: teacherProfiles.map((p) => `${p.firstName} ${p.lastName}`.trim()),
      modules: c.modules.map((m) => ({
        id: m.id,
        titleKk: m.titleKk,
        titleRu: m.titleRu,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          translations: l.translations.map((t) => ({ locale: t.locale, title: t.title })),
          completed: completedLessonIds.includes(l.id),
          unlocked: isUnlocked(l.id),
        })),
        assignments: m.assignments.map((asg) => ({
          id: asg.id,
          titleKk: asg.titleKk,
          titleRu: asg.titleRu,
          dueAt: asg.dueAt,
          maxScore: asg.maxScore,
        })),
      })),
      announcements: c.announcements.map((an) => ({
        id: an.id,
        titleKk: an.titleKk,
        titleRu: an.titleRu,
        bodyKk: an.bodyKk,
        bodyRu: an.bodyRu,
        publishedAt: an.publishedAt,
      })),
    },
    enrollment,
    certificateCode,
  });
});
