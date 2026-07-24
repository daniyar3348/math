// Экспорт банка вопросов в CSV (§8).
import { prisma } from "@/lib/db";
import { handler } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { questionsToCsv } from "@/lib/admin-actions";

export const GET = handler(async () => {
  const a = await requirePermission("questions.manage");
  const rows = await prisma.question.findMany({
    where: { organizationId: a.orgId, deletedAt: null },
    include: { subject: true, topic: true, gradeLevel: true, translations: true, choices: { orderBy: { sort: "asc" } }, tags: true },
    orderBy: { createdAt: "asc" },
  });
  return new Response(questionsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="questions.csv"',
    },
  });
});
