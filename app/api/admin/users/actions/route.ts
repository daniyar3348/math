// Действия над пользователями: роли, блокировка, сброс пароля, связи.
import { z } from "zod";
import { handler, ok, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { adminUserAction } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

const Body = z.object({
  targetId: z.string().min(1),
  action: z.enum(["set_roles", "block", "unblock", "reset_password", "link_parent", "add_to_cohort"]),
  roles: z.array(z.enum(["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT", "PARENT"])).optional(),
  password: z.string().max(128).optional(),
  parentUserId: z.string().optional(),
  cohortId: z.string().optional(),
});

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("users.manage");
  const body = await parseBody(req, Body);
  await adminUserAction({ actorId: a.userId, orgId: a.orgId, ...body });
  await audit({
    actorId: a.userId,
    action: `user.${body.action}`,
    entityType: "User",
    entityId: body.targetId,
    after: { roles: body.roles },
    ip: clientIp(req),
  });
  return ok({ ok: true });
});
