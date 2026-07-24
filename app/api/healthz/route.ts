// Healthcheck: приложение живо и БД отвечает.
import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/http";

export const GET = handler(async () => {
  await prisma.$queryRaw`SELECT 1`;
  return ok({ ok: true });
});
