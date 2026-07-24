// Интеграционный smoke движка: реальный прогон попытки учеником через движок
// (без HTTP): старт → ответы → идемпотентный финиш → ручная проверка → баллы.
import "dotenv/config";
import { prisma } from "../lib/db";
import { startAttempt, saveAnswer, finalizeAttempt, completeManualReview } from "../lib/engine/attempt";
import type { LayoutItem } from "../lib/engine/types";

async function main() {
  const student = await prisma.user.findUniqueOrThrow({ where: { email: "student@bilimhub.local" } });
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher@bilimhub.local" } });

  // очистка прошлых прогонов smoke
  await prisma.testAttempt.deleteMany({ where: { userId: student.id, testId: "test-demo-procenty" } });

  // 1) старт
  const attempt = await startAttempt({ testId: "test-demo-procenty", userId: student.id });
  console.log("✓ start:", attempt.id, "maxScore:", attempt.maxScore, "deadline:", !!attempt.deadlineAt);

  const layout = attempt.layout as unknown as LayoutItem[];
  if (layout.length !== 10) throw new Error(`ожидалось 10 вопросов, получено ${layout.length}`);

  // 2) отвечаем: правильно на большинство, с частичными
  const choices = async (qid: string) =>
    prisma.questionChoice.findMany({ where: { questionId: qid }, orderBy: { sort: "asc" } });

  const c1 = await choices("q-demo-01");
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-01", response: { choiceId: c1.find((c) => c.correct)!.id } });
  const c2 = await choices("q-demo-02");
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-02", response: { choiceId: c2.find((c) => c.correct)!.id } });
  const c3 = await choices("q-demo-03"); // возьмём 2 из 3 правильных → частичный балл
  const correct3 = c3.filter((c) => c.correct).slice(0, 2).map((c) => c.id);
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-03", response: { choiceIds: correct3 } });
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-04", response: { value: true } });
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-05", response: { value: 30 } });
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-06", response: { text: "процент" } });
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-07", response: { values: { a: "100", b: "30" } } });
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-08", response: { pairs: [{ l: 0, r: 0 }, { l: 1, r: 1 }, { l: 2, r: 2 }] } });
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-09", response: { order: [0, 1, 2, 3] } });
  await saveAnswer({
    attemptId: attempt.id, userId: student.id, questionId: "q-demo-10",
    response: { text: "Жаңа баға 640 теңге — бұл бастапқының 80%-ы. Демек бастапқы баға 640 : 0,8 = 800 теңге. Тексеру: 800 · 0,2 = 160; 800 − 160 = 640." },
  });
  console.log("✓ 10 ответов сохранено");

  // перезапись ответа (история)
  await saveAnswer({ attemptId: attempt.id, userId: student.id, questionId: "q-demo-05", response: { value: 30 } });

  // 3) финализация — дважды (проверка идемпотентности)
  const fin1 = await finalizeAttempt(attempt.id, student.id);
  const fin2 = await finalizeAttempt(attempt.id, student.id);
  console.log("✓ finalize:", fin1.status, "autoScore:", fin1.autoScore, "| повторный вызов:", fin2.status);
  if (fin1.status !== "SUBMITTED") throw new Error("ожидался SUBMITTED (есть ESSAY на ручную проверку)");
  // авто: q1(1)+q2(1)+q3(2*(2/3)=1.33)+q4(1)+q5(2)+q6(1)+q7(2)+q8(3)+q9(2) = 14.33
  if (Math.abs(fin1.autoScore - 14.33) > 0.05) throw new Error(`autoScore неожиданный: ${fin1.autoScore}`);

  // 4) ручная проверка эссе
  const review = await prisma.manualReview.findFirstOrThrow({
    where: { status: "PENDING", answer: { attemptId: attempt.id } },
  });
  await completeManualReview({ reviewId: review.id, reviewerId: teacher.id, score: 5, comment: "Толық және дұрыс шешім!" });
  const graded = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
  console.log("✓ manual review → status:", graded.status, "total:", graded.totalScore, "/", graded.maxScore, "passed:", graded.passed);
  if (graded.status !== "GRADED" || !graded.passed) throw new Error("после ручной проверки ожидался GRADED+passed");

  // 5) баллы начислены идемпотентно
  const pts = await prisma.pointTransaction.findMany({ where: { userId: student.id, refId: "test-demo-procenty" } });
  console.log("✓ pointTransactions за тест:", pts.length, "сумма:", pts.reduce((s, p) => s + p.amount, 0));
  if (pts.length !== 1) throw new Error("ожидалась ровно 1 транзакция баллов за тест");

  console.log("\nSMOKE ENGINE OK");
}

main()
  .catch((e) => {
    console.error("SMOKE FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
