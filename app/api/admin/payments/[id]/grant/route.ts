// Ручное подтверждение платежа админом (идемпотентно, через общий механизм).
import { handler, ok, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { applyPaymentStatus } from "@/lib/payments";
import { audit } from "@/lib/audit";

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requirePermission("payments.grant");
  const { id } = await ctx.params;
  const result = await applyPaymentStatus(id, "PAID", `manual-by-${a.userId.slice(0, 8)}`);
  await audit({ actorId: a.userId, action: "payment.manual_grant", entityType: "Payment", entityId: id, ip: clientIp(req) });
  return ok(result);
});
