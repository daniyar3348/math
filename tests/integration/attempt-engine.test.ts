// Интеграционные тесты движка попыток (§8/§18): resume, автооценивание,
// идемпотентное завершение, ручная проверка, идемпотентные баллы, лимит попыток.
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { startAttempt, saveAnswer, finalizeAttempt, completeManualReview } from "@/lib/engine/attempt";
import { resetDb, makeOrg, makeStudent, makeTaxonomy, makeQuestions, makePublishedTest } from "../helpers/fixtures";

let orgId: string;
let userId: string;
let testId: string;
let q: Awaited<ReturnType<typeof makeQuestions>>;

beforeAll(async () => {
  await resetDb();
  const org = await makeOrg();
  orgId = org.id;
  const student = await makeStudent(orgId);
  userId = student.id;
  const tax = await makeTaxonomy(orgId);
  q = await makeQuestions(orgId, tax.subject.id, tax.topic.id);
  const test = await makePublishedTest(orgId, tax.subject.id, [q.single.id, q.numeric.id, q.short.id, q.essay.id]);
  testId = test.id;
});

describe("жизненный цикл попытки", () => {
  let attemptId: string;

  it("startAttempt строит layout из 4 вопросов и ставит серверный дедлайн", async () => {
    const attempt = await startAttempt({ testId, userId });
    attemptId = attempt.id;
    const layout = attempt.layout as { questionId: string; points: number }[];
    expect(layout).toHaveLength(4);
    expect(layout.reduce((s, l) => s + l.points, 0)).toBe(12);
    expect(attempt.deadlineAt).not.toBeNull();
  });

  it("повторный start возвращает ту же незавершённую попытку (resume)", async () => {
    const again = await startAttempt({ testId, userId });
    expect(again.id).toBe(attemptId);
  });

  it("saveAnswer сохраняет ответы и ведёт историю изменений", async () => {
    await saveAnswer({ attemptId, userId, questionId: q.single.id, response: { choiceId: q.single.choices.find((c) => c.correct)!.id } });
    await saveAnswer({ attemptId, userId, questionId: q.numeric.id, response: { value: 11 } });
    // исправляем числовой ответ — история должна вырасти
    await saveAnswer({ attemptId, userId, questionId: q.numeric.id, response: { value: 12 } });
    await saveAnswer({ attemptId, userId, questionId: q.short.id, response: { text: "Процент" } });
    await saveAnswer({ attemptId, userId, questionId: q.essay.id, response: { text: "Скидка 20% в магазине — это проценты." } });

    const numericAnswer = await prisma.testAnswer.findFirstOrThrow({ where: { attemptId, questionId: q.numeric.id } });
    expect((numericAnswer.history as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("finalizeAttempt идемпотентен: двойной вызов не дублирует оценку и ManualReview", async () => {
    const first = await finalizeAttempt(attemptId, userId);
    const second = await finalizeAttempt(attemptId, userId);
    expect(first.status).toBe("SUBMITTED"); // эссе ждёт ручную проверку
    expect(second.status).toBe("SUBMITTED");
    const reviews = await prisma.manualReview.findMany({ where: { answer: { attemptId } } });
    expect(reviews).toHaveLength(1);
    // объективная часть: 2 (single) + 3 (numeric) + 2 (short) = 7
    const fresh = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const autoSum = await prisma.testAnswer.aggregate({ where: { attemptId }, _sum: { autoScore: true } });
    expect(autoSum._sum.autoScore).toBe(7);
    expect(fresh.status).toBe("SUBMITTED");
  });

  it("ответ после завершения отклоняется", async () => {
    await expect(
      saveAnswer({ attemptId, userId, questionId: q.single.id, response: { choiceId: "x" } })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("ручная проверка эссе завершает попытку; оценка выше максимума обрезается", async () => {
    const review = await prisma.manualReview.findFirstOrThrow({ where: { answer: { attemptId } } });
    await completeManualReview({ reviewId: review.id, reviewerId: userId, score: 999, comment: "Отличный пример" });
    const attempt = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt.status).toBe("GRADED");
    expect(attempt.manualScore).toBe(5); // clamp 999 → максимум вопроса
    expect(attempt.totalScore).toBe(12); // 7 авто + 5 вручную
    expect(attempt.maxScore).toBe(12);
    expect(attempt.passed).toBe(true); // 100% ≥ 60%
  });

  it("баллы начислены ровно один раз (идемпотентность awardPoints)", async () => {
    // completeManualReview уже вызвал onAttemptGraded; повторное завершение не дублирует
    await finalizeAttempt(attemptId, userId);
    const txns = await prisma.pointTransaction.findMany({ where: { userId } });
    expect(txns).toHaveLength(1);
    expect(txns[0].idempotencyKey).toBe(`test:${testId}:user:${userId}`);
  });

  it("лимит попыток: повторный старт после завершения даёт 409", async () => {
    await expect(startAttempt({ testId, userId })).rejects.toMatchObject({ status: 409 });
  });
});
