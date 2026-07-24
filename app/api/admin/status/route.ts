// Workflow: черновик → на проверке → опубликовано → архив (§12).
// Публикация блокируется без переводов на обоих языках (i18n-гейт §5).
import { z } from "zod";
import { handler, ok, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { setContentStatus } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";
import type { PermissionKey } from "@/lib/rbac";

const Body = z.object({
  entity: z.enum(["question", "test", "challenge", "course", "lesson"]),
  id: z.string().min(1),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]),
});

const PUBLISH_PERM: Record<string, PermissionKey> = {
  question: "questions.publish",
  test: "tests.publish",
  challenge: "challenges.publish",
  course: "courses.publish",
  lesson: "courses.publish",
};

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, Body);
  // публикация/архив — только с правом publish; черновик/review — manage
  const perm: PermissionKey =
    body.status === "PUBLISHED" || body.status === "ARCHIVED"
      ? PUBLISH_PERM[body.entity]
      : body.entity === "question"
      ? "questions.manage"
      : body.entity === "test"
      ? "tests.manage"
      : body.entity === "challenge"
      ? "challenges.manage"
      : "courses.manage";
  const a = await requirePermission(perm);
  await setContentStatus(body);
  await audit({
    actorId: a.userId,
    action: `${body.entity}.status.${body.status.toLowerCase()}`,
    entityType: body.entity,
    entityId: body.id,
    after: { status: body.status },
    ip: clientIp(req),
  });
  return ok({ ok: true });
});
