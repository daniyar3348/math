import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { upsertTest, TestInput } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("tests.manage");
  const { id } = await ctx.params;
  const row = await prisma.test.findFirst({
    where: { id, deletedAt: null },
    include: {
      translations: true,
      cohortAccess: true,
      sections: { orderBy: { sort: "asc" }, include: { questions: { orderBy: { sort: "asc" }, include: { question: { include: { translations: true } } } } } },
    },
  });
  if (!row) throw err.notFound();
  return ok({ row });
});

export const PUT = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("tests.manage");
  const { id } = await ctx.params;
  const data = await parseBody(req, TestInput);
  const test = await upsertTest(a.orgId, a.userId, data, id);
  await audit({ actorId: a.userId, action: "test.update", entityType: "Test", entityId: id, ip: clientIp(req) });
  return ok({ row: test });
});

export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("tests.publish");
  const { id } = await ctx.params;
  await prisma.test.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
  await audit({ actorId: a.userId, action: "test.archive", entityType: "Test", entityId: id, ip: clientIp(req) });
  return ok({ ok: true });
});
