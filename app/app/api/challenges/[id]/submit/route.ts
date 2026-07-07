import { NextRequest, NextResponse } from "next/server";
import { db, newId, type Row } from "@/lib/db";
import { getAuthUser, badRequest, notFound, unauthorized } from "@/lib/auth";

// Финальный счёт считается ТОЛЬКО из ответов, записанных сервером в рамках
// попытки (attempt_answers) — клиентские данные не принимаются вовсе.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const attemptId = body?.attemptId as string | undefined;
  if (!attemptId) return badRequest("fill_all");

  const attempt = db()
    .prepare("SELECT * FROM quiz_attempts WHERE id = ? AND challenge_id = ?")
    .get(attemptId, id) as Row | undefined;
  if (!attempt) return notFound();
  if (attempt.submitted) return badRequest("attempt_finished");

  // Гостевая попытка «присваивается» тем, кто вошёл к моменту завершения;
  // чужую (уже привязанную) попытку сдать нельзя.
  if (attempt.user_id === null) {
    db().prepare("UPDATE quiz_attempts SET user_id = ? WHERE id = ?").run(user.id, attemptId);
  } else if (attempt.user_id !== user.id) {
    return notFound();
  }

  const ch = db().prepare("SELECT * FROM challenges WHERE id = ?").get(id) as Row;
  const { total } = db()
    .prepare("SELECT COUNT(*) AS total FROM questions WHERE challenge_id = ?")
    .get(id) as { total: number };
  if (total === 0) return badRequest("empty_challenge");

  const { correct } = db()
    .prepare(
      "SELECT COALESCE(SUM(correct),0) AS correct FROM attempt_answers WHERE attempt_id = ?"
    )
    .get(attemptId) as { correct: number };

  const scorePct = Math.round((correct / total) * 100);

  const prev = db()
    .prepare("SELECT MAX(score_pct) AS best FROM attempts WHERE user_id = ? AND challenge_id = ?")
    .get(user.id, id) as { best: number | null };
  const prevBest = prev.best ?? 0;
  const gainedXp = Math.round((Math.max(scorePct - prevBest, 0) / 100) * ch.xp);

  db().prepare("UPDATE quiz_attempts SET submitted = 1 WHERE id = ?").run(attemptId);
  db()
    .prepare(
      `INSERT INTO attempts (id, user_id, challenge_id, score_pct, correct_count, total_count, xp_earned, finished_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(newId(), user.id, id, scorePct, correct, total, gainedXp, Date.now());
  if (gainedXp > 0) {
    db().prepare("UPDATE users SET xp = xp + ? WHERE id = ?").run(gainedXp, user.id);
  }

  return NextResponse.json({ scorePct, correctCount: correct, total, gainedXp });
}
