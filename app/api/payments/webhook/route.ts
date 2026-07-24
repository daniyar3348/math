// Идемпотентный webhook платёжного провайдера (§13).
// Подпись обязательна; статус применяется один раз (PENDING→…).
import { z } from "zod";
import { handler, ok, err, parseBody } from "@/lib/http";
import { paymentProvider, applyPaymentStatus } from "@/lib/payments";

const Body = z.object({
  paymentId: z.string().min(1),
  status: z.enum(["PAID", "FAILED", "REFUNDED"]),
  signature: z.string().min(1),
  providerTxnId: z.string().max(120).optional(),
});

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, Body);
  if (!paymentProvider().verifyWebhook(body)) throw err.forbidden();
  const result = await applyPaymentStatus(body.paymentId, body.status, body.providerTxnId ?? "");
  return ok(result);
});
