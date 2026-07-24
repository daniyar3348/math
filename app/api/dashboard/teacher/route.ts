// Кабинет преподавателя (§11): курсы, группы, очереди на проверку, успеваемость.
import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/http";
import { requireStaff } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/rbac";

export const GET = handler(async () => {
  const a = await requireStaff();

  const courseFilter = isAdmin(a.roles) ? {} : { teachers: { some: { userId: a.userId } } };
  const courses = await prisma.course.findMany({
    where: { deletedAt: null, ...courseFilter },
    include: { translations: true, _count: { select: { enrollments: true } } },
  });
  const courseIds = courses.map((c) => c.id);

  const [pendingSubs, pendingReviews, cohorts, recentGrades] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: { status: "SUBMITTED", assignment: { courseId: { in: courseIds } } },
      take: 10,
      orderBy: { submittedAt: "asc" },
      include: {
        assignment: true,
        student: { include: { profile: true } },
      },
    }),
    prisma.manualReview.count({ where: { status: "PENDING" } }),
    prisma.cohort.findMany({
      where: { archivedAt: null, ...(isAdmin(a.roles) ? {} : { teacherUserId: a.userId }) },
      include: { _count: { select: { members: true } } },
    }),
    prisma.gradeItem.findMany({
      where: { courseId: { in: courseIds } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return ok({
    courses: courses.map((c) => ({
      slug: c.slug,
      translations: c.translations,
      students: c._count.enrollments,
      status: c.status,
    })),
    toGrade: pendingSubs.map((s) => ({
      submissionId: s.id,
      assignment: { titleKk: s.assignment.titleKk, titleRu: s.assignment.titleRu },
      student: `${s.student.profile?.firstName ?? ""} ${s.student.profile?.lastName ?? ""}`.trim(),
      submittedAt: s.submittedAt,
    })),
    pendingManualReviews: pendingReviews,
    cohorts: cohorts.map((c) => ({ id: c.id, name: c.name, members: c._count.members })),
    recentGrades,
  });
});
