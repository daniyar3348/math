// Отметка «урок пройден» → пересчёт прогресса → сертификат при 100%.
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { notify } from "@/lib/notify";
import { awardPoints } from "@/lib/points";
import { defaultOrgId } from "@/lib/org";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();

  const lesson = await prisma.lesson.findFirst({
    where: { id, deletedAt: null, status: "PUBLISHED" },
    include: { module: true },
  });
  if (!lesson) throw err.notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: a.userId, courseId: lesson.module.courseId } },
  });
  if (!enrollment) throw err.forbidden();

  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } },
    update: {},
    create: { enrollmentId: enrollment.id, lessonId: lesson.id },
  });

  // прогресс
  const [totalLessons, doneLessons] = await Promise.all([
    prisma.lesson.count({
      where: { deletedAt: null, status: "PUBLISHED", module: { courseId: lesson.module.courseId } },
    }),
    prisma.lessonProgress.count({ where: { enrollmentId: enrollment.id } }),
  ]);
  const progressPct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
  const completed = progressPct >= 100;

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      progressPct,
      ...(completed && !enrollment.completedAt ? { status: "COMPLETED", completedAt: new Date() } : {}),
    },
  });

  await awardPoints({
    orgId: await defaultOrgId(),
    userId: a.userId,
    amount: 5,
    reason: "lesson_completed",
    refType: "LESSON",
    refId: lesson.id,
    idempotencyKey: `lesson:${lesson.id}:user:${a.userId}`,
  });

  let certificateCode: string | null = null;
  if (completed) {
    const course = await prisma.course.findUniqueOrThrow({ where: { id: lesson.module.courseId } });
    if (course.certificateEnabled) {
      const existing = await prisma.certificateAward.findUnique({ where: { enrollmentId: enrollment.id } });
      if (existing) certificateCode = existing.code;
      else {
        const code = `BH-${randomBytes(5).toString("hex").toUpperCase()}`;
        await prisma.certificateAward.create({
          data: { enrollmentId: enrollment.id, userId: a.userId, code },
        });
        certificateCode = code;
        await notify(a.userId, "certificate_issued", { courseId: course.id, code });
      }
    }
  }

  return ok({ progressPct, completed, certificateCode });
});
