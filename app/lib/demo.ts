// Демо-бэкенд для GitHub Pages: реализует те же API-эндпоинты, что и сервер,
// но целиком в браузере — против сид-контента (content.ts) и localStorage.
// Активируется флагом NEXT_PUBLIC_DEMO=1 (см. lib/api.ts).
//
// Ограничения демо (осознанные): аккаунты и прогресс живут только в этом
// браузере, оплата фиктивна, админка недоступна, ответы содержатся в бандле.

import { COURSES, CHALLENGES, type Challenge, type Course } from "./content";
import { ApiError } from "./api";

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

interface DemoAccount {
  name: string;
  email: string;
  password: string;
  region: string;
  grade: number | null;
  xp: number;
  enrolled: string[];
  bestScores: Record<string, number>;
  attempts: {
    id: string;
    challengeId: string;
    scorePct: number;
    xpEarned: number;
    finishedAt: string;
  }[];
}

interface DemoState {
  accounts: Record<string, DemoAccount>;
  session: string | null; // email
  attempt: {
    id: string;
    challengeId: string;
    startedAt: number;
    answers: Record<string, { optionId: string; correct: boolean }>;
    submitted: boolean;
  } | null;
  pendingPayment: { id: string; courseId: string } | null;
}

const KEY = "esep_demo_v1";

const SEED_LEADERS = [
  { name: "Айсұлу Н.", region: "Алматы", xp: 320 },
  { name: "Дамир К.", region: "Астана", xp: 285 },
  { name: "Жанель Т.", region: "Шымкент", xp: 240 },
  { name: "Ерасыл М.", region: "Қарағанды", xp: 205 },
  { name: "Мадина С.", region: "Алматы", xp: 180 },
  { name: "Нұрлан Б.", region: "Атырау", xp: 140 },
];

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const init: DemoState = { accounts: {}, session: null, attempt: null, pendingPayment: null };
  // Предустановленный демо-ученик
  init.accounts["demo@esep.kz"] = {
    name: "Демо Оқушы",
    email: "demo@esep.kz",
    password: "demo123",
    region: "Алматы",
    grade: 6,
    xp: 0,
    enrolled: [],
    bestScores: {},
    attempts: [],
  };
  return init;
}

function save(s: DemoState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function me(s: DemoState): DemoAccount | null {
  return s.session ? s.accounts[s.session] ?? null : null;
}

function err(code: string, status = 400): never {
  throw new ApiError(code, status);
}

const rid = () => `demo-${Math.random().toString(36).slice(2, 10)}`;

function courseById(id: string): Course {
  const c = COURSES.find((c) => c.id === id);
  if (!c) err("not_found", 404);
  return c;
}
function challengeById(id: string): Challenge {
  const ch = CHALLENGES.find((c) => c.id === id);
  if (!ch) err("not_found", 404);
  return ch;
}
function unlockedFor(acc: DemoAccount | null, course: Course): boolean {
  return course.priceKzt === 0 || (!!acc && acc.enrolled.includes(course.id));
}

function challengeMeta(ch: Challenge, acc: DemoAccount | null) {
  const course = courseById(ch.courseId);
  return {
    id: ch.id,
    courseId: ch.courseId,
    title: ch.title,
    description: ch.description,
    xp: ch.xp,
    timeLimitSec: ch.timeLimitSec,
    questionCount: ch.questions.length,
    locked: !unlockedFor(acc, course),
    courseTitle: course.title,
    school: course.school,
    coursePriceKzt: course.priceKzt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function demoFetch(path: string, init?: RequestInit): Promise<any> {
  const s = load();
  const acc = me(s);
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const url = path.split("?")[0];

  // ————— auth —————
  if (url === "/api/me") {
    if (!acc) return { user: null };
    return {
      user: {
        id: acc.email,
        name: acc.name,
        email: acc.email,
        region: acc.region,
        grade: acc.grade,
        role: "student",
        xp: acc.xp,
        totpEnabled: false,
      },
      enrolledCourseIds: acc.enrolled,
      bestScores: acc.bestScores,
    };
  }

  if (url === "/api/auth/login" && method === "POST") {
    const a = s.accounts[String(body.email ?? "").toLowerCase()];
    if (!a || a.password !== body.password) err("invalid_credentials");
    s.session = a.email;
    save(s);
    return { ok: true, role: "student" };
  }

  if (url === "/api/auth/register" && method === "POST") {
    const email = String(body.email ?? "").toLowerCase();
    if (!body.name?.trim() || !email || !body.password) err("fill_all");
    if (body.password.length < 6) err("short_password");
    if (s.accounts[email]) err("registration_failed");
    s.accounts[email] = {
      name: body.name.trim(),
      email,
      password: body.password,
      region: body.region ?? "",
      grade: body.grade ?? null,
      xp: 0,
      enrolled: [],
      bestScores: {},
      attempts: [],
    };
    s.session = email;
    save(s);
    return { ok: true };
  }

  if (url === "/api/auth/logout" && method === "POST") {
    s.session = null;
    save(s);
    return { ok: true };
  }

  if (url === "/api/me/password" && method === "POST") {
    if (!acc) err("unauthorized", 401);
    if (acc.password !== body.current) err("invalid_credentials");
    if (!body.next || body.next.length < 6) err("short_password");
    acc.password = body.next;
    save(s);
    return { ok: true };
  }

  // ————— content —————
  if (url === "/api/courses") {
    return {
      courses: COURSES.map((c) => ({
        id: c.id,
        school: c.school,
        title: c.title,
        description: c.description,
        level: c.level,
        priceKzt: c.priceKzt,
        cover: c.cover,
        lessonsCount: c.lessons.length,
        challengesCount: CHALLENGES.filter((ch) => ch.courseId === c.id).length,
      })),
    };
  }

  const courseMatch = url.match(/^\/api\/courses\/([^/]+)$/);
  if (courseMatch) {
    const c = courseById(courseMatch[1]);
    const unlocked = unlockedFor(acc, c);
    return {
      course: {
        id: c.id, school: c.school, title: c.title, description: c.description,
        level: c.level, priceKzt: c.priceKzt, cover: c.cover,
      },
      lessons: c.lessons.map((l, i) => ({
        id: l.id,
        title: l.title,
        body: unlocked ? l.body : null, // гейтим как настоящий сервер
        sort: i,
      })),
      challenges: CHALLENGES.filter((ch) => ch.courseId === c.id).map((ch) =>
        challengeMeta(ch, acc)
      ),
      unlocked,
    };
  }

  if (url === "/api/challenges") {
    return { challenges: CHALLENGES.map((ch) => challengeMeta(ch, acc)) };
  }

  const chMatch = url.match(/^\/api\/challenges\/([^/]+)$/);
  if (chMatch && method === "GET") {
    const ch = challengeById(chMatch[1]);
    const meta = challengeMeta(ch, acc);
    if (meta.locked) return { challenge: meta, questions: null };
    return {
      challenge: meta,
      questions: ch.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
      })),
    };
  }

  // ————— quiz attempt flow —————
  const startMatch = url.match(/^\/api\/challenges\/([^/]+)\/start$/);
  if (startMatch && method === "POST") {
    const ch = challengeById(startMatch[1]);
    if (challengeMeta(ch, acc).locked) err("forbidden", 403);
    s.attempt = {
      id: rid(),
      challengeId: ch.id,
      startedAt: Date.now(),
      answers: {},
      submitted: false,
    };
    save(s);
    return { attemptId: s.attempt.id, timeLimitSec: ch.timeLimitSec };
  }

  const ansMatch = url.match(/^\/api\/challenges\/([^/]+)\/answer$/);
  if (ansMatch && method === "POST") {
    const ch = challengeById(ansMatch[1]);
    const at = s.attempt;
    if (!at || at.id !== body.attemptId || at.challengeId !== ch.id) err("not_found", 404);
    if (at.submitted) err("attempt_finished");
    if (Date.now() > at.startedAt + ch.timeLimitSec * 1000 + 10_000) err("time_over");
    const q = ch.questions.find((q) => q.id === body.questionId);
    if (!q) err("not_found", 404);
    const existing = at.answers[q.id];
    const correct = body.optionId === q.correctId;
    if (!existing) {
      at.answers[q.id] = { optionId: body.optionId, correct };
      save(s);
    }
    return {
      correct: existing ? existing.correct : correct,
      correctOptionId: q.correctId,
      explanation: q.explanation,
      recorded: !existing,
    };
  }

  const subMatch = url.match(/^\/api\/challenges\/([^/]+)\/submit$/);
  if (subMatch && method === "POST") {
    if (!acc) err("unauthorized", 401);
    const ch = challengeById(subMatch[1]);
    const at = s.attempt;
    if (!at || at.id !== body.attemptId || at.challengeId !== ch.id) err("not_found", 404);
    if (at.submitted) err("attempt_finished");
    at.submitted = true;
    const total = ch.questions.length;
    const correctCount = Object.values(at.answers).filter((a) => a.correct).length;
    const scorePct = Math.round((correctCount / total) * 100);
    const prevBest = acc.bestScores[ch.id] ?? 0;
    const gainedXp = Math.round((Math.max(scorePct - prevBest, 0) / 100) * ch.xp);
    acc.bestScores[ch.id] = Math.max(prevBest, scorePct);
    acc.xp += gainedXp;
    acc.attempts.unshift({
      id: at.id,
      challengeId: ch.id,
      scorePct,
      xpEarned: gainedXp,
      finishedAt: new Date().toISOString(),
    });
    save(s);
    return { scorePct, correctCount, total, gainedXp };
  }

  // ————— misc —————
  if (url === "/api/leaderboard") {
    const rows = [
      ...SEED_LEADERS.map((r) => ({ ...r, me: false })),
      ...(acc ? [{ name: acc.name, region: acc.region, xp: acc.xp, me: true }] : []),
    ].sort((a, b) => b.xp - a.xp);
    return { leaderboard: rows };
  }

  if (url === "/api/attempts") {
    if (!acc) err("unauthorized", 401);
    return {
      attempts: acc.attempts.slice(0, 20).map((a) => ({
        ...a,
        challengeTitle: CHALLENGES.find((c) => c.id === a.challengeId)?.title ?? {
          kk: a.challengeId,
          ru: a.challengeId,
        },
      })),
    };
  }

  if (url === "/api/checkout" && method === "POST") {
    if (!acc) err("unauthorized", 401);
    const c = courseById(String(body.courseId));
    if (acc.enrolled.includes(c.id)) return { alreadyOwned: true };
    const paymentId = rid();
    s.pendingPayment = { id: paymentId, courseId: c.id };
    save(s);
    return { paymentId, amountKzt: c.priceKzt };
  }

  if (url === "/api/checkout/confirm" && method === "POST") {
    if (!acc) err("unauthorized", 401);
    const p = s.pendingPayment;
    if (!p || p.id !== body.paymentId) err("not_found", 404);
    if (!acc.enrolled.includes(p.courseId)) acc.enrolled.push(p.courseId);
    s.pendingPayment = null;
    save(s);
    return { ok: true, courseId: p.courseId };
  }

  // admin и прочее в демо недоступны
  if (url.startsWith("/api/admin") || url === "/api/me/totp") {
    err("demo_unavailable", 403);
  }

  err("not_found", 404);
}
