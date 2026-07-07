import { NextRequest, NextResponse } from "next/server";
import { db, hashPassword, verifyPassword } from "@/lib/db";
import { getAuthUser, unauthorized, badRequest, COOKIE } from "@/lib/auth";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

// Смена собственного пароля. Требует текущий пароль; отзывает все ДРУГИЕ
// сессии пользователя (текущая остаётся).
export async function POST(req: NextRequest) {
  if (!rateLimit(`pwchange:${clientIp(req)}`, 5, 60_000)) return tooManyRequests();

  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const { current, next } = (body ?? {}) as { current?: string; next?: string };
  if (!current || !next) return badRequest("fill_all");
  if (next.length < 6) return badRequest("short_password");
  if (next.length > 100 || current.length > 100) return badRequest("too_long");
  if (!verifyPassword(current, user.salt, user.password_hash))
    return badRequest("invalid_credentials");

  const { hash, salt } = hashPassword(next);
  db().prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(
    hash, salt, user.id
  );
  const currentToken = req.cookies.get(COOKIE)?.value ?? "";
  db()
    .prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?")
    .run(user.id, currentToken);

  return NextResponse.json({ ok: true });
}
