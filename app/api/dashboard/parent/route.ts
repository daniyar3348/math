// Кабинет родителя (§11): дети, прогресс, результаты, дедлайны, активность,
// комментарии преподавателей. Правильные ответы активных тестов не раскрываются.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, err } from "@/lib/http";
import { requireAuth, assertParentScope } from "@/lib/auth/guard";

const Query = z.object({ child: z.string().optional() });

export const GET = handler(async (req: Request) => {
  const a = await requireAuth();
  const { child } = parseQuery(req, Query);

  const links = await prisma.studentParent.findMany({
    where: { parentUserId: a.userId },
    include: { student: { include: { profile: true } } },
  });
  if (links.length === 0) return ok({ children: [], selected: null });

  const children = links.map((l) => ({
    id: l.studentUserId,
    name: `${l.student.profile?.firstName ?? ""} ${l.student.profile?.lastName ?? ""}`.trim(),
  }));
  const selectedId = child && children.some((c) => c.id === child) ? child : children[0].id;
  await assertParentScope(a, selectedId);

  const now = new Date();
  const [enrollments, attempts, upcoming, comments, activityDays] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: selectedId },
      include: { course: { include: { translations: true } } },
    }),
    prisma.testAttempt.findMany({
      where: { userId: selectedId, status: "GRADED" },
      orderBy: { submittedAt: "desc" },
      take: 8,
      include: { test: { include: { translations: true } } },
    }),
    prisma.assignment.findMany({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
        dueAt: { gte: now },
        course: { enrollments: { some: { userId: selectedId } } },
      },
      orderBy: { dueAt: "asc" },
      take: 6,
    }),
    prisma.assignmentSubmission.findMany({
      where: { studentId: selectedId, feedback: { not: "" } },
      orderBy: { gradedAt: "desc" },
      take: 6,
      include: { assignment: true },
    }),
    prisma.pointTransaction.findMany({
      where: { userId: selectedId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
  ]);

  if (!enrollments && !attempts) throw err.notFound();

  const days = new Set(
    activityDays.map((r) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(r.createdAt))
  );

  return ok({
    children,
    selected: selectedId,
    courses: enrollments.map((en) => ({
      slug: en.course.slug,
      translations: en.course.translations,
      progressPct: en.progressPct,
      status: en.status,
    })),
    // результаты — без правильных ответов активных тестов (только итоги)
    results: attempts.map((at) => ({
      testTranslations: at.test.translations.map((t) => ({ locale: t.locale, title: t.title })),
      pct: at.maxScore > 0 ? Math.round(((at.totalScore ?? 0) / at.maxScore) * 100) : 0,
      passed: at.passed,
      at: at.submittedAt,
    })),
    upcoming: upcoming.map((asg) => ({ titleKk: asg.titleKk, titleRu: asg.titleRu, dueAt: asg.dueAt })),
    teacherComments: comments.map((c) => ({
      assignment: { titleKk: c.assignment.titleKk, titleRu: c.assignment.titleRu },
      feedback: c.feedback,
      score: c.score,
      at: c.gradedAt,
    })),
    activeDays: [...days].slice(0, 60),
  });
});
