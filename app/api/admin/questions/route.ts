// Банк вопросов: список с фильтрами + создание (переводы/варианты/версии).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, parseBody, pageArgs, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { upsertQuestion, QuestionInput, questionI18nReady } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

const Query = z.object({
  q: z.string().max(100).optional(),
  subjectId: z.string().optional(),
  topicId: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handler(async (req: Request) => {
  const a = await requirePermission("questions.manage");
  const query = parseQuery(req, Query);
  const where: Record<string, unknown> = { organizationId: a.orgId, deletedAt: null };
  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.topicId) where.topicId = query.topicId;
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.q) where.translations = { some: { prompt: { contains: query.q, mode: "insensitive" } } };

  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);
  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { translations: true, subject: true, topic: true, choices: true, tags: true },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);
  return ok({
    rows: rows.map((q) => ({ ...q, i18nReady: questionI18nReady(q) })),
    total,
    page,
    pageSize,
  });
});

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("questions.manage");
  const data = await parseBody(req, QuestionInput);
  const q = await upsertQuestion(a.orgId, a.userId, data);
  await audit({ actorId: a.userId, action: "question.create", entityType: "Question", entityId: q.id, ip: clientIp(req) });
  return ok({ row: q });
});
