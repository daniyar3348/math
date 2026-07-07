import { NextRequest, NextResponse } from "next/server";
import { db, hashPassword, newId } from "@/lib/db";
import { createSession, setSessionCookie, badRequest } from "@/lib/auth";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  // 5 registrations / 10 min per IP — stops bot account farming.
  if (!rateLimit(`register:${clientIp(req)}`, 5, 10 * 60_000)) return tooManyRequests();

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("bad_json");
  const { name, email, password, region, grade } = body as {
    name?: string; email?: string; password?: string; region?: string; grade?: number;
  };

  if (!name?.trim() || !email?.trim() || !password) return badRequest("fill_all");
  if (name.length > 60 || email.length > 120 || password.length > 100 || (region ?? "").length > 40)
    return badRequest("too_long");
  if (!/^\S+@\S+\.\S+$/.test(email)) return badRequest("bad_email");
  if (password.length < 6) return badRequest("short_password");
  const safeGrade =
    Number.isInteger(grade) && (grade as number) >= 1 && (grade as number) <= 11
      ? (grade as number)
      : null;

  const exists = db().prepare("SELECT 1 AS x FROM users WHERE email = ?").get(email.toLowerCase());
  // Нейтральный ответ: не подтверждаем существование email (анти-enumeration;
  // полностью скрыть можно только с email-верификацией — отражено в CHANGELOG).
  if (exists) return badRequest("registration_failed");

  const { hash, salt } = hashPassword(password);
  const id = newId();
  db()
    .prepare(
      `INSERT INTO users (id, name, email, password_hash, salt, role, region, grade, xp, created_at)
       VALUES (?,?,?,?,?,'student',?,?,0,?)`
    )
    .run(id, name.trim(), email.toLowerCase(), hash, salt, region ?? "", safeGrade, Date.now());

  const token = createSession(id);
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token);
  return res;
}
