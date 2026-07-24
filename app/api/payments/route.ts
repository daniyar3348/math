// Создание платежа (сумма — только из БД) + история своих платежей.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { createPayment } from "@/lib/payments";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  refType: z.enum(["COURSE", "CHALLENGE", "TEST"]),
  refId: z.string().min(1),
});

export const POST = handler(async (req: Request) => {
  const a = await requireAuth();
  await rateLimit(`pay:create:${a.userId}`, 10, 60_000);
  const body = await parseBody(req, Body);
  const result = await createPayment({
    orgId: a.orgId,
    userId: a.userId,
    refType: body.refType,
    refId: body.refId,
  });
  return ok(result);
});

export const GET = handler(async () => {
  const a = await requireAuth();
  const rows = await prisma.payment.findMany({
    where: { userId: a.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({
    rows: rows.map((p) => ({
      id: p.id,
      refType: p.refType,
      refId: p.refId,
      amountKzt: p.amountKzt,
      status: p.status,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
    })),
  });
});
