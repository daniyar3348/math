// Сдача задания: текст и/или файл; повторная сдача — если разрешена.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";

const Body = z.object({
  text: z.string().max(20000).default(""),
  fileAssetId: z.string().optional(),
});

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();
  await rateLimit(`assignment:submit:${a.userId}`, 30, 60_000);
  const body = await parseBody(req, Body);

  const asg = await prisma.assignment.findFirst({
    where: { id, deletedAt: null, status: "PUBLISHED" },
    include: { course: { include: { teachers: true } } },
  });
  if (!asg) throw err.notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: a.userId, courseId: asg.courseId } },
  });
  if (!enrollment) throw err.forbidden();

  if (!asg.allowText && body.text) throw err.badRequest("text_not_allowed");
  if (!asg.allowFile && body.fileAssetId) throw err.badRequest("file_not_allowed");
  if (!body.text && !body.fileAssetId) throw err.badRequest("empty_submission");

  if (body.fileAssetId) {
    const file = await prisma.fileAsset.findFirst({ where: { id: body.fileAssetId, ownerId: a.userId } });
    if (!file) throw err.forbidden(); // файл должен принадлежать отправителю
  }

  const prev = await prisma.assignmentSubmission.findFirst({
    where: { assignmentId: asg.id, studentId: a.userId },
    orderBy: { attemptNo: "desc" },
  });
  if (prev && !asg.allowResubmit) throw err.conflict("resubmit_not_allowed");

  const submission = await prisma.assignmentSubmission.create({
    data: {
      assignmentId: asg.id,
      studentId: a.userId,
      attemptNo: (prev?.attemptNo ?? 0) + 1,
      text: body.text,
      fileAssetId: body.fileAssetId ?? null,
    },
  });

  // уведомление преподавателям курса
  const teacherIds = asg.course.teachers.map((t) => t.userId);
  await Promise.all(
    teacherIds.map((tid) => notify(tid, "submission_received", { assignmentId: asg.id, submissionId: submission.id }))
  );

  return ok({ submissionId: submission.id, attemptNo: submission.attemptNo });
});
