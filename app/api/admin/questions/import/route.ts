// Импорт вопросов из CSV с проверкой и отчётом по невалидным строкам (§8).
import { z } from "zod";
import { handler, ok, parseBody, clientIp, err } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { importQuestionsCsv } from "@/lib/admin-actions";
import { audit } from "@/lib/audit";

const Body = z.object({ csv: z.string().min(1) });

export const POST = handler(async (req: Request) => {
  const a = await requirePermission("questions.manage");
  const { csv } = await parseBody(req, Body);
  if (csv.length > 2_000_000) throw err.badRequest("file_too_large");
  const result = await importQuestionsCsv(a.orgId, a.userId, csv);
  await audit({
    actorId: a.userId,
    action: "question.import",
    entityType: "Question",
    after: { imported: result.imported, errorCount: result.errors.length },
    ip: clientIp(req),
  });
  return ok(result);
});
