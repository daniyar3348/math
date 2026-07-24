import { handler, ok } from "@/lib/http";
import { destroyCurrentSession } from "@/lib/auth/session";

export const POST = handler(async () => {
  await destroyCurrentSession();
  return ok({ ok: true });
});
