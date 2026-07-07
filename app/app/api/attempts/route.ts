import { NextRequest, NextResponse } from "next/server";
import { db, type Row } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const rows = db()
    .prepare(
      `SELECT a.id, a.challenge_id, a.score_pct, a.xp_earned, a.finished_at,
              ch.title_kk, ch.title_ru
       FROM attempts a JOIN challenges ch ON ch.id = a.challenge_id
       WHERE a.user_id = ? ORDER BY a.finished_at DESC LIMIT 20`
    )
    .all(user.id) as Row[];

  return NextResponse.json({
    attempts: rows.map((r) => ({
      id: r.id,
      challengeId: r.challenge_id,
      challengeTitle: { kk: r.title_kk, ru: r.title_ru },
      scorePct: r.score_pct,
      xpEarned: r.xp_earned,
      finishedAt: new Date(r.finished_at).toISOString(),
    })),
  });
}
