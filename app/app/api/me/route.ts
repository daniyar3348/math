import { NextRequest, NextResponse } from "next/server";
import { db, type Row } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ user: null });

  const enrolled = db()
    .prepare("SELECT course_id FROM enrollments WHERE user_id = ?")
    .all(user.id) as Row[];

  const best = db()
    .prepare(
      "SELECT challenge_id, MAX(score_pct) AS best FROM attempts WHERE user_id = ? GROUP BY challenge_id"
    )
    .all(user.id) as Row[];

  const bestScores: Record<string, number> = {};
  for (const b of best) bestScores[b.challenge_id] = b.best;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      region: user.region,
      grade: user.grade,
      role: user.role,
      xp: user.xp,
      totpEnabled: !!user.totp_enabled,
    },
    enrolledCourseIds: enrolled.map((e) => e.course_id),
    bestScores,
  });
}
