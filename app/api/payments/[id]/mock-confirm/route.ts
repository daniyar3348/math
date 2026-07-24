// Кнопка «оплатить» в mock-режиме: сам пользователь подтверждает свой платёж.
// Внутри вызывается тот же идемпотентный applyPaymentStatus, что и в webhook.
// В production с реальным провайдером этот роут отключён.
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { applyPaymentStatus } from "@/lib/payments";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  if ((process.env.PAYMENT_PROVIDER ?? "mock") !== "mock") throw err.forbidden();
  const { id } = await ctx.params;
  const a = await requireAuth();
  const p = await prisma.payment.findFirst({ where: { id, userId: a.userId } });
  if (!p) throw err.notFound();
  const result = await applyPaymentStatus(p.id, "PAID", `mock-${p.id.slice(0, 8)}`);
  return ok(result);
});
