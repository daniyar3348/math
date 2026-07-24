// Ручная корректировка баллов — с ОБЯЗАТЕЛЬНЫМ комментарием (§10) и аудитом.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, parseQuery, pageArgs, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { awardPoints } from "@/lib/points";
import { audit } from "@/lib/audit";

const Body = z.object({
  userId: z.string().min(1),
  amount: z.number().min(-10000).max(10000).refine((v) => v !== 0, "amount_nonzero"),
  comment: z.string().min(5).max(500), // обязательный комментарий
});

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("points.adjust");
  const body = await parseBody(req, Body);
  await awardPoints({
    orgId: a.orgId,
    userId: body.userId,
    amount: body.amount,
    reason: "manual_adjustment",
    idempotencyKey: `manual:${a.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    comment: body.comment,
    createdById: a.userId,
  });
  await audit({ actorId: a.userId, action: "points.adjust", entityType: "PointTransaction", after: { userId: body.userId, amount: body.amount, comment: body.comment }, ip: clientIp(req) });
  return ok({ ok: true });
});

const Query = z.object({
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handler(async (req: Request) => {
  await requirePermission("points.adjust");
  const query = parseQuery(req, Query);
  const where = query.userId ? { userId: query.userId } : {};
  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);
  const [total, rows] = await Promise.all([
    prisma.pointTransaction.count({ where }),
    prisma.pointTransaction.findMany({
      where,
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  return ok({ rows, total, page, pageSize });
});
