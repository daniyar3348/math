import { NextRequest, NextResponse } from "next/server";
import { db, toChallengeMeta, l10n, hasAccess, type Row } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  const rows = db()
    .prepare(
      `SELECT ch.*, c.title_kk AS c_title_kk, c.title_ru AS c_title_ru,
              c.school AS c_school, c.price_kzt AS c_price
       FROM challenges ch JOIN courses c ON c.id = ch.course_id
       WHERE c.published = 1
       ORDER BY ch.sort`
    )
    .all() as Row[];

  const challenges = rows.map((r) => {
    const { n } = db()
      .prepare("SELECT COUNT(*) AS n FROM questions WHERE challenge_id = ?")
      .get(r.id) as { n: number };
    const unlocked = hasAccess(user, { id: r.course_id, price_kzt: r.c_price });
    return {
      ...toChallengeMeta(r, !unlocked, n),
      courseTitle: { kk: r.c_title_kk, ru: r.c_title_ru },
      school: r.c_school,
      coursePriceKzt: r.c_price,
    };
  });

  return NextResponse.json({ challenges });
}
