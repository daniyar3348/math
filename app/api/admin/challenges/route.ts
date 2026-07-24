// Челленджи: список + создание (переводы, активности-тесты, призы).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, parseBody, pageArgs, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { ChallengeInput, saveChallenge } from "@/lib/admin-actions";

const Query = z.object({
  q: z.string().max(100).optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handler(async (req: Request) => {
  const a = await requirePermission("challenges.manage");
  const query = parseQuery(req, Query);
  const where: Record<string, unknown> = { organizationId: a.orgId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.q) where.translations = { some: { title: { contains: query.q, mode: "insensitive" } } };
  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);
  const [total, rows] = await Promise.all([
    prisma.challenge.count({ where }),
    prisma.challenge.findMany({
      where,
      include: { translations: true, activities: true, _count: { select: { enrollments: true } } },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);
  return ok({ rows, total, page, pageSize });
});

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("challenges.manage");
  const data = await parseBody(req, ChallengeInput);
  const row = await saveChallenge(a.orgId, a.userId, data);
  await audit({ actorId: a.userId, action: "challenge.create", entityType: "Challenge", entityId: row.id, ip: clientIp(req) });
  return ok({ row });
});
