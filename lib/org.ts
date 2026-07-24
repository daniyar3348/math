// Организация по умолчанию и id ролей (кэш на процесс).
import { prisma } from "./db";
import type { RoleKey } from "./rbac";

let orgCache: string | null = null;
const roleCache = new Map<string, string>();

export async function defaultOrgId(): Promise<string> {
  if (orgCache) return orgCache;
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("Не найдена организация — выполните pnpm db:seed");
  orgCache = org.id;
  return org.id;
}

export async function roleId(name: RoleKey): Promise<string> {
  const hit = roleCache.get(name);
  if (hit) return hit;
  const role = await prisma.role.findUnique({ where: { name } });
  if (!role) throw new Error(`Роль ${name} не найдена — выполните pnpm db:seed`);
  roleCache.set(name, role.id);
  return role.id;
}
