import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, clientIp, err } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { createSession } from "@/lib/auth/session";
import { defaultOrgId, roleId } from "@/lib/org";

const Body = z.object({
  phone: z.string().regex(/^\+7\d{10}$/),
  code: z.string().regex(/^\d{6}$/),
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().max(60).optional(),
});

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const POST = handler(async (req: Request) => {
  const { phone, code, firstName, lastName } = await parseBody(req, Body);
  const ip = clientIp(req);
  await rateLimit(`otp:verify:${ip}`, 10, 60_000);

  const otp = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= 5) {
    await prisma.loginEvent.create({ data: { identifier: phone, ip, success: false, reason: "otp_missing" } });
    throw err.badRequest("otp_invalid");
  }
  if (otp.codeHash !== sha(code)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    await prisma.loginEvent.create({ data: { identifier: phone, ip, success: false, reason: "otp_wrong" } });
    throw err.badRequest("otp_invalid");
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    if (!firstName) throw err.badRequest("name_required");
    const orgId = await defaultOrgId();
    user = await prisma.user.create({
      data: {
        phone,
        profile: { create: { firstName, lastName: lastName ?? "" } },
        memberships: { create: { organizationId: orgId, roleId: await roleId("STUDENT") } },
      },
    });
  }
  if (user.status === "BLOCKED") throw err.forbidden();

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.loginEvent.create({ data: { userId: user.id, identifier: phone, ip, success: true } });
  await createSession(user.id, ip, req.headers.get("user-agent") ?? "");
  return ok({ ok: true, role: "STUDENT" });
});
