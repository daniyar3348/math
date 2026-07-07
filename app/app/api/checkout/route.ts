import { NextRequest, NextResponse } from "next/server";
import { db, newId, type Row } from "@/lib/db";
import { getAuthUser, badRequest, notFound, unauthorized } from "@/lib/auth";

// Creates a pending payment for a course. Amount is taken from the DB —
// never from the client. In production this would also call Kaspi Pay's
// create-payment API and return their redirect URL.
export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const courseId = body?.courseId as string | undefined;
  if (!courseId) return badRequest("fill_all");

  const course = db()
    .prepare("SELECT id, price_kzt FROM courses WHERE id = ? AND published = 1")
    .get(courseId) as Row | undefined;
  if (!course) return notFound();
  if (course.price_kzt <= 0) return badRequest("course_is_free");

  const already = db()
    .prepare("SELECT 1 AS x FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(user.id, courseId);
  if (already) return NextResponse.json({ alreadyOwned: true });

  const id = newId();
  db()
    .prepare(
      `INSERT INTO payments (id, user_id, course_id, amount_kzt, status, provider, created_at)
       VALUES (?,?,?,?, 'pending', 'kaspi', ?)`
    )
    .run(id, user.id, courseId, course.price_kzt, Date.now());

  return NextResponse.json({ paymentId: id, amountKzt: course.price_kzt });
}
