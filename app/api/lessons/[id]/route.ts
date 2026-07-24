// Контент урока: только записанным, с проверкой последовательного доступа.
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { isStaff } from "@/lib/rbac";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();

  const lesson = await prisma.lesson.findFirst({
    where: { id, deletedAt: null },
    include: {
      translations: true,
      resources: { orderBy: { sort: "asc" } },
      module: { include: { course: { include: { modules: { orderBy: { sort: "asc" }, include: { lessons: { where: { deletedAt: null, status: "PUBLISHED" }, orderBy: { sort: "asc" } } } } } } } },
    },
  });
  if (!lesson || (lesson.status !== "PUBLISHED" && !isStaff(a.roles))) throw err.notFound();

  const course = lesson.module.course;
  const staff = isStaff(a.roles);

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: a.userId, courseId: course.id } },
    include: { lessonProgress: true },
  });
  if (!enrollment && !staff) throw err.forbidden();

  if (course.sequential && enrollment && !staff) {
    const all = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const done = new Set(enrollment.lessonProgress.map((lp) => lp.lessonId));
    const idx = all.indexOf(lesson.id);
    const locked = all.slice(0, idx).some((lid) => !done.has(lid));
    if (locked) throw err.conflict("lesson_locked");
  }

  return ok({
    lesson: {
      id: lesson.id,
      videoUrl: lesson.videoUrl,
      translations: lesson.translations,
      resources: lesson.resources.map((r) => ({
        id: r.id,
        type: r.type,
        url: r.url,
        fileAssetId: r.fileAssetId,
        titleKk: r.titleKk,
        titleRu: r.titleRu,
      })),
      courseSlug: course.slug,
      completed: enrollment?.lessonProgress.some((lp) => lp.lessonId === lesson.id) ?? false,
    },
  });
});
