// Настройки платформы: бренд, цвета, контакты, блоки лендинга (§12/§15).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { invalidateSettingsCache } from "@/lib/settings";
import { audit } from "@/lib/audit";

const Body = z.object({
  brandName: z.string().min(1).max(60),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  contacts: z.object({
    phone: z.string().max(30).optional(),
    email: z.string().max(120).optional(),
    address: z.object({ kk: z.string().max(200).optional(), ru: z.string().max(200).optional() }).optional(),
  }),
  landing: z.record(z.string(), z.unknown()).default({}),
});

export const GET = handler(async () => {
  await requirePermission("landing.manage");
  const row = await prisma.siteSettings.findFirst();
  return ok({ row });
});

export const PUT = handler(async (req: Request) => {
  const a = await requirePermission("landing.manage");
  const data = await parseBody(req, Body);
  const existing = await prisma.siteSettings.findFirst();
  const row = existing
    ? await prisma.siteSettings.update({ where: { id: existing.id }, data: data as object })
    : await prisma.siteSettings.create({ data: { organizationId: a.orgId, ...(data as object) } });
  invalidateSettingsCache();
  await audit({ actorId: a.userId, action: "settings.update", entityType: "SiteSettings", entityId: row.id, after: data, ip: clientIp(req) });
  return ok({ row });
});
