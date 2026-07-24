// Публичная карточка теста + статус попыток текущего пользователя.
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { getAuth } from "@/lib/auth/guard";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const test = await prisma.test.findFirst({
    where: { slug, deletedAt: null, status: "PUBLISHED" },
    include: {
      translations: true,
      subject: true,
      gradeLevel: true,
      sections: { include: { questions: true } },
    },
  });
  if (!test) throw err.notFound();

  const a = await getAuth();
  let attempts: { id: string; status: string; attemptNo: number }[] = [];
  let paid = false;
  if (a) {
    attempts = await prisma.testAttempt.findMany({
      where: { testId: test.id, userId: a.userId },
      select: { id: true, status: true, attemptNo: true },
      orderBy: { attemptNo: "asc" },
    });
    if (test.accessType === "PAID") {
      paid = !!(await prisma.payment.findFirst({
        where: { userId: a.userId, refType: "TEST", refId: test.id, status: "PAID" },
      }));
    }
  }

  const questionCount = test.sections.reduce(
    (s, sec) => s + sec.questions.length + (sec.randomCount ?? 0),
    0
  );

  return ok({
    test: {
      id: test.id,
      slug: test.slug,
      mode: test.mode,
      accessType: test.accessType,
      priceKzt: test.priceKzt,
      timeLimitSec: test.timeLimitSec,
      attemptsAllowed: test.attemptsAllowed,
      passPct: test.passPct,
      availableFrom: test.availableFrom,
      availableTo: test.availableTo,
      needsAccessCode: !!test.accessCode,
      questionCount,
      translations: test.translations,
      subject: { nameKk: test.subject.nameKk, nameRu: test.subject.nameRu },
      grade: test.gradeLevel ? { nameKk: test.gradeLevel.nameKk, nameRu: test.gradeLevel.nameRu } : null,
    },
    attempts,
    paid,
  });
});
