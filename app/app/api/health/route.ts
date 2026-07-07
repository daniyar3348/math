import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const d = db(); // touching the DB is the health check itself
  const user = getAuthUser(req);

  // Публично — только ok (без утечки количества пользователей/оплат).
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: true });
  }

  const count = (table: string) =>
    (d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return NextResponse.json({
    ok: true,
    db: "sqlite",
    counts: {
      users: count("users"),
      courses: count("courses"),
      lessons: count("lessons"),
      challenges: count("challenges"),
      questions: count("questions"),
      options: count("options"),
      attempts: count("attempts"),
      payments: count("payments"),
      enrollments: count("enrollments"),
    },
  });
}
