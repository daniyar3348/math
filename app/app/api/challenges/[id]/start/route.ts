import { NextRequest, NextResponse } from "next/server";
import { db, hasAccess, newId, type Row } from "@/lib/db";
import { getAuthUser, notFound, forbidden } from "@/lib/auth";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

// Открывает серверную попытку. Все ответы и финальный счёт привязаны к ней —
// подделать результат, не отвечая на вопросы, нельзя.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!rateLimit(`start:${clientIp(req)}`, 30, 60_000)) return tooManyRequests();

  const { id } = await ctx.params;
  const ch = db()
    .prepare(
      `SELECT ch.*, c.price_kzt AS c_price FROM challenges ch
       JOIN courses c ON c.id = ch.course_id WHERE ch.id = ?`
    )
    .get(id) as Row | undefined;
  if (!ch) return notFound();

  const user = getAuthUser(req);
  if (!hasAccess(user, { id: ch.course_id, price_kzt: ch.c_price })) return forbidden();

  const attemptId = newId();
  db()
    .prepare(
      "INSERT INTO quiz_attempts (id, user_id, challenge_id, started_at, submitted) VALUES (?,?,?,?,0)"
    )
    .run(attemptId, user?.id ?? null, id, Date.now());

  return NextResponse.json({ attemptId, timeLimitSec: ch.time_limit_sec });
}
