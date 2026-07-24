import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { LessonInput, saveLesson } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("courses.manage");
  const { id } = await ctx.params;
  const row = await prisma.lesson.findFirst({ where: { id, deletedAt: null }, include: { translations: true, resources: true } });
  if (!row) throw err.notFound();
  return ok({ row });
});

export const PUT = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("courses.manage");
  const { id } = await ctx.params;
  const data = await parseBody(req, LessonInput);
  const row = await saveLesson(a, data, id);
  await audit({ actorId: a.userId, action: "lesson.update", entityType: "Lesson", entityId: id, ip: clientIp(req) });
  return ok({ row });
});

export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("courses.manage");
  const { id } = await ctx.params;
  await prisma.lesson.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  await audit({ actorId: a.userId, action: "lesson.archive", entityType: "Lesson", entityId: id, ip: clientIp(req) });
  return ok({ ok: true });
});
