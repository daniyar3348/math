import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";

export const GET = handler(async () => {
  const a = await requireAuth();
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: a.userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: a.userId, readAt: null } }),
  ]);
  return ok({ rows, unread });
});

const Body = z.object({ ids: z.array(z.string()).max(100).optional() });

export const POST = handler(async (req: Request) => {
  const a = await requireAuth();
  const { ids } = await parseBody(req, Body);
  await prisma.notification.updateMany({
    where: { userId: a.userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return ok({ ok: true });
});
