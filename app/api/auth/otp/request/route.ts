import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, clientIp, err } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { smsProvider } from "@/lib/auth/sms";

const Body = z.object({
  phone: z.string().regex(/^\+7\d{10}$/, "Формат: +7XXXXXXXXXX"),
});

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const POST = handler(async (req: Request) => {
  const { phone } = await parseBody(req, Body);
  const ip = clientIp(req);
  await rateLimit(`otp:req:${ip}`, 5, 60_000);
  await rateLimit(`otp:req:${phone}`, 3, 10 * 60_000);

  const blocked = await prisma.user.findFirst({ where: { phone, status: "BLOCKED" } });
  if (blocked) throw err.forbidden();

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.otpCode.create({
    data: { phone, codeHash: sha(code), expiresAt: new Date(Date.now() + 5 * 60_000) },
  });
  const { devCode } = await smsProvider().sendOtp(phone, code);

  const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  return ok({ sent: true, newUser: !existing, ...(devCode ? { devCode } : {}) });
});
