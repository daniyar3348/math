import { NextRequest, NextResponse } from "next/server";
import { db, verifyPassword, type Row } from "@/lib/db";
import { createSession, setSessionCookie, badRequest } from "@/lib/auth";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";
import { verifyTotp } from "@/lib/totp";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("bad_json");
  const { email, password } = body as { email?: string; password?: string };
  if (!email || !password) return badRequest("fill_all");
  if (email.length > 120 || password.length > 100) return badRequest("too_long");

  // Brute-force protection: 5 attempts / min per IP+email, 20 / min per IP.
  const ip = clientIp(req);
  if (
    !rateLimit(`login:${ip}:${email.toLowerCase()}`, 5, 60_000) ||
    !rateLimit(`login-ip:${ip}`, 20, 60_000)
  ) {
    return tooManyRequests();
  }

  const user = db()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase()) as Row | undefined;
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    return badRequest("invalid_credentials");
  }

  // Второй фактор: если у аккаунта включён TOTP — требуем код.
  if (user.totp_enabled) {
    const totp = (body as { totp?: string }).totp;
    if (!totp) {
      return NextResponse.json({ error: "totp_required" }, { status: 401 });
    }
    if (!verifyTotp(user.totp_secret, totp)) {
      return badRequest("bad_totp");
    }
  }

  const token = createSession(user.id);
  const res = NextResponse.json({ ok: true, role: user.role });
  setSessionCookie(res, token);
  return res;
}
