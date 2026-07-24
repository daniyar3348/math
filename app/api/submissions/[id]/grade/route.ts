// Проверка задания преподавателем (scope: только назначенные курсы) или админом.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody, clientIp } from "@/lib/http";
import { requirePermission, assertCourseScope } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const Body = z.object({
  score: z.number().min(0),
  feedback: z.string().max(5000).default(""),
  status: z.enum(["GRADED", "RETURNED"]).default("GRADED"),
});

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requirePermission("submissions.review");
  const body = await parseBody(req, Body);

  const sub = await prisma.assignmentSubmission.findUnique({
    where: { id },
    include: { assignment: true },
  });
  if (!sub) throw err.notFound();
  await assertCourseScope(a, sub.assignment.courseId);

  const score = Math.min(body.score, sub.assignment.maxScore);
  await prisma.$transaction([
    prisma.assignmentSubmission.update({
      where: { id: sub.id },
      data: { score, feedback: body.feedback, status: body.status, gradedById: a.userId, gradedAt: new Date() },
    }),
    prisma.gradeItem.create({
      data: {
        courseId: sub.assignment.courseId,
        studentId: sub.studentId,
        kind: "ASSIGNMENT",
        refId: sub.id,
        title: sub.assignment.titleRu || sub.assignment.titleKk,
        score,
        maxScore: sub.assignment.maxScore,
      },
    }),
  ]);

  await audit({
    actorId: a.userId,
    action: "submission.grade",
    entityType: "AssignmentSubmission",
    entityId: sub.id,
    after: { score, status: body.status },
    ip: clientIp(req),
  });
  await notify(sub.studentId, "assignment_graded", {
    assignmentId: sub.assignmentId,
    submissionId: sub.id,
    score,
    maxScore: sub.assignment.maxScore,
  });
  return ok({ ok: true });
});
