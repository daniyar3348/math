// Создание сотрудника/родителя/ученика администратором.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/passwords";
import { roleId } from "@/lib/org";
import { audit } from "@/lib/audit";

const Body = z.object({
  email: z.string().email().max(120).optional(),
  phone: z.string().regex(/^\+7\d{10}$/).optional(),
  password: z.string().min(8).max(128).optional(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().max(60).default(""),
  roles: z.array(z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"])).min(1),
});

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("users.manage");
  const body = await parseBody(req, Body);
  if (!body.email && !body.phone) throw err.badRequest("email_or_phone_required");
  if (body.email && !body.password) throw err.badRequest("password_required");
  if (body.roles.includes("ADMIN") && !a.roles.includes("SUPER_ADMIN")) throw err.forbidden(); // админов создаёт только super admin

  const exists = await prisma.user.findFirst({
    where: { OR: [...(body.email ? [{ email: body.email.toLowerCase() }] : []), ...(body.phone ? [{ phone: body.phone }] : [])] },
  });
  if (exists) throw err.conflict("user_exists");

  const user = await prisma.user.create({
    data: {
      email: body.email?.toLowerCase(),
      phone: body.phone,
      passwordHash: body.password ? await hashPassword(body.password) : null,
      profile: { create: { firstName: body.firstName, lastName: body.lastName } },
    },
  });
  for (const r of body.roles) {
    await prisma.membership.create({ data: { userId: user.id, organizationId: a.orgId, roleId: await roleId(r) } });
  }
  await audit({ actorId: a.userId, action: "user.create", entityType: "User", entityId: user.id, after: { roles: body.roles }, ip: clientIp(req) });
  return ok({ row: { id: user.id } });
});
