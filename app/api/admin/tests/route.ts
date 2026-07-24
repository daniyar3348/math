// Конструктор тестов: список + создание (секции, настройки, переводы).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, parseBody, pageArgs, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { upsertTest, TestInput } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

const Query = z.object({
  q: z.string().max(100).optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handler(async (req: Request) => {
  const a = await requirePermission("tests.manage");
  const query = parseQuery(req, Query);
  const where: Record<string, unknown> = { organizationId: a.orgId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.q) where.translations = { some: { title: { contains: query.q, mode: "insensitive" } } };
  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);
  const [total, rows] = await Promise.all([
    prisma.test.count({ where }),
    prisma.test.findMany({
      where,
      include: { translations: true, subject: true, sections: { include: { questions: true } }, _count: { select: { attempts: true } } },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);
  return ok({ rows, total, page, pageSize });
});

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("tests.manage");
  const data = await parseBody(req, TestInput);
  const test = await upsertTest(a.orgId, a.userId, data);
  await audit({ actorId: a.userId, action: "test.create", entityType: "Test", entityId: test.id, ip: clientIp(req) });
  return ok({ row: test });
});
