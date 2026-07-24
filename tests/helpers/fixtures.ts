// Общие фикстуры интеграционных тестов (тестовая PG-схема, D-011).
// Каждый файл тестов вызывает resetDb() один раз в beforeAll.
import { prisma } from "@/lib/db";

/** Полная очистка тестовой схемы в порядке зависимостей. */
export async function resetDb() {
  const tables = [
    "pointTransaction", "userBadge", "badge", "manualReview", "testAnswer", "testAttempt",
    "challengeEnrollment", "challengeActivity", "challengeTranslation", "challenge",
    "testQuestion", "testCohort", "testSection", "testTranslation", "test",
    "questionTag", "questionChoice", "questionVersion", "questionTranslation", "question",
    "payment", "notification", "certificateAward", "gradeItem", "assignmentSubmission", "assignment",
    "lessonProgress", "enrollment", "resource", "lessonTranslation", "lesson", "courseModule",
    "announcement", "courseComment", "courseTeacher", "courseTranslation", "course",
    "learningObjective", "topic", "cohortMember", "cohort", "gradeLevel", "subject",
    "auditLog", "loginEvent", "rateEvent", "otpCode", "session", "studentParent",
    "membership", "rolePermission", "permission", "role", "profile", "fileAsset", "review",
    "siteSettings", "user", "organization",
  ] as const;
  for (const t of tables) {
    // @ts-expect-error — динамический доступ к делегатам моделей
    await prisma[t].deleteMany({});
  }
}

export async function makeOrg() {
  return prisma.organization.create({ data: { slug: "test-org", name: "Тестовая организация" } });
}

export async function makeStudent(orgId: string, n = 1) {
  return prisma.user.create({
    data: {
      phone: `+7700000010${n}`,
      profile: { create: { firstName: `Оқушы${n}`, locale: "kk" } },
    },
  });
}

export async function makeTaxonomy(orgId: string) {
  const subject = await prisma.subject.create({
    data: { organizationId: orgId, slug: "matematika", nameKk: "Математика", nameRu: "Математика" },
  });
  const grade = await prisma.gradeLevel.create({
    data: { organizationId: orgId, number: 6, nameKk: "6-сынып", nameRu: "6 класс" },
  });
  const topic = await prisma.topic.create({
    data: { organizationId: orgId, subjectId: subject.id, slug: "procenty", nameKk: "Пайыздар", nameRu: "Проценты" },
  });
  return { subject, grade, topic };
}

/** 4 вопроса: SINGLE(2б), NUMERIC(3б), SHORT_TEXT(2б), ESSAY(5б) = максимум 12. */
export async function makeQuestions(orgId: string, subjectId: string, topicId: string) {
  const single = await prisma.question.create({
    data: {
      organizationId: orgId, subjectId, topicId, type: "SINGLE_CHOICE", points: 2, status: "PUBLISHED",
      config: {},
      translations: { create: [
        { locale: "kk", prompt: "10%-ы 5 болатын сан?" },
        { locale: "ru", prompt: "Число, 10% которого равно 5?" },
      ] },
      choices: { create: [
        { sort: 0, correct: true, textKk: "50", textRu: "50" },
        { sort: 1, correct: false, textKk: "5", textRu: "5" },
        { sort: 2, correct: false, textKk: "500", textRu: "500" },
      ] },
    },
    include: { choices: true },
  });
  const numeric = await prisma.question.create({
    data: {
      organizationId: orgId, subjectId, topicId, type: "NUMERIC", points: 3, status: "PUBLISHED",
      config: { answer: 12, tolerance: 0 },
      translations: { create: [
        { locale: "kk", prompt: "48-дің 25%-ы?" },
        { locale: "ru", prompt: "25% от 48?" },
      ] },
    },
  });
  const short = await prisma.question.create({
    data: {
      organizationId: orgId, subjectId, topicId, type: "SHORT_TEXT", points: 2, status: "PUBLISHED",
      config: { answers: { kk: ["пайыз"], ru: ["процент"] }, caseSensitive: false },
      translations: { create: [
        { locale: "kk", prompt: "Жүзден бір бөлік қалай аталады?" },
        { locale: "ru", prompt: "Как называется сотая часть числа?" },
      ] },
    },
  });
  const essay = await prisma.question.create({
    data: {
      organizationId: orgId, subjectId, topicId, type: "ESSAY", points: 5, status: "PUBLISHED",
      config: { minWords: 0 },
      translations: { create: [
        { locale: "kk", prompt: "Пайыздың күнделікті өмірдегі қолданысына мысал келтіріңіз." },
        { locale: "ru", prompt: "Приведите пример использования процентов в повседневной жизни." },
      ] },
    },
  });
  return { single, numeric, short, essay };
}

export async function makePublishedTest(
  orgId: string,
  subjectId: string,
  questionIds: string[],
  overrides: Record<string, unknown> = {}
) {
  return prisma.test.create({
    data: {
      organizationId: orgId,
      slug: `test-${Math.random().toString(36).slice(2, 8)}`,
      subjectId,
      status: "PUBLISHED",
      attemptsAllowed: 1,
      passPct: 60,
      timeLimitSec: 600,
      publishedAt: new Date(),
      translations: { create: [
        { locale: "kk", title: "Пайыздар — тест" },
        { locale: "ru", title: "Проценты — тест" },
      ] },
      sections: {
        create: [{
          sort: 0, titleKk: "Негізгі", titleRu: "Основная",
          questions: { create: questionIds.map((id, i) => ({ questionId: id, sort: i })) },
        }],
      },
      ...overrides,
    },
    include: { sections: { include: { questions: true } } },
  });
}
