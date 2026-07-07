import { NextRequest, NextResponse } from "next/server";
import { db, toChallengeMeta, l10n, hasAccess, type Row } from "@/lib/db";
import { getAuthUser, notFound } from "@/lib/auth";

// Returns the challenge with its questions and options — WITHOUT correct
// answers. Scoring happens server-side (answer/submit endpoints).
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ch = db()
    .prepare(
      `SELECT ch.*, c.price_kzt AS c_price, c.title_kk AS c_title_kk, c.title_ru AS c_title_ru
       FROM challenges ch JOIN courses c ON c.id = ch.course_id WHERE ch.id = ?`
    )
    .get(id) as Row | undefined;
  if (!ch) return notFound();

  const user = getAuthUser(req);
  const unlocked = hasAccess(user, { id: ch.course_id, price_kzt: ch.c_price });

  const qRows = db()
    .prepare("SELECT * FROM questions WHERE challenge_id = ? ORDER BY sort")
    .all(id) as Row[];

  const meta = {
    ...toChallengeMeta(ch, !unlocked, qRows.length),
    courseTitle: { kk: ch.c_title_kk, ru: ch.c_title_ru },
    coursePriceKzt: ch.c_price,
  };

  if (!unlocked) {
    return NextResponse.json({ challenge: meta, questions: null });
  }

  const questions = qRows.map((q) => ({
    id: q.id,
    prompt: l10n(q, "prompt"),
    options: (db()
      .prepare("SELECT * FROM options WHERE question_id = ? ORDER BY sort")
      .all(q.id) as Row[]).map((o) => ({ id: o.id, text: l10n(o, "text") })),
  }));

  return NextResponse.json({ challenge: meta, questions });
}
