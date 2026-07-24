// Dashboard-метрики (§12): счётчики, средние, график по дням.
import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/http";
import { requireStaff } from "@/lib/auth/guard";

export const GET = handler(async () => {
  await requireStaff();
  const now = Date.now();
  const day = 24 * 3600_000;
  const since30 = new Date(now - 30 * day);

  const [students, newStudents, activeCourses, activeChallenges, gradedAttempts, avgAgg, pendingReviews, pendingSubs, enrollTotal, enrollCompleted, attemptsRaw, regsRaw] =
    await Promise.all([
      prisma.membership.count({ where: { role: { name: "STUDENT" } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 }, memberships: { some: { role: { name: "STUDENT" } } } } }),
      prisma.course.count({ where: { status: "PUBLISHED", deletedAt: null } }),
      prisma.challenge.count({ where: { status: "PUBLISHED", deletedAt: null, endAt: { gte: new Date() } } }),
      prisma.testAttempt.count({ where: { status: "GRADED" } }),
      prisma.testAttempt.aggregate({ where: { status: "GRADED", maxScore: { gt: 0 } }, _avg: { totalScore: true, maxScore: true } }),
      prisma.manualReview.count({ where: { status: "PENDING" } }),
      prisma.assignmentSubmission.count({ where: { status: "SUBMITTED" } }),
      prisma.enrollment.count(),
      prisma.enrollment.count({ where: { status: "COMPLETED" } }),
      prisma.testAttempt.findMany({ where: { submittedAt: { gte: since30 } }, select: { submittedAt: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
    ]);

  const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(d);
  const days: { day: string; attempts: number; registrations: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day$ = fmtDay(new Date(now - i * day));
    days.push({
      day: day$,
      attempts: attemptsRaw.filter((a) => a.submittedAt && fmtDay(a.submittedAt) === day$).length,
      registrations: regsRaw.filter((r) => fmtDay(r.createdAt) === day$).length,
    });
  }

  const avgPct =
    avgAgg._avg.totalScore && avgAgg._avg.maxScore ? Math.round((avgAgg._avg.totalScore / avgAgg._avg.maxScore) * 100) : 0;

  return ok({
    students,
    newStudents,
    activeCourses,
    activeChallenges,
    gradedAttempts,
    avgPct,
    pendingReviews,
    pendingSubs,
    completionPct: enrollTotal > 0 ? Math.round((enrollCompleted / enrollTotal) * 100) : 0,
    days,
  });
});
