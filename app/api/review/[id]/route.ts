// Выставление балла за развёрнутый ответ; при последней проверке — финализация попытки.
import { z } from "zod";
import { handler, ok, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { completeManualReview } from "@/lib/engine/attempt";
import { audit } from "@/lib/audit";

const Body = z.object({
  score: z.number().min(0),
  comment: z.string().max(5000).default(""),
});

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requirePermission("submissions.review");
  const body = await parseBody(req, Body);
  await completeManualReview({ reviewId: id, reviewerId: a.userId, score: body.score, comment: body.comment });
  await audit({
    actorId: a.userId,
    action: "manual_review.complete",
    entityType: "ManualReview",
    entityId: id,
    after: { score: body.score },
    ip: clientIp(req),
  });
  return ok({ ok: true });
});
