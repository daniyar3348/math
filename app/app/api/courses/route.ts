import { NextResponse } from "next/server";
import { db, toCourse, type Row } from "@/lib/db";

export async function GET() {
  const rows = db()
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons_count,
        (SELECT COUNT(*) FROM challenges ch WHERE ch.course_id = c.id) AS challenges_count
       FROM courses c WHERE c.published = 1 ORDER BY c.sort`
    )
    .all() as Row[];

  return NextResponse.json({
    courses: rows.map((r) => ({
      ...toCourse(r),
      lessonsCount: r.lessons_count,
      challengesCount: r.challenges_count,
    })),
  });
}
