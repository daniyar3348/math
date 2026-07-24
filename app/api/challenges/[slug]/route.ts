import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { getAuth } from "@/lib/auth/guard";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const c = await prisma.challenge.findFirst({
    where: { slug, deletedAt: null, status: "PUBLISHED" },
    include: {
      translations: true,
      subject: true,
      gradeLevel: true,
      activities: { orderBy: { sort: "asc" }, include: { test: { include: { translations: true } } } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!c) throw err.notFound();
  const now = new Date();

  const a = await getAuth();
  let joined = false;
  let myAttemptsByTest: Record<string, { id: string; status: string }[]> = {};
  let paid = false;
  if (a) {
    joined = !!(await prisma.challengeEnrollment.findUnique({
      where: { challengeId_userId: { challengeId: c.id, userId: a.userId } },
    }));
    if (c.accessType === "PAID") {
      paid = !!(await prisma.payment.findFirst({
        where: { userId: a.userId, refType: "CHALLENGE", refId: c.id, status: "PAID" },
      }));
    }
    if (joined) {
      const attempts = await prisma.testAttempt.findMany({
        where: { userId: a.userId, challengeId: c.id },
        select: { id: true, status: true, testId: true },
      });
      myAttemptsByTest = attempts.reduce((acc, at) => {
        (acc[at.testId] ??= []).push({ id: at.id, status: at.status });
        return acc;
      }, {} as Record<string, { id: string; status: string }[]>);
    }
  }

  return ok({
    challenge: {
      id: c.id,
      slug: c.slug,
      coverFileId: c.coverFileId,
      accessType: c.accessType,
      priceKzt: c.priceKzt,
      regStartAt: c.regStartAt,
      regEndAt: c.regEndAt,
      startAt: c.startAt,
      endAt: c.endAt,
      state: c.startAt > now ? "planned" : c.endAt < now ? "finished" : "active",
      participants: c._count.enrollments,
      maxParticipants: c.maxParticipants,
      needsAccessCode: !!c.accessCode,
      translations: c.translations,
      subject: c.subject ? { nameKk: c.subject.nameKk, nameRu: c.subject.nameRu } : null,
      grade: c.gradeLevel ? { nameKk: c.gradeLevel.nameKk, nameRu: c.gradeLevel.nameRu } : null,
      activities: c.activities.map((act) => ({
        testId: act.testId,
        testSlug: act.test.slug,
        pointsWeight: act.pointsWeight,
        translations: act.test.translations.map((t) => ({ locale: t.locale, title: t.title })),
      })),
    },
    joined,
    paid,
    myAttemptsByTest,
  });
});
