import { NextRequest, NextResponse } from "next/server";
import { db, newId, type Row } from "@/lib/db";
import { getAuthUser, forbidden, badRequest, notFound } from "@/lib/auth";
import {
  RESOURCES,
  upsertQuestion,
  analytics,
  exportQuestions,
  importQuestions,
  csvToQuestions,
  validateImportQuestion,
  duplicateChallenge,
  type ImportQuestion,
} from "@/lib/admin";

function guard(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET /api/admin/[resource]?course_id=…  — list
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> }
) {
  if (!guard(req)) return forbidden();
  const { resource } = await ctx.params;

  if (resource === "summary") {
    const d = db();
    const n = (sql: string) => (d.prepare(sql).get() as { n: number }).n;
    return NextResponse.json({
      users: n("SELECT COUNT(*) AS n FROM users WHERE role='student'"),
      courses: n("SELECT COUNT(*) AS n FROM courses"),
      challenges: n("SELECT COUNT(*) AS n FROM challenges"),
      questions: n("SELECT COUNT(*) AS n FROM questions"),
      attempts: n("SELECT COUNT(*) AS n FROM attempts"),
      paidPayments: n("SELECT COUNT(*) AS n FROM payments WHERE status='paid'"),
      revenueKzt:
        (d.prepare("SELECT COALESCE(SUM(amount_kzt),0) AS n FROM payments WHERE status='paid'")
          .get() as { n: number }).n,
    });
  }

  if (resource === "analytics") {
    return analytics();
  }

  if (resource === "questions-export") {
    const challengeId = req.nextUrl.searchParams.get("challenge_id");
    if (!challengeId) return badRequest("challenge_id_required");
    return exportQuestions(challengeId);
  }

  if (resource === "questions") {
    const challengeId = req.nextUrl.searchParams.get("challenge_id");
    if (!challengeId) return badRequest("challenge_id_required");
    const questions = (db()
      .prepare("SELECT * FROM questions WHERE challenge_id = ? ORDER BY sort")
      .all(challengeId) as Row[]).map((q) => {
      const options = db()
        .prepare("SELECT * FROM options WHERE question_id = ? ORDER BY sort")
        .all(q.id) as Row[];
      return {
        ...q,
        options,
        correctIndex: options.findIndex((o) => o.id === q.correct_option_id),
      };
    });
    return NextResponse.json({ rows: questions });
  }

  if (resource === "payments") {
    const rows = db()
      .prepare(
        `SELECT p.*, u.name AS user_name, u.email AS user_email, c.title_ru AS course_title
         FROM payments p JOIN users u ON u.id = p.user_id JOIN courses c ON c.id = p.course_id
         ORDER BY p.created_at DESC LIMIT 200`
      )
      .all();
    return NextResponse.json({ rows });
  }

  if (resource === "users") {
    // Users with their enrolled course ids (comma-separated) for the manage panel.
    const rows = db()
      .prepare(
        `SELECT u.id, u.name, u.email, u.region, u.grade, u.role, u.xp, u.created_at,
          (SELECT GROUP_CONCAT(e.course_id) FROM enrollments e WHERE e.user_id = u.id) AS enrolled
         FROM users u ORDER BY u.created_at DESC`
      )
      .all();
    return NextResponse.json({ rows });
  }

  const cfg = RESOURCES[resource];
  if (!cfg) return notFound();

  let sql = `SELECT * FROM ${cfg.table}`;
  const args: (string | number)[] = [];
  for (const key of cfg.filterKeys ?? []) {
    const v = req.nextUrl.searchParams.get(key);
    if (v) {
      sql += `${args.length ? " AND" : " WHERE"} ${key} = ?`;
      args.push(v);
    }
  }
  sql += ` ORDER BY ${cfg.orderBy}`;
  const rows = db().prepare(sql).all(...args);
  return NextResponse.json({ rows });
}

// POST /api/admin/[resource] — create
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> }
) {
  if (!guard(req)) return forbidden();
  const { resource } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("bad_json");

  if (resource === "questions") {
    return upsertQuestion(body, null);
  }

  if (resource === "questions-import") {
    const { challenge_id, format, data, replace } = body as {
      challenge_id?: string; format?: string; data?: string; replace?: boolean;
    };
    if (!challenge_id || !data) return badRequest("fill_all");
    if (data.length > 2_000_000) return badRequest("too_large"); // 2 MB текста

    let questions: ImportQuestion[] = [];
    let errors: string[] = [];
    if (format === "csv") {
      ({ questions, errors } = csvToQuestions(data));
    } else {
      try {
        const parsed = JSON.parse(data);
        const list = Array.isArray(parsed) ? parsed : parsed?.questions;
        if (!Array.isArray(list)) return badRequest("bad_json_shape");
        list.forEach((q: ImportQuestion, i: number) => {
          const err = validateImportQuestion(q, i + 1);
          if (err) errors.push(err);
          else questions.push(q);
        });
      } catch {
        return badRequest("bad_json");
      }
    }
    if (questions.length === 0) {
      return NextResponse.json({ ok: false, inserted: 0, errors }, { status: 400 });
    }
    if (questions.length > 500) return badRequest("too_many_questions"); // за один импорт
    const res = importQuestions(challenge_id, questions, !!replace);
    if (res.status !== 200) return res; // e.g. challenge not found
    // merge validation warnings into the success response
    const json = await res.clone().json().catch(() => ({}));
    return NextResponse.json({ ...json, errors });
  }

  if (resource === "duplicate-challenge") {
    const challengeId = body.challengeId as string | undefined;
    if (!challengeId) return badRequest("fill_all");
    return duplicateChallenge(challengeId);
  }

  const cfg = RESOURCES[resource];
  if (!cfg || cfg.readonly) return notFound();

  const id = newId();
  const cols = cfg.fields.filter((f) => body[f] !== undefined);
  if (cols.length === 0) return badRequest("empty");
  db()
    .prepare(
      `INSERT INTO ${cfg.table} (id, ${cols.join(",")}) VALUES (?, ${cols.map(() => "?").join(",")})`
    )
    .run(id, ...cols.map((c) => body[c]));
  return NextResponse.json({ ok: true, id });
}
