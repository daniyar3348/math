import { handler, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { finalizeAttempt } from "@/lib/engine/attempt";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();
  const attempt = await finalizeAttempt(id, a.userId);
  return ok({ status: attempt.status });
});
