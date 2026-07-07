// Admin resource configs + shared handlers for /api/admin/[resource] CRUD.

import { NextResponse } from "next/server";
import { db, newId, hashPassword, type Row } from "./db";

export interface ResourceConfig {
  table: string;
  fields: string[]; // writable columns
  filterKeys?: string[]; // allowed query-string filters (?course_id=…)
  orderBy: string;
  readonly?: boolean;
}

export const RESOURCES: Record<string, ResourceConfig> = {
  courses: {
    table: "courses",
    fields: [
      "school", "title_kk", "title_ru", "description_kk", "description_ru",
      "level_kk", "level_ru", "price_kzt", "cover", "sort", "published",
    ],
    orderBy: "sort",
  },
  lessons: {
    table: "lessons",
    fields: ["course_id", "title_kk", "title_ru", "body_kk", "body_ru", "sort"],
    filterKeys: ["course_id"],
    orderBy: "sort",
  },
  challenges: {
    table: "challenges",
    fields: [
      "course_id", "title_kk", "title_ru", "description_kk", "description_ru",
      "xp", "time_limit_sec", "sort",
    ],
    filterKeys: ["course_id"],
    orderBy: "sort",
  },
  users: {
    table: "users",
    fields: [],
    orderBy: "created_at DESC",
    readonly: true,
  },
  payments: {
    table: "payments",
    fields: [],
    orderBy: "created_at DESC",
    readonly: true,
  },
  // "questions" is handled specially (nested options) — see upsertQuestion.
};

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

// Shared create/update for questions with nested options.
export function upsertQuestion(body: Row, existingId: string | null) {
  const {
    challenge_id, prompt_kk, prompt_ru, explanation_kk = "", explanation_ru = "",
    options, correctIndex,
  } = body as {
    challenge_id?: string; prompt_kk?: string; prompt_ru?: string;
    explanation_kk?: string; explanation_ru?: string;
    options?: { text_kk: string; text_ru: string }[]; correctIndex?: number;
  };

  if (!prompt_kk || !prompt_ru || !Array.isArray(options) || options.length < 2)
    return badRequest("fill_all");
  if (
    correctIndex === undefined || correctIndex < 0 || correctIndex >= options.length
  )
    return badRequest("bad_correct_index");

  const d = db();
  let qid = existingId;

  if (qid) {
    const exists = d.prepare("SELECT challenge_id FROM questions WHERE id = ?").get(qid) as
      | Row
      | undefined;
    if (!exists) return notFound();
    d.prepare(
      `UPDATE questions SET prompt_kk=?, prompt_ru=?, explanation_kk=?, explanation_ru=? WHERE id=?`
    ).run(prompt_kk, prompt_ru, explanation_kk, explanation_ru, qid);
    d.prepare("DELETE FROM options WHERE question_id = ?").run(qid);
  } else {
    if (!challenge_id) return badRequest("challenge_id_required");
    qid = newId();
    const { n } = d
      .prepare("SELECT COUNT(*) AS n FROM questions WHERE challenge_id = ?")
      .get(challenge_id) as { n: number };
    d.prepare(
      `INSERT INTO questions (id, challenge_id, prompt_kk, prompt_ru, explanation_kk, explanation_ru, correct_option_id, sort)
       VALUES (?,?,?,?,?,?, '', ?)`
    ).run(qid, challenge_id, prompt_kk, prompt_ru, explanation_kk, explanation_ru, n);
  }

  let correctOptionId = "";
  options.forEach((o, i) => {
    const oid = newId();
    d.prepare(
      "INSERT INTO options (id, question_id, text_kk, text_ru, sort) VALUES (?,?,?,?,?)"
    ).run(oid, qid, o.text_kk ?? "", o.text_ru ?? "", i);
    if (i === correctIndex) correctOptionId = oid;
  });
  d.prepare("UPDATE questions SET correct_option_id = ? WHERE id = ?").run(correctOptionId, qid);

  return NextResponse.json({ ok: true, id: qid });
}

// ————— User management actions —————

export function userAction(
  targetId: string,
  body: Row,
  actingAdminId: string
) {
  const d = db();
  const target = d.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as Row | undefined;
  if (!target) return notFound();

  switch (body.action) {
    case "role": {
      if (body.role !== "admin" && body.role !== "student") return badRequest("bad_role");
      if (targetId === actingAdminId && body.role !== "admin")
        return badRequest("cannot_demote_self");
      d.prepare("UPDATE users SET role = ? WHERE id = ?").run(body.role, targetId);
      return NextResponse.json({ ok: true });
    }
    case "password": {
      const pw = String(body.password ?? "");
      if (pw.length < 6) return badRequest("short_password");
      const { hash, salt } = hashPassword(pw);
      d.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(
        hash, salt, targetId
      );
      // Revoke the user's existing sessions so the old password stops working everywhere.
      d.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetId);
      return NextResponse.json({ ok: true });
    }
    case "xp": {
      const delta = Number(body.delta);
      if (!Number.isFinite(delta)) return badRequest("bad_delta");
      d.prepare("UPDATE users SET xp = MAX(0, xp + ?) WHERE id = ?").run(
        Math.round(delta), targetId
      );
      return NextResponse.json({ ok: true });
    }
    case "grant": {
      const courseId = String(body.courseId ?? "");
      const course = d.prepare("SELECT id FROM courses WHERE id = ?").get(courseId);
      if (!course) return notFound();
      d.prepare(
        `INSERT OR IGNORE INTO enrollments (user_id, course_id, source, granted_at)
         VALUES (?,?, 'manual', ?)`
      ).run(targetId, courseId, Date.now());
      return NextResponse.json({ ok: true });
    }
    case "revoke": {
      d.prepare("DELETE FROM enrollments WHERE user_id = ? AND course_id = ?").run(
        targetId, String(body.courseId ?? "")
      );
      return NextResponse.json({ ok: true });
    }
    case "clear_totp": {
      // Аварийный сброс 2FA (потерян телефон и т.п.)
      d.prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?").run(targetId);
      return NextResponse.json({ ok: true });
    }
    default:
      return badRequest("unknown_action");
  }
}

// ————— Questions import / export —————

export interface ImportQuestion {
  prompt_kk: string;
  prompt_ru: string;
  explanation_kk?: string;
  explanation_ru?: string;
  options: { text_kk: string; text_ru: string }[];
  correctIndex: number;
}

// Minimal CSV parser with quote support; delimiter auto-detected (; or ,).
export function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || text.length);
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cur); cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

// CSV columns: prompt_kk;prompt_ru;opt1_kk;opt1_ru;…;opt4_kk;opt4_ru;correct(1-4);explanation_kk;explanation_ru
export function csvToQuestions(text: string): { questions: ImportQuestion[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const questions: ImportQuestion[] = [];
  // skip header if it looks like one
  const start = rows[0]?.[0]?.toLowerCase().includes("prompt") ? 1 : 0;
  rows.slice(start).forEach((r, idx) => {
    const line = start + idx + 1;
    if (r.length < 12) { errors.push(`строка ${line}: мало колонок (${r.length}/13)`); return; }
    const options = [] as { text_kk: string; text_ru: string }[];
    for (let o = 0; o < 4; o++) {
      const kk = (r[2 + o * 2] ?? "").trim();
      const ru = (r[3 + o * 2] ?? "").trim();
      if (kk || ru) options.push({ text_kk: kk || ru, text_ru: ru || kk });
    }
    const correct = parseInt(r[10], 10);
    const q: ImportQuestion = {
      prompt_kk: (r[0] ?? "").trim(),
      prompt_ru: (r[1] ?? "").trim(),
      options,
      correctIndex: correct - 1,
      explanation_kk: (r[11] ?? "").trim(),
      explanation_ru: (r[12] ?? "").trim(),
    };
    const err = validateImportQuestion(q, line);
    if (err) errors.push(err);
    else questions.push(q);
  });
  return { questions, errors };
}

export function validateImportQuestion(q: ImportQuestion, line: number | string): string | null {
  if (!q.prompt_kk?.trim() || !q.prompt_ru?.trim())
    return `строка ${line}: пустой вопрос (нужны prompt_kk и prompt_ru)`;
  if (!Array.isArray(q.options) || q.options.length < 2)
    return `строка ${line}: минимум 2 варианта`;
  if (q.options.length > 6) return `строка ${line}: максимум 6 вариантов`;
  if (
    !Number.isInteger(q.correctIndex) ||
    q.correctIndex < 0 ||
    q.correctIndex >= q.options.length
  )
    return `строка ${line}: correct вне диапазона (1–${q.options.length})`;
  return null;
}

export function importQuestions(challengeId: string, questions: ImportQuestion[], replace: boolean) {
  const d = db();
  const ch = d.prepare("SELECT id FROM challenges WHERE id = ?").get(challengeId);
  if (!ch) return notFound();

  if (replace) {
    d.prepare("DELETE FROM questions WHERE challenge_id = ?").run(challengeId);
  }
  let sort = (
    d.prepare("SELECT COUNT(*) AS n FROM questions WHERE challenge_id = ?").get(challengeId) as { n: number }
  ).n;

  for (const q of questions) {
    const qid = newId();
    d.prepare(
      `INSERT INTO questions (id, challenge_id, prompt_kk, prompt_ru, explanation_kk, explanation_ru, correct_option_id, sort)
       VALUES (?,?,?,?,?,?, '', ?)`
    ).run(qid, challengeId, q.prompt_kk.trim(), q.prompt_ru.trim(), q.explanation_kk ?? "", q.explanation_ru ?? "", sort++);
    let correctId = "";
    q.options.forEach((o, i) => {
      const oid = newId();
      d.prepare("INSERT INTO options (id, question_id, text_kk, text_ru, sort) VALUES (?,?,?,?,?)")
        .run(oid, qid, o.text_kk ?? "", o.text_ru ?? "", i);
      if (i === q.correctIndex) correctId = oid;
    });
    d.prepare("UPDATE questions SET correct_option_id = ? WHERE id = ?").run(correctId, qid);
  }
  return NextResponse.json({ ok: true, inserted: questions.length });
}

export function exportQuestions(challengeId: string) {
  const d = db();
  const ch = d.prepare("SELECT * FROM challenges WHERE id = ?").get(challengeId) as Row | undefined;
  if (!ch) return notFound();
  const questions = (d
    .prepare("SELECT * FROM questions WHERE challenge_id = ? ORDER BY sort")
    .all(challengeId) as Row[]).map((q) => {
    const options = d
      .prepare("SELECT * FROM options WHERE question_id = ? ORDER BY sort")
      .all(q.id) as Row[];
    return {
      prompt_kk: q.prompt_kk,
      prompt_ru: q.prompt_ru,
      explanation_kk: q.explanation_kk,
      explanation_ru: q.explanation_ru,
      options: options.map((o) => ({ text_kk: o.text_kk, text_ru: o.text_ru })),
      correctIndex: options.findIndex((o) => o.id === q.correct_option_id),
    };
  });
  return NextResponse.json({
    challenge: { id: ch.id, title_kk: ch.title_kk, title_ru: ch.title_ru },
    questions,
  });
}

export function duplicateChallenge(challengeId: string) {
  const d = db();
  const ch = d.prepare("SELECT * FROM challenges WHERE id = ?").get(challengeId) as Row | undefined;
  if (!ch) return notFound();

  const newChId = newId();
  const { n } = d
    .prepare("SELECT COUNT(*) AS n FROM challenges WHERE course_id = ?")
    .get(ch.course_id) as { n: number };
  d.prepare(
    `INSERT INTO challenges (id, course_id, title_kk, title_ru, description_kk, description_ru, xp, time_limit_sec, sort)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    newChId, ch.course_id, `${ch.title_kk} (көшірме)`, `${ch.title_ru} (копия)`,
    ch.description_kk, ch.description_ru, ch.xp, ch.time_limit_sec, n
  );

  const questions = d
    .prepare("SELECT * FROM questions WHERE challenge_id = ? ORDER BY sort")
    .all(challengeId) as Row[];
  for (const q of questions) {
    const qid = newId();
    d.prepare(
      `INSERT INTO questions (id, challenge_id, prompt_kk, prompt_ru, explanation_kk, explanation_ru, correct_option_id, sort)
       VALUES (?,?,?,?,?,?, '', ?)`
    ).run(qid, newChId, q.prompt_kk, q.prompt_ru, q.explanation_kk, q.explanation_ru, q.sort);
    const options = d
      .prepare("SELECT * FROM options WHERE question_id = ? ORDER BY sort")
      .all(q.id) as Row[];
    let correctId = "";
    options.forEach((o, i) => {
      const oid = newId();
      d.prepare("INSERT INTO options (id, question_id, text_kk, text_ru, sort) VALUES (?,?,?,?,?)")
        .run(oid, qid, o.text_kk, o.text_ru, i);
      if (o.id === q.correct_option_id) correctId = oid;
      void i;
    });
    d.prepare("UPDATE questions SET correct_option_id = ? WHERE id = ?").run(correctId, qid);
  }
  return NextResponse.json({ ok: true, id: newChId });
}

// ————— Analytics —————

function dayBuckets(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return out;
}

function byDay(rows: Row[], days: string[]): { day: string; n: number }[] {
  const map = new Map(rows.map((r) => [r.d as string, Number(r.n)]));
  return days.map((day) => ({ day, n: map.get(day) ?? 0 }));
}

export function analytics() {
  const d = db();
  const DAYS = 30;
  const days = dayBuckets(DAYS);
  const since = Date.now() - DAYS * 24 * 3600 * 1000;

  const regs = d
    .prepare(
      `SELECT date(created_at/1000,'unixepoch','localtime') AS d, COUNT(*) AS n
       FROM users WHERE role='student' AND created_at > ? GROUP BY d`
    )
    .all(since) as Row[];
  const attempts = d
    .prepare(
      `SELECT date(finished_at/1000,'unixepoch','localtime') AS d, COUNT(*) AS n
       FROM attempts WHERE finished_at > ? GROUP BY d`
    )
    .all(since) as Row[];
  const revenue = d
    .prepare(
      `SELECT date(paid_at/1000,'unixepoch','localtime') AS d, SUM(amount_kzt) AS n
       FROM payments WHERE status='paid' AND paid_at > ? GROUP BY d`
    )
    .all(since) as Row[];

  const courseStats = d
    .prepare(
      `SELECT c.id, c.title_ru, c.cover, c.price_kzt,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrollments,
        (SELECT COUNT(*) FROM attempts a JOIN challenges ch ON ch.id = a.challenge_id WHERE ch.course_id = c.id) AS attempts,
        (SELECT COALESCE(SUM(p.amount_kzt),0) FROM payments p WHERE p.course_id = c.id AND p.status='paid') AS revenue
       FROM courses c ORDER BY c.sort`
    )
    .all() as Row[];

  const difficulty = d
    .prepare(
      `SELECT q.id, q.prompt_ru, q.challenge_id, ch.title_ru AS challenge_title,
              COUNT(ae.id) AS answers,
              ROUND(AVG(ae.correct) * 100) AS correct_pct
       FROM questions q
       JOIN challenges ch ON ch.id = q.challenge_id
       LEFT JOIN answer_events ae ON ae.question_id = q.id
       GROUP BY q.id
       ORDER BY ch.sort, q.sort`
    )
    .all() as Row[];

  return NextResponse.json({
    registrationsByDay: byDay(regs, days),
    attemptsByDay: byDay(attempts, days),
    revenueByDay: byDay(revenue, days),
    courseStats,
    difficulty: difficulty.map((r) => ({
      questionId: r.id,
      prompt: r.prompt_ru,
      challengeId: r.challenge_id,
      challengeTitle: r.challenge_title,
      answers: Number(r.answers),
      correctPct: r.correct_pct === null ? null : Number(r.correct_pct),
    })),
  });
}
