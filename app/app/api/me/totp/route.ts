import { NextRequest, NextResponse } from "next/server";
import { db, type Row } from "@/lib/db";
import { getAuthUser, unauthorized, badRequest, forbidden } from "@/lib/auth";
import { generateTotpSecret, verifyTotp, otpauthUri } from "@/lib/totp";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

// 2FA (TOTP) для админ-аккаунтов: setup → confirm → (disable).
export async function POST(req: NextRequest) {
  if (!rateLimit(`totp:${clientIp(req)}`, 10, 60_000)) return tooManyRequests();

  const user = getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden(); // пока только для админов

  const body = await req.json().catch(() => null);
  const { action, code } = (body ?? {}) as { action?: string; code?: string };

  const fresh = db().prepare("SELECT * FROM users WHERE id = ?").get(user.id) as Row;

  switch (action) {
    case "setup": {
      if (fresh.totp_enabled) return badRequest("already_enabled");
      const secret = generateTotpSecret();
      db().prepare("UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?").run(
        secret, user.id
      );
      return NextResponse.json({ secret, uri: otpauthUri(user.email, secret) });
    }
    case "confirm": {
      if (!fresh.totp_secret) return badRequest("setup_first");
      if (!code || !verifyTotp(fresh.totp_secret, code)) return badRequest("bad_totp");
      db().prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?").run(user.id);
      return NextResponse.json({ ok: true });
    }
    case "disable": {
      if (!fresh.totp_enabled) return badRequest("not_enabled");
      if (!code || !verifyTotp(fresh.totp_secret, code)) return badRequest("bad_totp");
      db()
        .prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?")
        .run(user.id);
      return NextResponse.json({ ok: true });
    }
    default:
      return badRequest("unknown_action");
  }
}
