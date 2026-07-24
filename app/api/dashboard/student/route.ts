// Данные кабинета ученика (§11): курсы, дедлайны, челленджи, результаты, баллы.
import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { pointsTotal, streakDays, levelForPoints } from "@/lib/points";

export const GET = handler(async () => {
  const a = await requireAuth();
  const now = new Date();

  const [enrollments, upcoming, myChallenges, attempts, points, streak, badges, notifications] =
    await Promise.all([
      prisma.enrollment.findMany({
        where: { userId: a.userId },
        include: { course: { include: { translations: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.assignment.findMany({
        where: {
          deletedAt: null,
          status: "PUBLISHED",
          dueAt: { gte: now },
          course: { enrollments: { some: { userId: a.userId } } },
        },
        orderBy: { dueAt: "asc" },
        take: 5,
        include: { course: true },
      }),
      prisma.challengeEnrollment.findMany({
        where: { userId: a.userId, challenge: { endAt: { gte: now }, status: "PUBLISHED" } },
        include: { challenge: { include: { translations: true } } },
      }),
      prisma.testAttempt.findMany({
        where: { userId: a.userId, status: "GRADED" },
        orderBy: { submittedAt: "desc" },
        take: 5,
        include: { test: { include: { translations: true } } },
      }),
      pointsTotal(a.userId),
      streakDays(a.userId),
      prisma.userBadge.findMany({ where: { userId: a.userId }, include: { badge: true } }),
      prisma.notification.count({ where: { userId: a.userId, readAt: null } }),
    ]);

  return ok({
    courses: enrollments.map((en) => ({
      slug: en.course.slug,
      translations: en.course.translations,
      progressPct: en.progressPct,
      status: en.status,
    })),
    upcoming: upcoming.map((asg) => ({
      id: asg.id,
      titleKk: asg.titleKk,
      titleRu: asg.titleRu,
      dueAt: asg.dueAt,
      courseSlug: asg.course.slug,
    })),
    challenges: myChallenges.map((ce) => ({
      slug: ce.challenge.slug,
      translations: ce.challenge.translations,
      startAt: ce.challenge.startAt,
      endAt: ce.challenge.endAt,
      rank: ce.rank,
      points: ce.totalPoints,
    })),
    results: attempts.map((at) => ({
      attemptId: at.id,
      testSlug: at.test.slug,
      translations: at.test.translations.map((t) => ({ locale: t.locale, title: t.title })),
      pct: at.maxScore > 0 ? Math.round(((at.totalScore ?? 0) / at.maxScore) * 100) : 0,
      passed: at.passed,
      at: at.submittedAt,
    })),
    gamification: {
      points,
      level: levelForPoints(points),
      streak,
      badges: badges.map((b) => ({
        slug: b.badge.slug,
        icon: b.badge.icon,
        nameKk: b.badge.nameKk,
        nameRu: b.badge.nameRu,
      })),
    },
    unreadNotifications: notifications,
  });
});
