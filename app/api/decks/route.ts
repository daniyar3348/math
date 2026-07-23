import { NextRequest, NextResponse } from "next/server";
import { db, ready } from "@/lib/db";
import { getDevice, attachDevice } from "@/lib/device";

export async function GET(req: NextRequest) {
  await ready();
  const { id, isNew } = getDevice(req);
  const now = Date.now();

  const r = await db().execute({
    sql: `SELECT d.id, d.emoji, d.title_kk, d.title_ru, d.desc_kk, d.desc_ru,
      (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id) AS total,
      (SELECT COUNT(*) FROM cards c LEFT JOIN reviews rv
         ON rv.card_id = c.id AND rv.device_id = ?1
       WHERE c.deck_id = d.id AND rv.card_id IS NULL) AS fresh,
      (SELECT COUNT(*) FROM cards c JOIN reviews rv
         ON rv.card_id = c.id AND rv.device_id = ?1
       WHERE c.deck_id = d.id AND rv.due_at <= ?2) AS due,
      (SELECT COUNT(*) FROM cards c JOIN reviews rv
         ON rv.card_id = c.id AND rv.device_id = ?1
       WHERE c.deck_id = d.id AND rv.reps >= 1) AS learned
      FROM decks d ORDER BY d.sort`,
    args: [id, now],
  });

  const decks = r.rows.map((row) => ({
    id: row.id as string,
    emoji: row.emoji as string,
    title_kk: row.title_kk as string,
    title_ru: row.title_ru as string,
    desc_kk: row.desc_kk as string,
    desc_ru: row.desc_ru as string,
    total: Number(row.total),
    fresh: Number(row.fresh),
    due: Number(row.due),
    learned: Number(row.learned),
  }));

  return attachDevice(NextResponse.json({ decks }), id, isNew);
}
