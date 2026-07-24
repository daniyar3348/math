import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { ChallengeInput, saveChallenge } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("challenges.manage");
  const { id } = await ctx.params;
  const row = await prisma.challenge.findFirst({
    where: { id, deletedAt: null },
    include: { translations: true, activities: { orderBy: { sort: "asc" } } },
  });
  if (!row) throw err.notFound();
  return ok({ row });
});

export const PUT = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("challenges.manage");
  const { id } = await ctx.params;
  const data = await parseBody(req, ChallengeInput);
  const row = await saveChallenge(a.orgId, a.userId, data, id);
  await audit({ actorId: a.userId, action: "challenge.update", entityType: "Challenge", entityId: id, ip: clientIp(req) });
  return ok({ row });
});

export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("challenges.publish");
  const { id } = await ctx.params;
  await prisma.challenge.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
  await audit({ actorId: a.userId, action: "challenge.archive", entityType: "Challenge", entityId: id, ip: clientIp(req) });
  return ok({ ok: true });
});
