// Завершение всех активных сессий пользователя (§4).
import { handler, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { revokeAllSessions, destroyCurrentSession } from "@/lib/auth/session";

export const POST = handler(async () => {
  const a = await requireAuth();
  await revokeAllSessions(a.userId);
  await destroyCurrentSession();
  return ok({ ok: true });
});
