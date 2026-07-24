// Состояние попытки для прохождения: вопросы в порядке раскладки,
// БЕЗ правильных ответов; сохранённые ответы; серверный дедлайн.
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import type { LayoutItem } from "@/lib/engine/types";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();
  const attempt = await prisma.testAttempt.findFirst({
    where: { id, userId: a.userId },
    include: { test: { include: { translations: true } }, answers: true },
  });
  if (!attempt) throw err.notFound();

  const layout = attempt.layout as unknown as LayoutItem[];
  const questions = await prisma.question.findMany({
    where: { id: { in: layout.map((l) => l.questionId) } },
    include: { translations: true, choices: true },
  });
  const qById = new Map(questions.map((q) => [q.id, q]));

  const items = layout.map((item, idx) => {
    const q = qById.get(item.questionId)!;
    const cfg = q.config as Record<string, unknown>;
    // конфиг для клиента — без правильных ответов
    const publicConfig: Record<string, unknown> = {};
    if (q.type === "MATCHING") {
      const pairs = (cfg.pairs as { left: unknown; right: unknown }[]) ?? [];
      publicConfig.left = pairs.map((p) => p.left);
      publicConfig.right = (item.presentOrderRight ?? pairs.map((_, i) => i)).map((i) => pairs[i]?.right);
      publicConfig.rightOrder = item.presentOrderRight ?? pairs.map((_, i) => i);
    }
    if (q.type === "ORDERING") {
      const itemsCfg = (cfg.items as unknown[]) ?? [];
      publicConfig.items = (item.presentOrder ?? itemsCfg.map((_, i) => i)).map((i) => itemsCfg[i]);
      publicConfig.itemOrder = item.presentOrder ?? itemsCfg.map((_, i) => i);
    }
    if (q.type === "FILL_BLANKS") {
      publicConfig.blankIds = ((cfg.blanks as { id: string }[]) ?? []).map((b) => b.id);
    }
    if (q.type === "FILE_UPLOAD") publicConfig.maxSizeMb = cfg.maxSizeMb ?? 10;
    if (q.type === "ESSAY") publicConfig.minWords = cfg.minWords ?? 0;

    const choiceOrder = item.choiceOrder ?? q.choices.sort((x, y) => x.sort - y.sort).map((c) => c.id);
    const choices = ["SINGLE_CHOICE", "MULTI_CHOICE"].includes(q.type)
      ? choiceOrder
          .map((cid) => q.choices.find((c) => c.id === cid))
          .filter(Boolean)
          .map((c) => ({ id: c!.id, textKk: c!.textKk, textRu: c!.textRu, imageFileId: c!.imageFileId }))
      : [];

    const saved = attempt.answers.find((ans) => ans.questionId === q.id);
    return {
      index: idx,
      questionId: q.id,
      type: q.type,
      points: item.points,
      sectionKk: item.sectionKk,
      sectionRu: item.sectionRu,
      translations: q.translations.map((t) => ({ locale: t.locale, prompt: t.prompt })),
      choices,
      config: publicConfig,
      response: saved ? (saved.response as object) : null,
      flagged: saved?.flagged ?? false,
    };
  });

  return ok({
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      serverNow: new Date().toISOString(), // клиентский таймер синхронизируется с сервером
      testSlug: attempt.test.slug,
      allowBack: attempt.test.allowBack,
      onePerPage: attempt.test.onePerPage,
      autoSubmit: attempt.test.autoSubmit,
      translations: attempt.test.translations.map((t) => ({
        locale: t.locale,
        title: t.title,
        instructions: t.instructions,
      })),
    },
    items,
  });
});
