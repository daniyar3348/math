import { NextRequest, NextResponse } from "next/server";
import { db, toCourse, toChallengeMeta, l10n, hasAccess, type Row } from "@/lib/db";
import { getAuthUser, notFound } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const course = db().prepare("SELECT * FROM courses WHERE id = ? AND published = 1").get(id) as
    | Row
    | undefined;
  if (!course) return notFound();

  const user = getAuthUser(req);
  const unlocked = hasAccess(user, { id: course.id, price_kzt: course.price_kzt });

  const lessons = (db()
    .prepare("SELECT * FROM lessons WHERE course_id = ? ORDER BY sort")
    .all(id) as Row[]).map((l) => ({
    id: l.id,
    title: l10n(l, "title"),
    // Lesson bodies are gated server-side for paid, not-purchased courses.
    body: unlocked ? l10n(l, "body") : null,
    sort: l.sort,
  }));

  const challenges = (db()
    .prepare("SELECT * FROM challenges WHERE course_id = ? ORDER BY sort")
    .all(id) as Row[]).map((ch) => {
    const { n } = db()
      .prepare("SELECT COUNT(*) AS n FROM questions WHERE challenge_id = ?")
      .get(ch.id) as { n: number };
    return toChallengeMeta(ch, !unlocked, n);
  });

  return NextResponse.json({
    course: toCourse(course),
    lessons,
    challenges,
    unlocked,
  });
}
