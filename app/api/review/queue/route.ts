// Очередь ручной проверки развёрнутых ответов (staff; teacher — свои курсы не
// требуются: тесты не привязаны к курсам, поэтому очередь доступна по праву
// submissions.review; каждая запись содержит контекст теста).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, pageArgs } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";

const Query = z.object({
  status: z.enum(["PENDING", "DONE", "all"]).default("PENDING"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = handler(async (req: Request) => {
  await requirePermission("submissions.review");
  const query = parseQuery(req, Query);
  const where = query.status === "all" ? {} : { status: query.status };
  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);

  const [total, rows] = await Promise.all([
    prisma.manualReview.count({ where }),
    prisma.manualReview.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take,
      include: {
        answer: {
          include: {
            question: { include: { translations: true } },
            attempt: {
              include: {
                test: { include: { translations: true } },
                user: { include: { profile: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return ok({
    rows: rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      score: r.score,
      comment: r.comment,
      questionType: r.answer.question.type,
      questionTranslations: r.answer.question.translations.map((t) => ({ locale: t.locale, prompt: t.prompt })),
      response: r.answer.response,
      maxPoints: (r.answer.attempt.layout as { questionId: string; points: number }[]).find(
        (l) => l.questionId === r.answer.questionId
      )?.points ?? 0,
      test: r.answer.attempt.test.translations.map((t) => ({ locale: t.locale, title: t.title })),
      student: `${r.answer.attempt.user.profile?.firstName ?? ""} ${r.answer.attempt.user.profile?.lastName ?? ""}`.trim(),
      attemptId: r.answer.attemptId,
    })),
    total,
    page,
    pageSize,
  });
});
