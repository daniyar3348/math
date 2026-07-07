import { NextRequest, NextResponse } from "next/server";
import { db, l10n, newId, type Row } from "@/lib/db";
import { badRequest, notFound, forbidden } from "@/lib/auth";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

const GRACE_MS = 10_000;

// Мгновенная проверка одного ответа В РАМКАХ попытки.
// Первый ответ на вопрос — окончательный (переответить нельзя);
// лимит времени проверяется сервером.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!rateLimit(`answer:${clientIp(req)}`, 120, 60_000)) return tooManyRequests();

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const { attemptId, questionId, optionId } = (body ?? {}) as {
    attemptId?: string; questionId?: string; optionId?: string;
  };
  if (!attemptId || !questionId || !optionId) return badRequest("fill_all");

  const attempt = db()
    .prepare("SELECT * FROM quiz_attempts WHERE id = ? AND challenge_id = ?")
    .get(attemptId, id) as Row | undefined;
  if (!attempt) return notFound();
  if (attempt.submitted) return badRequest("attempt_finished");

  const ch = db()
    .prepare("SELECT time_limit_sec FROM challenges WHERE id = ?")
    .get(id) as Row;
  if (Date.now() > attempt.started_at + ch.time_limit_sec * 1000 + GRACE_MS) {
    return badRequest("time_over");
  }

  const q = db()
    .prepare("SELECT * FROM questions WHERE id = ? AND challenge_id = ?")
    .get(questionId, id) as Row | undefined;
  if (!q) return notFound();

  const opt = db()
    .prepare("SELECT 1 AS x FROM options WHERE id = ? AND question_id = ?")
    .get(optionId, questionId);
  if (!opt) return badRequest("bad_option");

  const correct = optionId === q.correct_option_id;

  // Первый ответ фиксируется; повторный запрос по тому же вопросу не
  // перезаписывает результат (returning already-recorded verdict).
  const existing = db()
    .prepare("SELECT * FROM attempt_answers WHERE attempt_id = ? AND question_id = ?")
    .get(attemptId, questionId) as Row | undefined;

  if (!existing) {
    db()
      .prepare(
        `INSERT INTO attempt_answers (attempt_id, question_id, option_id, correct, answered_at)
         VALUES (?,?,?,?,?)`
      )
      .run(attemptId, questionId, optionId, correct ? 1 : 0, Date.now());
    // Телеметрия сложности — только по первому (зачётному) ответу.
    db()
      .prepare(
        `INSERT INTO answer_events (id, user_id, challenge_id, question_id, option_id, correct, created_at)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(newId(), attempt.user_id, id, questionId, optionId, correct ? 1 : 0, Date.now());
  }

  return NextResponse.json({
    correct: existing ? !!existing.correct : correct,
    correctOptionId: q.correct_option_id,
    explanation: l10n(q, "explanation"),
    recorded: !existing,
  });
}
