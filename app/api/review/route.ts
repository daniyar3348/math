import { NextRequest, NextResponse } from "next/server";
import { db, ready } from "@/lib/db";
import { getDevice, attachDevice } from "@/lib/device";
import { schedule, type Grade, type SrsState } from "@/lib/srs";

const SESSION_LIMIT = 20;

// GET /api/review?deck=<id> — queue of cards to study now (due first, then new).
export async function GET(req: NextRequest) {
  await ready();
  const { id, isNew } = getDevice(req);
  const deckId = req.nextUrl.searchParams.get("deck");
  if (!deckId) return NextResponse.json({ error: "deck_required" }, { status: 400 });
  const now = Date.now();

  const due = await db().execute({
    sql: `SELECT c.id, c.deck_id, c.kk, c.ru, c.hint
          FROM cards c JOIN reviews rv ON rv.card_id = c.id AND rv.device_id = ?1
          WHERE c.deck_id = ?2 AND rv.due_at <= ?3 ORDER BY rv.due_at LIMIT ?4`,
    args: [id, deckId, now, SESSION_LIMIT],
  });

  const remaining = SESSION_LIMIT - due.rows.length;
  let freshRows: typeof due.rows = [];
  if (remaining > 0) {
    const fresh = await db().execute({
      sql: `SELECT c.id, c.deck_id, c.kk, c.ru, c.hint
            FROM cards c LEFT JOIN reviews rv ON rv.card_id = c.id AND rv.device_id = ?1
            WHERE c.deck_id = ?2 AND rv.card_id IS NULL ORDER BY c.sort LIMIT ?3`,
      args: [id, deckId, remaining],
    });
    freshRows = fresh.rows;
  }

  const cards = [...due.rows, ...freshRows].map((row) => ({
    id: row.id as string,
    deckId: row.deck_id as string,
    kk: row.kk as string,
    ru: row.ru as string,
    hint: (row.hint as string | null) ?? null,
  }));

  return attachDevice(NextResponse.json({ cards }), id, isNew);
}

// POST /api/review — { cardId, grade } → update SRS, log review.
export async function POST(req: NextRequest) {
  await ready();
  const { id, isNew } = getDevice(req);
  const body = await req.json().catch(() => null);
  const cardId = body?.cardId as string | undefined;
  const grade = body?.grade as Grade | undefined;
  if (!cardId || !["again", "hard", "good", "easy"].includes(grade ?? "")) {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }

  const exists = await db().execute({ sql: "SELECT 1 FROM cards WHERE id = ?", args: [cardId] });
  if (exists.rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const cur = await db().execute({
    sql: "SELECT ease, interval_days, reps, lapses FROM reviews WHERE device_id = ? AND card_id = ?",
    args: [id, cardId],
  });
  const prev: SrsState | null = cur.rows.length
    ? {
        ease: Number(cur.rows[0].ease),
        intervalDays: Number(cur.rows[0].interval_days),
        reps: Number(cur.rows[0].reps),
        lapses: Number(cur.rows[0].lapses),
      }
    : null;

  const now = Date.now();
  const { next, dueAt } = schedule(prev, grade as Grade, now);

  await db().batch(
    [
      {
        sql: `INSERT INTO reviews (device_id, card_id, ease, interval_days, reps, lapses, due_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?)
              ON CONFLICT(device_id, card_id) DO UPDATE SET
                ease=excluded.ease, interval_days=excluded.interval_days, reps=excluded.reps,
                lapses=excluded.lapses, due_at=excluded.due_at, updated_at=excluded.updated_at`,
        args: [id, cardId, next.ease, next.intervalDays, next.reps, next.lapses, dueAt, now],
      },
      {
        sql: "INSERT INTO review_log (device_id, card_id, grade, ts) VALUES (?,?,?,?)",
        args: [id, cardId, grade as string, now],
      },
    ],
    "write"
  );

  return attachDevice(NextResponse.json({ ok: true, dueAt }), id, isNew);
}
