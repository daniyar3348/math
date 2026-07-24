// Вход сотрудников/родителей: email+пароль (+TOTP для включивших 2FA).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, clientIp, err } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { verifyPassword } from "@/lib/auth/passwords";
import { verifyTotp } from "@/lib/auth/totp";
import { createSession } from "@/lib/auth/session";

const Body = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(128),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export const POST = handler(async (req: Request) => {
  const { email, password, totp } = await parseBody(req, Body);
  const ip = clientIp(req);
  await rateLimit(`login:${ip}`, 20, 60_000);
  await rateLimit(`login:${ip}:${email.toLowerCase()}`, 5, 60_000);

  const fail = async (reason: string) => {
    await prisma.loginEvent.create({ data: { identifier: email, ip, success: false, reason } });
    throw err.badRequest("invalid_credentials");
  };

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { memberships: { include: { role: true } } },
  });
  if (!user || !user.passwordHash || user.deletedAt) return fail("no_user");
  if (user.status === "BLOCKED") return fail("blocked");
  if (!(await verifyPassword(user.passwordHash, password))) return fail("bad_password");

  if (user.totpEnabled) {
    if (!totp) return ok({ totpRequired: true }, { status: 401 });
    if (!user.totpSecret || !verifyTotp(user.totpSecret, totp)) return fail("bad_totp");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.loginEvent.create({ data: { userId: user.id, identifier: email, ip, success: true } });
  await createSession(user.id, ip, req.headers.get("user-agent") ?? "");
  const roles = user.memberships.map((m) => m.role.name);
  return ok({ ok: true, roles });
});
