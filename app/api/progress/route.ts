import { NextRequest, NextResponse } from "next/server";
import { db, ready } from "@/lib/db";
import { getDevice, attachDevice } from "@/lib/device";

const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  await ready();
  const { id, isNew } = getDevice(req);
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTs = startOfToday.getTime();

  const [total, learned, due, fresh, todayCount, days] = await Promise.all([
    db().execute("SELECT COUNT(*) AS n FROM cards"),
    db().execute({ sql: "SELECT COUNT(*) AS n FROM reviews WHERE device_id = ? AND reps >= 1", args: [id] }),
    db().execute({ sql: "SELECT COUNT(*) AS n FROM reviews WHERE device_id = ? AND due_at <= ?", args: [id, now] }),
    db().execute({
      sql: `SELECT COUNT(*) AS n FROM cards c
            LEFT JOIN reviews rv ON rv.card_id = c.id AND rv.device_id = ?
            WHERE rv.card_id IS NULL`,
      args: [id],
    }),
    db().execute({ sql: "SELECT COUNT(*) AS n FROM review_log WHERE device_id = ? AND ts >= ?", args: [id, todayTs] }),
    db().execute({ sql: "SELECT DISTINCT ts FROM review_log WHERE device_id = ? ORDER BY ts DESC", args: [id] }),
  ]);

  // Streak: consecutive calendar days with >=1 review, ending today or yesterday.
  const daySet = new Set<number>();
  for (const row of days.rows) {
    const d = new Date(Number(row.ts));
    d.setHours(0, 0, 0, 0);
    daySet.add(d.getTime());
  }
  let streak = 0;
  let cursor = todayTs;
  if (!daySet.has(todayTs) && daySet.has(todayTs - DAY)) cursor = todayTs - DAY;
  while (daySet.has(cursor)) {
    streak += 1;
    cursor -= DAY;
  }

  const stats = {
    totalCards: Number(total.rows[0].n),
    learnedCards: Number(learned.rows[0].n),
    dueNow: Number(due.rows[0].n) + Number(fresh.rows[0].n),
    reviewsToday: Number(todayCount.rows[0].n),
    streak,
  };

  return attachDevice(NextResponse.json({ stats }), id, isNew);
}
