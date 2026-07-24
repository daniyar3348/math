// Аналитические события попытки (переключение вкладки и т.п.). Не анти-чит.
import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { trackAttemptEvent } from "@/lib/engine/attempt";

const Body = z.object({ event: z.enum(["tab_switch", "fullscreen_exit"]) });

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();
  const { event } = await parseBody(req, Body);
  await trackAttemptEvent(id, a.userId, event);
  return ok({ ok: true });
});
