import { NextRequest, NextResponse } from "next/server";
import { db, type Row } from "@/lib/db";
import { getAuthUser, badRequest, notFound, unauthorized } from "@/lib/auth";

// Confirms a pending payment and grants the enrollment.
// PRODUCTION NOTE: this is the sandbox stand-in for the Kaspi Pay webhook —
// there, Kaspi calls a signed /api/kaspi/webhook and THAT creates the
// enrollment. The client never confirms its own payment.
export async function POST(req: NextRequest) {
  // SAFETY: в боевом режиме клиентское подтверждение ЗАПРЕЩЕНО — доступ
  // выдаёт только вебхук Kaspi. Установи PAYMENTS_MODE=live в .env, как
  // только появится реальная интеграция, и этот эндпоинт отключится.
  if (process.env.PAYMENTS_MODE === "live") {
    return NextResponse.json({ error: "live_mode_webhook_only" }, { status: 403 });
  }

  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const paymentId = body?.paymentId as string | undefined;
  if (!paymentId) return badRequest("fill_all");

  const payment = db()
    .prepare("SELECT * FROM payments WHERE id = ? AND user_id = ?")
    .get(paymentId, user.id) as Row | undefined;
  if (!payment) return notFound();
  if (payment.status !== "pending") return badRequest("not_pending");

  const now = Date.now();
  db()
    .prepare("UPDATE payments SET status = 'paid', paid_at = ?, provider_txn_id = ? WHERE id = ?")
    .run(now, `sandbox-${paymentId.slice(0, 8)}`, paymentId);
  db()
    .prepare(
      `INSERT OR IGNORE INTO enrollments (user_id, course_id, source, granted_at)
       VALUES (?,?, 'purchase', ?)`
    )
    .run(user.id, payment.course_id, now);

  return NextResponse.json({ ok: true, courseId: payment.course_id });
}
