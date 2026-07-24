import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { RESOURCES } from "@/lib/admin-resources";
import { audit } from "@/lib/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelOf = (name: string) => (prisma as any)[name];

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) => {
  const { resource, id } = await ctx.params;
  const cfg = RESOURCES[resource];
  if (!cfg) throw err.notFound();
  await requirePermission(cfg.perm);
  const row = await modelOf(cfg.model).findUnique({ where: { id }, include: cfg.include });
  if (!row) throw err.notFound();
  return ok({ row });
});

export const PUT = handler(async (req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) => {
  const { resource, id } = await ctx.params;
  const cfg = RESOURCES[resource];
  if (!cfg || cfg.readonly || !cfg.schema) throw err.notFound();
  const a = await requirePermission(cfg.writePerm ?? cfg.perm);
  const schema = (cfg.schema as z.ZodObject<z.ZodRawShape>).partial();
  const data = await parseBody(req, schema);
  const before = await modelOf(cfg.model).findUnique({ where: { id } });
  if (!before) throw err.notFound();
  const row = await modelOf(cfg.model).update({ where: { id }, data });
  await audit({ actorId: a.userId, action: `${resource}.update`, entityType: cfg.model, entityId: id, before, after: data, ip: clientIp(req) });
  return ok({ row });
});

export const DELETE = handler(async (req: Request, ctx: { params: Promise<{ resource: string; id: string }> }) => {
  const { resource, id } = await ctx.params;
  const cfg = RESOURCES[resource];
  if (!cfg || cfg.readonly) throw err.notFound();
  const a = await requirePermission(cfg.writePerm ?? cfg.perm);
  const before = await modelOf(cfg.model).findUnique({ where: { id } });
  if (!before) throw err.notFound();
  if (cfg.softDelete) {
    await modelOf(cfg.model).update({ where: { id }, data: { deletedAt: new Date() } });
  } else {
    await modelOf(cfg.model).delete({ where: { id } });
  }
  await audit({ actorId: a.userId, action: `${resource}.delete`, entityType: cfg.model, entityId: id, before, ip: clientIp(req) });
  return ok({ ok: true });
});
