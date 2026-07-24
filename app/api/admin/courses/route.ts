// Курсы: список + создание (ядро + переводы + преподаватели).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, parseBody, pageArgs, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { CourseInput, saveCourse } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

const Query = z.object({
  q: z.string().max(100).optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handler(async (req: Request) => {
  const a = await requirePermission("courses.manage");
  const query = parseQuery(req, Query);
  const where: Record<string, unknown> = { organizationId: a.orgId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.q) where.translations = { some: { title: { contains: query.q, mode: "insensitive" } } };
  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);
  const [total, rows] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      include: {
        translations: true,
        subject: true,
        teachers: true,
        _count: { select: { enrollments: true, modules: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);
  return ok({ rows, total, page, pageSize });
});

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("courses.manage");
  const data = await parseBody(req, CourseInput);
  const row = await saveCourse(a.orgId, a.userId, data);
  await audit({ actorId: a.userId, action: "course.create", entityType: "Course", entityId: row.id, ip: clientIp(req) });
  return ok({ row });
});
