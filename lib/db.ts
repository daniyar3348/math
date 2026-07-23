// Data layer on libSQL (@libsql/client).
// Dev: local file (file:sozdik.db). Prod (Vercel): Turso via env
//   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// This is the only module that talks SQL.

import { createClient, type Client } from "@libsql/client";
import { SEED_DECKS } from "./seed";

let _client: Client | null = null;
let _ready: Promise<void> | null = null;

export function db(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL || "file:sozdik.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  _client = createClient(authToken ? { url, authToken } : { url });
  return _client;
}

// Idempotent migrate + seed; runs once per process.
export function ready(): Promise<void> {
  if (!_ready) _ready = migrateAndSeed();
  return _ready;
}

async function migrateAndSeed() {
  const d = db();
  await d.batch(
    [
      `CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY, emoji TEXT NOT NULL,
        title_kk TEXT NOT NULL, title_ru TEXT NOT NULL,
        desc_kk TEXT NOT NULL DEFAULT '', desc_ru TEXT NOT NULL DEFAULT '',
        sort INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        kk TEXT NOT NULL, ru TEXT NOT NULL, hint TEXT, sort INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS reviews (
        device_id TEXT NOT NULL, card_id TEXT NOT NULL,
        ease REAL NOT NULL DEFAULT 2.5, interval_days REAL NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL DEFAULT 0, lapses INTEGER NOT NULL DEFAULT 0,
        due_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (device_id, card_id))`,
      `CREATE TABLE IF NOT EXISTS review_log (
        device_id TEXT NOT NULL, card_id TEXT NOT NULL,
        grade TEXT NOT NULL, ts INTEGER NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reviews_dev ON reviews(device_id, due_at)`,
      `CREATE INDEX IF NOT EXISTS idx_log_dev ON review_log(device_id, ts)`,
    ],
    "write"
  );

  const seeded = await d.execute("SELECT COUNT(*) AS n FROM decks");
  if (Number(seeded.rows[0].n) > 0) return;

  const stmts: { sql: string; args: (string | number | null)[] }[] = [];
  SEED_DECKS.forEach((deck, di) => {
    stmts.push({
      sql: `INSERT INTO decks (id, emoji, title_kk, title_ru, desc_kk, desc_ru, sort)
            VALUES (?,?,?,?,?,?,?)`,
      args: [deck.id, deck.emoji, deck.title_kk, deck.title_ru, deck.desc_kk, deck.desc_ru, di],
    });
    deck.cards.forEach((c, ci) => {
      stmts.push({
        sql: `INSERT INTO cards (id, deck_id, kk, ru, hint, sort) VALUES (?,?,?,?,?,?)`,
        args: [`${deck.id}-${ci}`, deck.id, c.kk, c.ru, c.hint ?? null, ci],
      });
    });
  });
  await d.batch(stmts, "write");
}
