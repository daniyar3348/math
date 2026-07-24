// Авторизация запросов: getAuth() → { user, roles, orgId }.
// require*() бросают ApiError (401/403) — единая серверная проверка (§3, §16).

import { cache } from "react";
import { prisma } from "@/lib/db";
import { err } from "@/lib/http";
import { roleCan, isAdmin, isStaff, type PermissionKey, type RoleKey } from "@/lib/rbac";
import { resolveSessionUserId } from "./session";

export interface Auth {
  userId: string;
  roles: RoleKey[];
  orgId: string;
  profile: { firstName: string; lastName: string; locale: "kk" | "ru" } | null;
  email: string | null;
  phone: string | null;
}

/** Кэш на время одного запроса (RSC + handlers). */
export const getAuth = cache(async (): Promise<Auth | null> => {
  const userId = await resolveSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: "ACTIVE" },
    include: {
      profile: true,
      memberships: { include: { role: true } },
    },
  });
  if (!user || user.memberships.length === 0) return null;
  return {
    userId: user.id,
    roles: user.memberships.map((m) => m.role.name as RoleKey),
    orgId: user.memberships[0].organizationId,
    profile: user.profile
      ? { firstName: user.profile.firstName, lastName: user.profile.lastName, locale: user.profile.locale }
      : null,
    email: user.email,
    phone: user.phone,
  };
});

export async function requireAuth(): Promise<Auth> {
  const a = await getAuth();
  if (!a) throw err.unauthorized();
  return a;
}

export async function requirePermission(perm: PermissionKey): Promise<Auth> {
  const a = await requireAuth();
  if (!roleCan(a.roles, perm)) throw err.forbidden();
  return a;
}

export async function requireAdmin(): Promise<Auth> {
  const a = await requireAuth();
  if (!isAdmin(a.roles)) throw err.forbidden();
  return a;
}

export async function requireStaff(): Promise<Auth> {
  const a = await requireAuth();
  if (!isStaff(a.roles)) throw err.forbidden();
  return a;
}

// ——— Scope-проверки (анти-IDOR) ———

/** Преподаватель имеет доступ только к назначенным курсам; админ — ко всем. */
export async function assertCourseScope(a: Auth, courseId: string): Promise<void> {
  if (isAdmin(a.roles)) return;
  const link = await prisma.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId: a.userId } },
  });
  if (!link) throw err.forbidden();
}

/** Родитель видит только привязанных детей. */
export async function assertParentScope(a: Auth, studentUserId: string): Promise<void> {
  if (isAdmin(a.roles)) return;
  const link = await prisma.studentParent.findUnique({
    where: { studentUserId_parentUserId: { studentUserId, parentUserId: a.userId } },
  });
  if (!link) throw err.forbidden();
}

export { roleCan, isAdmin, isStaff };
