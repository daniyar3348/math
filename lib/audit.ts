// AuditLog: публикации, удаления, смены ролей, баллы, результаты (§12/§16).
// Персональные данные и секреты в лог не пишутся (маскирование на вызывающей стороне).
import { prisma } from "./db";

export async function audit(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  const scrub = (v: unknown) => {
    if (!v || typeof v !== "object") return v ?? undefined;
    const clone = JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
    for (const k of Object.keys(clone)) {
      if (/password|secret|token|otp|code/i.test(k)) clone[k] = "[masked]";
    }
    return clone;
  };
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? "",
      before: scrub(params.before) as object | undefined,
      after: scrub(params.after) as object | undefined,
      ip: params.ip ?? "",
    },
  });
}
