import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { upsertQuestion, QuestionInput } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("questions.manage");
  const { id } = await ctx.params;
  const row = await prisma.question.findFirst({
    where: { id, deletedAt: null },
    include: { translations: true, choices: { orderBy: { sort: "asc" } }, tags: true, versions: { orderBy: { version: "desc" }, take: 10 } },
  });
  if (!row) throw err.notFound();
  return ok({ row });
});

export const PUT = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("questions.manage");
  const { id } = await ctx.params;
  const data = await parseBody(req, QuestionInput);
  const q = await upsertQuestion(a.orgId, a.userId, data, id);
  await audit({ actorId: a.userId, action: "question.update", entityType: "Question", entityId: id, ip: clientIp(req) });
  return ok({ row: q });
});

// Архивирование вместо физического удаления (§8)
export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("questions.manage");
  const { id } = await ctx.params;
  await prisma.question.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
  await audit({ actorId: a.userId, action: "question.archive", entityType: "Question", entityId: id, ip: clientIp(req) });
  return ok({ ok: true });
});
