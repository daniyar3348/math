// Журнал оценок курса (преподаватель своего курса / админ). ?format=csv — экспорт.
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { requirePermission, assertCourseScope } from "@/lib/auth/guard";

export const GET = handler(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const a = await requirePermission("grades.read.own");
  const course = await prisma.course.findFirst({ where: { slug, deletedAt: null } });
  if (!course) throw err.notFound();
  await assertCourseScope(a, course.id);

  const [enrollments, items] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: course.id },
      include: { user: { include: { profile: true } } },
    }),
    prisma.gradeItem.findMany({ where: { courseId: course.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const rows = enrollments.map((en) => {
    const mine = items.filter((g) => g.studentId === en.userId);
    const score = mine.reduce((s, g) => s + g.score, 0);
    const max = mine.reduce((s, g) => s + g.maxScore, 0);
    return {
      studentId: en.userId,
      student: `${en.user.profile?.firstName ?? ""} ${en.user.profile?.lastName ?? ""}`.trim(),
      progressPct: en.progressPct,
      items: mine.map((g) => ({ title: g.title, score: g.score, maxScore: g.maxScore, at: g.createdAt })),
      totalScore: score,
      totalMax: max,
    };
  });

  const url = new URL(req.url);
  if (url.searchParams.get("format") === "csv") {
    const esc = (s: string | number) => {
      const v = String(s);
      return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const header = "student;progress_pct;total_score;total_max";
    const lines = rows.map((r) => [r.student, r.progressPct, r.totalScore, r.totalMax].map(esc).join(";"));
    return new Response("﻿" + [header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gradebook-${course.slug}.csv"`,
      },
    });
  }
  return ok({ rows });
});
