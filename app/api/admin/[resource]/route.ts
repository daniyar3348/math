// Generic CRUD админки: список (пагинация/поиск/сортировка) + создание.
// Только whitelisted-ресурсы и поля (lib/admin-resources.ts); всё в AuditLog.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, err, parseQuery, parseBody, pageArgs, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { RESOURCES } from "@/lib/admin-resources";
import { audit } from "@/lib/audit";

const ListQuery = z.object({
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(40).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelOf = (name: string) => (prisma as any)[name];

export const GET = handler(async (req: Request, ctx: { params: Promise<{ resource: string }> }) => {
  const { resource } = await ctx.params;
  const cfg = RESOURCES[resource];
  if (!cfg) throw err.notFound();
  await requirePermission(cfg.perm);
  const query = parseQuery(req, ListQuery);

  const where: Record<string, unknown> = {};
  if (query.q && cfg.searchFields?.length) {
    where.OR = cfg.searchFields.map((f) => ({ [f]: { contains: query.q, mode: "insensitive" } }));
  }
  // точечные фильтры ?f_<field>=<value> (только простые скалярные поля)
  const url = new URL(req.url);
  url.searchParams.forEach((v, k) => {
    if (k.startsWith("f_") && v && /^[a-zA-Z]+$/.test(k.slice(2))) where[k.slice(2)] = v;
  });

  const orderBy = query.sort ? { [query.sort]: query.dir ?? "asc" } : cfg.orderBy ?? { id: "desc" };
  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);

  const [total, rows] = await Promise.all([
    modelOf(cfg.model).count({ where }),
    modelOf(cfg.model).findMany({ where, orderBy, skip, take, include: cfg.include }),
  ]);
  return ok({ rows, total, page, pageSize });
});

export const POST = handler(async (req: Request, ctx: { params: Promise<{ resource: string }> }) => {
  const { resource } = await ctx.params;
  const cfg = RESOURCES[resource];
  if (!cfg || cfg.readonly || !cfg.schema) throw err.notFound();
  const a = await requirePermission(cfg.writePerm ?? cfg.perm);
  const data = await parseBody(req, cfg.schema as z.ZodTypeAny);

  // multi-tenant: проставляем организацию, если модель её требует
  const needsOrg = ["cohort", "subject", "gradeLevel", "topic"].includes(cfg.model);
  const created = await modelOf(cfg.model).create({
    data: { ...(data as object), ...(needsOrg ? { organizationId: a.orgId } : {}) },
  });
  await audit({ actorId: a.userId, action: `${resource}.create`, entityType: cfg.model, entityId: created.id, after: data, ip: clientIp(req) });
  return ok({ row: created });
});
