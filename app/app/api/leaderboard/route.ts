import { NextRequest, NextResponse } from "next/server";
import { db, type Row } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  const rows = db()
    .prepare(
      "SELECT id, name, region, xp FROM users WHERE role = 'student' ORDER BY xp DESC, name LIMIT 50"
    )
    .all() as Row[];

  let list = rows.map((r) => ({
    name: r.name,
    region: r.region,
    xp: r.xp,
    me: !!user && r.id === user.id,
  }));

  // If the requesting student is outside the top-50, append their row.
  if (user && user.role === "student" && !list.some((r) => r.me)) {
    list = [...list, { name: user.name, region: user.region, xp: user.xp, me: true }];
  }

  return NextResponse.json({ leaderboard: list });
}
