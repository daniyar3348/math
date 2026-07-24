// Уроки: создание с переводами (kk/ru).
import { handler, ok, parseBody, clientIp } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { LessonInput, saveLesson } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("courses.manage");
  const data = await parseBody(req, LessonInput);
  // teacher может создавать черновики только в своих курсах — scope проверяется внутри
  const row = await saveLesson(a, data);
  await audit({ actorId: a.userId, action: "lesson.create", entityType: "Lesson", entityId: row.id, ip: clientIp(req) });
  return ok({ row });
});
