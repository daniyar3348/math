import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const a = await requireAuth();
  const asg = await prisma.assignment.findFirst({
    where: { id, deletedAt: null, status: "PUBLISHED" },
    include: { course: true },
  });
  if (!asg) throw err.notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: a.userId, courseId: asg.courseId } },
  });
  if (!enrollment) throw err.forbidden();

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId: asg.id, studentId: a.userId },
    orderBy: { attemptNo: "desc" },
  });

  return ok({
    assignment: {
      id: asg.id,
      titleKk: asg.titleKk,
      titleRu: asg.titleRu,
      descriptionKk: asg.descriptionKk,
      descriptionRu: asg.descriptionRu,
      dueAt: asg.dueAt,
      maxScore: asg.maxScore,
      allowResubmit: asg.allowResubmit,
      allowText: asg.allowText,
      allowFile: asg.allowFile,
      courseSlug: asg.course.slug,
    },
    submissions: submissions.map((s) => ({
      id: s.id,
      attemptNo: s.attemptNo,
      status: s.status,
      score: s.score,
      feedback: s.feedback,
      submittedAt: s.submittedAt,
      text: s.text,
      fileAssetId: s.fileAssetId,
    })),
  });
});
