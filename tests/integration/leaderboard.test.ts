// Рейтинг челленджа (§10): лучший результат × вес, документированный tie-break:
// totalPoints ↓ → finishedAt ↑ (nulls последними) → joinedAt ↑.
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { recomputeChallengeLeaderboard } from "@/lib/points";
import { resetDb, makeOrg, makeStudent, makeTaxonomy, makeQuestions, makePublishedTest } from "../helpers/fixtures";

let challengeId: string;
let ids: { a: string; b: string; c: string; d: string };

const T0 = new Date("2026-07-20T10:00:00Z");
const T1 = new Date("2026-07-20T11:00:00Z");

beforeAll(async () => {
  await resetDb();
  const org = await makeOrg();
  const tax = await makeTaxonomy(org.id);
  const q = await makeQuestions(org.id, tax.subject.id, tax.topic.id);
  const test = await makePublishedTest(org.id, tax.subject.id, [q.single.id]);

  const challenge = await prisma.challenge.create({
    data: {
      organizationId: org.id, slug: "marathon", status: "PUBLISHED",
      startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 86400000),
      translations: { create: [
        { locale: "kk", title: "Марафон" },
        { locale: "ru", title: "Марафон" },
      ] },
      activities: { create: [{ testId: test.id, pointsWeight: 1.5 }] },
    },
  });
  challengeId = challenge.id;

  const [a, b, c, d] = await Promise.all([1, 2, 3, 4].map((n) => makeStudent(org.id, n)));
  ids = { a: a.id, b: b.id, c: c.id, d: d.id };

  // Порядок регистрации: a раньше d
  for (const [i, userId] of [a.id, b.id, c.id, d.id].entries()) {
    await prisma.challengeEnrollment.create({
      data: { challengeId, userId, joinedAt: new Date(T0.getTime() + i * 1000) },
    });
  }

  const mkAttempt = (userId: string, pct: number, submittedAt: Date, attemptNo = 1) =>
    prisma.testAttempt.create({
      data: {
        testId: test.id, userId, challengeId, status: "GRADED", attemptNo,
        layout: [], maxScore: 100, totalScore: pct, autoScore: pct,
        submittedAt, startedAt: T0,
      },
    });

  // a и b — одинаковые 80%, но b финишировал раньше → b выше
  await mkAttempt(ids.a, 80, T1);
  await mkAttempt(ids.b, 80, T0);
  // c — два результата: берётся лучший (50 → 90)
  await mkAttempt(ids.c, 50, T0, 1);
  await mkAttempt(ids.c, 90, T1, 2);
  // d — не проходил тест вовсе
});

describe("recomputeChallengeLeaderboard", () => {
  it("считает лучший результат × вес и применяет tie-break", async () => {
    await recomputeChallengeLeaderboard(challengeId);
    const rows = await prisma.challengeEnrollment.findMany({ where: { challengeId }, orderBy: { rank: "asc" } });
    const byUser = new Map(rows.map((r) => [r.userId, r]));

    // c: 90% × 1.5 = 135 — первый
    expect(byUser.get(ids.c)?.rank).toBe(1);
    expect(byUser.get(ids.c)?.totalPoints).toBe(135);
    // b и a: по 120, у b finishedAt раньше
    expect(byUser.get(ids.b)?.rank).toBe(2);
    expect(byUser.get(ids.a)?.rank).toBe(3);
    expect(byUser.get(ids.b)?.totalPoints).toBe(120);
    // d без попыток — последний, finishedAt null
    expect(byUser.get(ids.d)?.rank).toBe(4);
    expect(byUser.get(ids.d)?.totalPoints).toBe(0);
    expect(byUser.get(ids.d)?.finishedAt).toBeNull();
  });

  it("повторный пересчёт стабилен (идемпотентен)", async () => {
    await recomputeChallengeLeaderboard(challengeId);
    const rows = await prisma.challengeEnrollment.findMany({ where: { challengeId }, orderBy: { rank: "asc" } });
    expect(rows.map((r) => r.userId)).toEqual([ids.c, ids.b, ids.a, ids.d]);
  });
});
