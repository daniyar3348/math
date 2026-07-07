// SQLite data layer (node:sqlite — built into Node, zero native deps).
// The DB file lives at data/esep.db; schema auto-migrates and seeds itself
// from lib/content.ts on first run. All reads/writes go through here —
// questions, courses, users, payments are served from the DB, not from code.
//
// Migration to Supabase/Postgres later: this module is the only place that
// talks SQL — swap DatabaseSync for a Postgres client and keep the helpers.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { COURSES, CHALLENGES } from "./content";
import type { LocalizedText } from "./types";

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (_db) return _db;
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  _db = new DatabaseSync(path.join(dir, "esep.db"));
  _db.exec("PRAGMA journal_mode = WAL;");
  _db.exec("PRAGMA foreign_keys = ON;");
  migrate(_db);
  seed(_db);
  return _db;
}

function migrate(d: DatabaseSync) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    region TEXT NOT NULL DEFAULT '',
    grade INTEGER,
    xp INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    school TEXT NOT NULL,
    title_kk TEXT NOT NULL, title_ru TEXT NOT NULL,
    description_kk TEXT NOT NULL DEFAULT '', description_ru TEXT NOT NULL DEFAULT '',
    level_kk TEXT NOT NULL DEFAULT '', level_ru TEXT NOT NULL DEFAULT '',
    price_kzt INTEGER NOT NULL DEFAULT 0,
    cover TEXT NOT NULL DEFAULT '📘',
    sort INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title_kk TEXT NOT NULL, title_ru TEXT NOT NULL,
    body_kk TEXT NOT NULL DEFAULT '', body_ru TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title_kk TEXT NOT NULL, title_ru TEXT NOT NULL,
    description_kk TEXT NOT NULL DEFAULT '', description_ru TEXT NOT NULL DEFAULT '',
    xp INTEGER NOT NULL DEFAULT 50,
    time_limit_sec INTEGER NOT NULL DEFAULT 300,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    prompt_kk TEXT NOT NULL, prompt_ru TEXT NOT NULL,
    explanation_kk TEXT NOT NULL DEFAULT '', explanation_ru TEXT NOT NULL DEFAULT '',
    correct_option_id TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS options (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text_kk TEXT NOT NULL, text_ru TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'purchase',
    granted_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, course_id)
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    score_pct INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL,
    finished_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    amount_kzt INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    provider TEXT NOT NULL DEFAULT 'kaspi',
    provider_txn_id TEXT,
    created_at INTEGER NOT NULL,
    paid_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    submitted INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS attempt_answers (
    attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    correct INTEGER NOT NULL,
    answered_at INTEGER NOT NULL,
    PRIMARY KEY (attempt_id, question_id)
  );
  CREATE TABLE IF NOT EXISTS rate_events (
    key TEXT NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rate_events ON rate_events(key, ts);
  CREATE TABLE IF NOT EXISTS answer_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    challenge_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    correct INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_answer_events_q ON answer_events(question_id);
  CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
  CREATE INDEX IF NOT EXISTS idx_challenges_course ON challenges(course_id);
  CREATE INDEX IF NOT EXISTS idx_questions_challenge ON questions(challenge_id);
  CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  // Additive column migrations for DBs created before these features.
  ensureColumn(d, "users", "totp_secret", "TEXT");
  ensureColumn(d, "users", "totp_enabled", "INTEGER NOT NULL DEFAULT 0");
}

function ensureColumn(d: DatabaseSync, table: string, col: string, ddl: string) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === col)) {
    d.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  }
}

// ————— Password hashing (scrypt, node:crypto — no deps) —————

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

// ————— Seed (runs once on empty DB) —————

function seed(d: DatabaseSync) {
  const { n } = d.prepare("SELECT COUNT(*) AS n FROM courses").get() as { n: number };
  if (n > 0) return;

  const now = Date.now();
  const insCourse = d.prepare(
    `INSERT INTO courses (id, school, title_kk, title_ru, description_kk, description_ru,
     level_kk, level_ru, price_kzt, cover, sort, published) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`
  );
  const insLesson = d.prepare(
    `INSERT INTO lessons (id, course_id, title_kk, title_ru, body_kk, body_ru, sort)
     VALUES (?,?,?,?,?,?,?)`
  );
  const insChallenge = d.prepare(
    `INSERT INTO challenges (id, course_id, title_kk, title_ru, description_kk, description_ru,
     xp, time_limit_sec, sort) VALUES (?,?,?,?,?,?,?,?,?)`
  );
  const insQuestion = d.prepare(
    `INSERT INTO questions (id, challenge_id, prompt_kk, prompt_ru, explanation_kk, explanation_ru,
     correct_option_id, sort) VALUES (?,?,?,?,?,?,?,?)`
  );
  const insOption = d.prepare(
    `INSERT INTO options (id, question_id, text_kk, text_ru, sort) VALUES (?,?,?,?,?)`
  );

  COURSES.forEach((c, ci) => {
    insCourse.run(
      c.id, c.school, c.title.kk, c.title.ru, c.description.kk, c.description.ru,
      c.level.kk, c.level.ru, c.priceKzt, c.cover, ci
    );
    c.lessons.forEach((l, li) =>
      insLesson.run(l.id, c.id, l.title.kk, l.title.ru, l.body.kk, l.body.ru, li)
    );
  });

  CHALLENGES.forEach((ch, chi) => {
    insChallenge.run(
      ch.id, ch.courseId, ch.title.kk, ch.title.ru, ch.description.kk, ch.description.ru,
      ch.xp, ch.timeLimitSec, chi
    );
    ch.questions.forEach((q, qi) => {
      // Question ids in content.ts repeat across challenges (shared banks) —
      // make them unique per challenge for the DB.
      const qid = `${ch.id}__${q.id}`;
      insQuestion.run(
        qid, ch.id, q.prompt.kk, q.prompt.ru, q.explanation.kk, q.explanation.ru,
        `${qid}__${q.correctId}`, qi
      );
      q.options.forEach((o, oi) =>
        insOption.run(`${qid}__${o.id}`, qid, o.text.kk, o.text.ru, oi)
      );
    });
  });

  // Admin + demo students (leaderboard seed).
  // In production set ADMIN_EMAIL / ADMIN_PASSWORD (and SEED_DEMO=0) in .env
  // BEFORE the first run — the seed only executes on an empty database.
  const insUser = d.prepare(
    `INSERT INTO users (id, name, email, password_hash, salt, role, region, grade, xp, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@esep.kz";
  const admin = hashPassword(process.env.ADMIN_PASSWORD ?? "admin123");
  insUser.run(randomUUID(), "Администратор", adminEmail, admin.hash, admin.salt, "admin", "Алматы", null, 0, now);

  if (process.env.SEED_DEMO === "0") return;
  const demo = hashPassword("demo123");
  (
    [
      ["Айсұлу Н.", "aisulu@demo.kz", "Алматы", 320],
      ["Дамир К.", "damir@demo.kz", "Астана", 285],
      ["Жанель Т.", "zhanel@demo.kz", "Шымкент", 240],
      ["Ерасыл М.", "erasyl@demo.kz", "Қарағанды", 205],
      ["Мадина С.", "madina@demo.kz", "Алматы", 180],
      ["Нұрлан Б.", "nurlan@demo.kz", "Атырау", 140],
      ["Аружан Ж.", "aruzhan@demo.kz", "Астана", 95],
      ["Тимур А.", "timur@demo.kz", "Ақтөбе", 60],
    ] as const
  ).forEach(([name, email, region, xp]) =>
    insUser.run(randomUUID(), name, email, demo.hash, demo.salt, "student", region, 6, xp, now)
  );
}

// ————— Row shaping helpers —————

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export function l10n(row: Row, field: string): LocalizedText {
  return { kk: row[`${field}_kk`] ?? "", ru: row[`${field}_ru`] ?? "" };
}

export function toCourse(row: Row) {
  return {
    id: row.id as string,
    school: row.school as string,
    title: l10n(row, "title"),
    description: l10n(row, "description"),
    level: l10n(row, "level"),
    priceKzt: row.price_kzt as number,
    cover: row.cover as string,
    published: row.published as number,
  };
}

export function toChallengeMeta(row: Row, locked: boolean, questionCount: number) {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    title: l10n(row, "title"),
    description: l10n(row, "description"),
    xp: row.xp as number,
    timeLimitSec: row.time_limit_sec as number,
    questionCount,
    locked,
  };
}

// ————— Access control —————

export function hasAccess(
  user: Row | null,
  course: { id: string; price_kzt: number }
): boolean {
  if (course.price_kzt === 0) return true;
  if (!user) return false;
  if (user.role === "admin") return true;
  const row = db()
    .prepare("SELECT 1 AS x FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(user.id, course.id);
  return !!row;
}

export function newId(): string {
  return randomUUID();
}
