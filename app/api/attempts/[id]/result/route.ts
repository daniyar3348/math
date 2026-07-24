// Результат попытки с учётом политики показа (§8): когда показывать баллы,
// правильные ответы и объяснения; диагностический разбор для mode=DIAGNOSTIC.
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { isStaff } from "@/lib/rbac";
import { diagnosticsForAttempt } from "@/lib/engine/attempt";
import type { LayoutItem } from "@/lib/engine/types";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();
  const attempt = await prisma.testAttempt.findFirst({
    where: { id, ...(isStaff(a.roles) ? {} : { userId: a.userId }) },
    include: { test: { include: { translations: true } }, answers: { include: { review: true } } },
  });
  if (!attempt) throw err.notFound();
  if (attempt.status === "IN_PROGRESS") throw err.conflict("attempt_in_progress");

  const test = attempt.test;
  const now = new Date();
  const closed = !test.availableTo || now > test.availableTo;
  const staff = isStaff(a.roles);

  // политика показа результатов
  const scoresVisible =
    staff ||
    test.resultsPolicy === "IMMEDIATE" ||
    (test.resultsPolicy === "AFTER_CLOSE" && closed);

  const correctVisible =
    staff ||
    (test.showCorrect === "AFTER_SUBMIT" && scoresVisible) ||
    (test.showCorrect === "AFTER_CLOSE" && closed);

  const pendingManual = attempt.answers.some((ans) => ans.review && ans.review.status === "PENDING");

  const base = {
    id: attempt.id,
    status: attempt.status,
    pendingManual,
    submittedAt: attempt.submittedAt,
    testSlug: test.slug,
    mode: test.mode,
    translations: test.translations.map((t) => ({ locale: t.locale, title: t.title })),
  };

  if (!scoresVisible) {
    return ok({ result: { ...base, scoresVisible: false } });
  }

  const layout = attempt.layout as unknown as LayoutItem[];
  const questions = await prisma.question.findMany({
    where: { id: { in: layout.map((l) => l.questionId) } },
    include: { translations: true, choices: true },
  });
  const qById = new Map(questions.map((q) => [q.id, q]));

  const perQuestion = layout.map((item) => {
    const q = qById.get(item.questionId)!;
    const ans = attempt.answers.find((x) => x.questionId === q.id);
    const score = (ans?.autoScore ?? 0) + (ans?.manualScore ?? 0);
    const out: Record<string, unknown> = {
      questionId: q.id,
      type: q.type,
      points: item.points,
      score,
      answered: !!ans && Object.keys((ans.response as object) ?? {}).length > 0,
      manualPending: !!ans?.review && ans.review.status === "PENDING",
      reviewComment: ans?.comment ?? "",
      translations: q.translations.map((t) => ({
        locale: t.locale,
        prompt: t.prompt,
        explanation: correctVisible && test.showExplanations ? t.explanation : "",
      })),
    };
    if (correctVisible) {
      out.response = ans?.response ?? null;
      if (["SINGLE_CHOICE", "MULTI_CHOICE"].includes(q.type)) {
        out.correctChoiceIds = q.choices.filter((c) => c.correct).map((c) => c.id);
        out.choices = q.choices.map((c) => ({ id: c.id, textKk: c.textKk, textRu: c.textRu }));
      } else {
        out.config = q.config; // содержит эталон для остальных типов
      }
    }
    return out;
  });

  const diagnostics = test.mode === "DIAGNOSTIC" ? await diagnosticsForAttempt(attempt.id) : null;

  return ok({
    result: {
      ...base,
      scoresVisible: true,
      correctVisible,
      autoScore: attempt.autoScore,
      manualScore: attempt.manualScore,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      pct: attempt.maxScore > 0 ? Math.round(((attempt.totalScore ?? attempt.autoScore) / attempt.maxScore) * 100) : 0,
      passed: attempt.passed,
      passPct: test.passPct,
      perQuestion,
      diagnostics,
    },
  });
});
