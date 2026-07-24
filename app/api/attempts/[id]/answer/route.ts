import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { saveAnswer } from "@/lib/engine/attempt";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  questionId: z.string().min(1),
  response: z.unknown().optional(),
  flagged: z.boolean().optional(),
});

export const PUT = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();
  await rateLimit(`attempt:save:${a.userId}`, 240, 60_000);
  const body = await parseBody(req, Body);
  const saved = await saveAnswer({
    attemptId: id,
    userId: a.userId,
    questionId: body.questionId,
    response: body.response ?? null,
    flagged: body.flagged,
  });
  return ok({ ok: true, savedAt: saved.savedAt });
});
