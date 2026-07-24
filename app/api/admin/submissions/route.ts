// Очередь заданий на проверку (для страницы «Проверка работ»).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, pageArgs } from "@/lib/http";
import { requirePermission } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/rbac";

const Query = z.object({
  status: z.enum(["SUBMITTED", "GRADED", "RETURNED", "all"]).default("SUBMITTED"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = handler(async (req: Request) => {
  const a = await requirePermission("submissions.review");
  const query = parseQuery(req, Query);
  const scope = isAdmin(a.roles) ? {} : { assignment: { course: { teachers: { some: { userId: a.userId } } } } };
  const where = { ...(query.status === "all" ? {} : { status: query.status }), ...scope };
  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);
  const [total, rows] = await Promise.all([
    prisma.assignmentSubmission.count({ where }),
    prisma.assignmentSubmission.findMany({
      where,
      orderBy: { submittedAt: "asc" },
      skip,
      take,
      include: {
        assignment: { include: { course: { include: { translations: true } } } },
        student: { include: { profile: true } },
      },
    }),
  ]);
  return ok({ rows, total, page, pageSize });
});
