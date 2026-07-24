import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { CourseInput, saveCourse } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("courses.manage");
  const { id } = await ctx.params;
  const row = await prisma.course.findFirst({
    where: { id, deletedAt: null },
    include: {
      translations: true,
      teachers: true,
      modules: {
        orderBy: { sort: "asc" },
        include: { lessons: { where: { deletedAt: null }, orderBy: { sort: "asc" }, include: { translations: true } }, assignments: { where: { deletedAt: null } } },
      },
    },
  });
  if (!row) throw err.notFound();
  return ok({ row });
});

export const PUT = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("courses.manage");
  const { id } = await ctx.params;
  const data = await parseBody(req, CourseInput);
  const row = await saveCourse(a.orgId, a.userId, data, id);
  await audit({ actorId: a.userId, action: "course.update", entityType: "Course", entityId: id, ip: clientIp(req) });
  return ok({ row });
});

export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("courses.publish");
  const { id } = await ctx.params;
  await prisma.course.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
  await audit({ actorId: a.userId, action: "course.archive", entityType: "Course", entityId: id, ip: clientIp(req) });
  return ok({ ok: true });
});
