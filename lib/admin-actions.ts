// Спец-логика админки: вопросы (переводы+варианты+версии), тесты (секции),
// workflow публикации с i18n-гейтом (§5: публикация запрещена без обоих языков),
// импорт вопросов CSV, действия над пользователями.
import { z } from "zod";
import { prisma } from "./db";
import { err } from "./http";
import { CONFIG_SCHEMAS, type QuestionTypeKey } from "./engine/types";
import type { ContentStatus, QuestionType } from "./generated/prisma/enums";
import { hashPassword } from "./auth/passwords";
import { revokeAllSessions } from "./auth/session";
import { roleId } from "./org";
import type { RoleKey } from "./rbac";

// ——— Вопросы ———

export const QuestionInput = z.object({
  subjectId: z.string().min(1),
  gradeLevelId: z.string().nullable().optional(),
  topicId: z.string().nullable().optional(),
  objectiveId: z.string().nullable().optional(),
  type: z.enum([
    "SINGLE_CHOICE", "MULTI_CHOICE", "TRUE_FALSE", "SHORT_TEXT", "NUMERIC",
    "FILL_BLANKS", "MATCHING", "ORDERING", "ESSAY", "FILE_UPLOAD",
  ]),
  difficulty: z.number().int().min(1).max(5).default(2),
  points: z.number().min(0.5).max(100).default(1),
  config: z.record(z.string(), z.unknown()).default({}),
  promptKk: z.string().max(4000).default(""),
  promptRu: z.string().max(4000).default(""),
  explanationKk: z.string().max(4000).default(""),
  explanationRu: z.string().max(4000).default(""),
  tags: z.array(z.string().max(40)).max(10).default([]),
  choices: z
    .array(
      z.object({
        textKk: z.string().max(1000).default(""),
        textRu: z.string().max(1000).default(""),
        correct: z.boolean().default(false),
        imageFileId: z.string().nullable().optional(),
      })
    )
    .max(10)
    .default([]),
});
export type QuestionInputT = z.infer<typeof QuestionInput>;

const CHOICE_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE"];

function validateQuestionPayload(data: QuestionInputT) {
  // конфиг по типу
  const schema = CONFIG_SCHEMAS[data.type as QuestionTypeKey];
  const parsed = schema.safeParse(data.config);
  if (!parsed.success) throw err.badRequest("bad_question_config");
  if (CHOICE_TYPES.includes(data.type)) {
    if (data.choices.length < 2) throw err.badRequest("choices_min_2");
    const correct = data.choices.filter((c) => c.correct).length;
    if (data.type === "SINGLE_CHOICE" && correct !== 1) throw err.badRequest("single_needs_one_correct");
    if (data.type === "MULTI_CHOICE" && correct < 1) throw err.badRequest("multi_needs_correct");
  }
  return parsed.data as object;
}

export async function upsertQuestion(orgId: string, actorId: string, data: QuestionInputT, id?: string) {
  const config = validateQuestionPayload(data);
  const base = {
    subjectId: data.subjectId,
    gradeLevelId: data.gradeLevelId ?? null,
    topicId: data.topicId ?? null,
    objectiveId: data.objectiveId ?? null,
    type: data.type as QuestionType,
    difficulty: data.difficulty,
    points: data.points,
    config,
  };
  const translations = [
    { locale: "kk" as const, prompt: data.promptKk, explanation: data.explanationKk },
    { locale: "ru" as const, prompt: data.promptRu, explanation: data.explanationRu },
  ];

  if (id) {
    const existing = await prisma.question.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw err.notFound();
    const version = existing.version + 1;
    return prisma.$transaction(async (tx) => {
      await tx.question.update({ where: { id }, data: { ...base, version } });
      for (const tr of translations) {
        await tx.questionTranslation.upsert({
          where: { questionId_locale: { questionId: id, locale: tr.locale } },
          update: { prompt: tr.prompt, explanation: tr.explanation },
          create: { questionId: id, ...tr },
        });
      }
      await tx.questionChoice.deleteMany({ where: { questionId: id } });
      if (data.choices.length) {
        await tx.questionChoice.createMany({
          data: data.choices.map((c, i) => ({ questionId: id, sort: i, correct: c.correct, textKk: c.textKk, textRu: c.textRu, imageFileId: c.imageFileId ?? null })),
        });
      }
      await tx.questionTag.deleteMany({ where: { questionId: id } });
      if (data.tags.length) {
        await tx.questionTag.createMany({ data: data.tags.map((tag) => ({ questionId: id, tag })) });
      }
      await tx.questionVersion.create({
        data: { questionId: id, version, snapshot: { base, translations, choices: data.choices } as object, createdById: actorId },
      });
      return tx.question.findUniqueOrThrow({ where: { id } });
    });
  }

  return prisma.question.create({
    data: {
      organizationId: orgId,
      ...base,
      createdById: actorId,
      translations: { create: translations },
      choices: { create: data.choices.map((c, i) => ({ sort: i, correct: c.correct, textKk: c.textKk, textRu: c.textRu, imageFileId: c.imageFileId ?? null })) },
      tags: { create: data.tags.map((tag) => ({ tag })) },
      versions: { create: { version: 1, snapshot: { base, translations, choices: data.choices } as object, createdById: actorId } },
    },
  });
}

/** Готовность перевода: заполнены ли обязательные поля на каждом языке. */
export function questionI18nReady(q: { translations: { locale: string; prompt: string }[] }): { kk: boolean; ru: boolean } {
  const has = (l: string) => !!q.translations.find((t) => t.locale === l && t.prompt.trim().length > 0);
  return { kk: has("kk"), ru: has("ru") };
}

// ——— Workflow публикации (общая для question/test/challenge/course/lesson) ———

export async function setContentStatus(params: {
  entity: "question" | "test" | "challenge" | "course" | "lesson";
  id: string;
  status: ContentStatus;
}): Promise<void> {
  const { entity, id, status } = params;

  if (status === "PUBLISHED") {
    // i18n-гейт: обязательный контент на обоих языках (§5)
    if (entity === "question") {
      const q = await prisma.question.findFirst({ where: { id }, include: { translations: true } });
      if (!q) throw err.notFound();
      const ready = questionI18nReady(q);
      if (!ready.kk || !ready.ru) throw err.conflict("i18n_incomplete");
    }
    if (entity === "test") {
      const t = await prisma.test.findFirst({ where: { id }, include: { translations: true, sections: { include: { questions: true } } } });
      if (!t) throw err.notFound();
      for (const l of ["kk", "ru"]) {
        const tr = t.translations.find((x) => x.locale === l);
        if (!tr || !tr.title.trim()) throw err.conflict("i18n_incomplete");
      }
      const hasQuestions = t.sections.some((s) => s.questions.length > 0 || (s.randomCount ?? 0) > 0);
      if (!hasQuestions) throw err.conflict("empty_test");
    }
    if (entity === "challenge") {
      const c = await prisma.challenge.findFirst({ where: { id }, include: { translations: true, activities: true } });
      if (!c) throw err.notFound();
      for (const l of ["kk", "ru"]) {
        const tr = c.translations.find((x) => x.locale === l);
        if (!tr || !tr.title.trim()) throw err.conflict("i18n_incomplete");
      }
      if (c.activities.length === 0) throw err.conflict("empty_challenge");
    }
    if (entity === "course") {
      const c = await prisma.course.findFirst({ where: { id }, include: { translations: true } });
      if (!c) throw err.notFound();
      for (const l of ["kk", "ru"]) {
        const tr = c.translations.find((x) => x.locale === l);
        if (!tr || !tr.title.trim()) throw err.conflict("i18n_incomplete");
      }
    }
    if (entity === "lesson") {
      const l = await prisma.lesson.findFirst({ where: { id }, include: { translations: true } });
      if (!l) throw err.notFound();
      for (const loc of ["kk", "ru"]) {
        const tr = l.translations.find((x) => x.locale === loc);
        if (!tr || !tr.title.trim() || !tr.contentMd.trim()) throw err.conflict("i18n_incomplete");
      }
    }
  }

  // Поле publishedAt есть только у Test/Challenge/Course (у Question/Lesson — нет)
  const hasStamp = entity === "test" || entity === "challenge" || entity === "course";
  const data = hasStamp && status === "PUBLISHED" ? { status, publishedAt: new Date() } : { status };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[entity];
  await model.update({ where: { id }, data });
}

// ——— Тесты (конструктор) ———

export const TestInput = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  subjectId: z.string().min(1),
  gradeLevelId: z.string().nullable().optional(),
  mode: z.enum(["STANDARD", "DIAGNOSTIC", "EXAM"]).default("STANDARD"),
  accessType: z.enum(["FREE", "PAID"]).default("FREE"),
  priceKzt: z.number().int().min(0).nullable().optional(),
  timeLimitSec: z.number().int().min(60).max(4 * 3600).nullable().optional(),
  attemptsAllowed: z.number().int().min(1).max(20).default(1),
  passPct: z.number().int().min(0).max(100).default(60),
  availableFrom: z.string().datetime().nullable().optional(),
  availableTo: z.string().datetime().nullable().optional(),
  shuffleQuestions: z.boolean().default(false),
  shuffleChoices: z.boolean().default(false),
  allowBack: z.boolean().default(true),
  onePerPage: z.boolean().default(false),
  autoSubmit: z.boolean().default(true),
  resultsPolicy: z.enum(["IMMEDIATE", "AFTER_CLOSE", "MANUAL"]).default("IMMEDIATE"),
  showCorrect: z.enum(["NEVER", "AFTER_SUBMIT", "AFTER_CLOSE"]).default("AFTER_SUBMIT"),
  showExplanations: z.boolean().default(true),
  accessCode: z.string().max(64).default(""),
  titleKk: z.string().max(300).default(""),
  titleRu: z.string().max(300).default(""),
  descriptionKk: z.string().max(4000).default(""),
  descriptionRu: z.string().max(4000).default(""),
  instructionsKk: z.string().max(4000).default(""),
  instructionsRu: z.string().max(4000).default(""),
  cohortIds: z.array(z.string()).default([]),
  sections: z
    .array(
      z.object({
        titleKk: z.string().max(200).default(""),
        titleRu: z.string().max(200).default(""),
        questionIds: z.array(z.string()).default([]),
        randomFromTopicId: z.string().nullable().optional(),
        randomCount: z.number().int().min(1).max(100).nullable().optional(),
        randomDifficulty: z.number().int().min(1).max(5).nullable().optional(),
      })
    )
    .min(1),
});
export type TestInputT = z.infer<typeof TestInput>;

export async function upsertTest(orgId: string, actorId: string, data: TestInputT, id?: string) {
  const core = {
    slug: data.slug,
    subjectId: data.subjectId,
    gradeLevelId: data.gradeLevelId ?? null,
    mode: data.mode,
    accessType: data.accessType,
    priceKzt: data.accessType === "PAID" ? data.priceKzt ?? 0 : null,
    timeLimitSec: data.timeLimitSec ?? null,
    attemptsAllowed: data.attemptsAllowed,
    passPct: data.passPct,
    availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
    availableTo: data.availableTo ? new Date(data.availableTo) : null,
    shuffleQuestions: data.shuffleQuestions,
    shuffleChoices: data.shuffleChoices,
    allowBack: data.allowBack,
    onePerPage: data.onePerPage,
    autoSubmit: data.autoSubmit,
    resultsPolicy: data.resultsPolicy,
    showCorrect: data.showCorrect,
    showExplanations: data.showExplanations,
    accessCode: data.accessCode,
  };
  const translations = [
    { locale: "kk" as const, title: data.titleKk, description: data.descriptionKk, instructions: data.instructionsKk },
    { locale: "ru" as const, title: data.titleRu, description: data.descriptionRu, instructions: data.instructionsRu },
  ];

  return prisma.$transaction(async (tx) => {
    let testId = id;
    if (testId) {
      const exists = await tx.test.findFirst({ where: { id: testId, deletedAt: null } });
      if (!exists) throw err.notFound();
      await tx.test.update({ where: { id: testId }, data: core });
      await tx.testSection.deleteMany({ where: { testId } });
      await tx.testCohort.deleteMany({ where: { testId } });
    } else {
      const created = await tx.test.create({ data: { organizationId: orgId, createdById: actorId, ...core } });
      testId = created.id;
    }
    for (const tr of translations) {
      await tx.testTranslation.upsert({
        where: { testId_locale: { testId: testId!, locale: tr.locale } },
        update: tr,
        create: { testId: testId!, ...tr },
      });
    }
    for (const [si, s] of data.sections.entries()) {
      await tx.testSection.create({
        data: {
          testId: testId!,
          sort: si,
          titleKk: s.titleKk,
          titleRu: s.titleRu,
          randomFromTopicId: s.randomFromTopicId ?? null,
          randomCount: s.randomCount ?? null,
          randomDifficulty: s.randomDifficulty ?? null,
          questions: { create: s.questionIds.map((qid, qi) => ({ questionId: qid, sort: qi })) },
        },
      });
    }
    for (const cid of data.cohortIds) {
      await tx.testCohort.create({ data: { testId: testId!, cohortId: cid } });
    }
    return tx.test.findUniqueOrThrow({ where: { id: testId! }, include: { translations: true, sections: true } });
  });
}

// ——— Пользователи ———

export async function adminUserAction(params: {
  actorId: string;
  orgId: string;
  targetId: string;
  action: "set_roles" | "block" | "unblock" | "reset_password" | "link_parent" | "add_to_cohort";
  roles?: RoleKey[];
  password?: string;
  parentUserId?: string;
  cohortId?: string;
}) {
  const { targetId } = params;
  const target = await prisma.user.findFirst({ where: { id: targetId, deletedAt: null } });
  if (!target) throw err.notFound();

  switch (params.action) {
    case "set_roles": {
      if (!params.roles?.length) throw err.badRequest("roles_required");
      if (params.targetId === params.actorId && !params.roles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN")) {
        throw err.conflict("cannot_demote_self");
      }
      await prisma.membership.deleteMany({ where: { userId: targetId, organizationId: params.orgId } });
      for (const r of params.roles) {
        await prisma.membership.create({
          data: { userId: targetId, organizationId: params.orgId, roleId: await roleId(r) },
        });
      }
      return;
    }
    case "block":
      if (params.targetId === params.actorId) throw err.conflict("cannot_block_self");
      await prisma.user.update({ where: { id: targetId }, data: { status: "BLOCKED" } });
      await revokeAllSessions(targetId);
      return;
    case "unblock":
      await prisma.user.update({ where: { id: targetId }, data: { status: "ACTIVE" } });
      return;
    case "reset_password": {
      const pw = params.password ?? "";
      if (pw.length < 8) throw err.badRequest("password_min_8");
      await prisma.user.update({ where: { id: targetId }, data: { passwordHash: await hashPassword(pw) } });
      await revokeAllSessions(targetId);
      return;
    }
    case "link_parent": {
      if (!params.parentUserId) throw err.badRequest("parent_required");
      await prisma.studentParent.upsert({
        where: { studentUserId_parentUserId: { studentUserId: targetId, parentUserId: params.parentUserId } },
        update: {},
        create: { studentUserId: targetId, parentUserId: params.parentUserId },
      });
      return;
    }
    case "add_to_cohort": {
      if (!params.cohortId) throw err.badRequest("cohort_required");
      await prisma.cohortMember.upsert({
        where: { cohortId_userId: { cohortId: params.cohortId, userId: targetId } },
        update: {},
        create: { cohortId: params.cohortId, userId: targetId },
      });
      return;
    }
  }
}

// ——— Челленджи ———

export const ChallengeInput = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  subjectId: z.string().nullable().optional(),
  gradeLevelId: z.string().nullable().optional(),
  accessType: z.enum(["FREE", "PAID"]).default("FREE"),
  priceKzt: z.number().int().min(0).nullable().optional(),
  regStartAt: z.string().datetime().nullable().optional(),
  regEndAt: z.string().datetime().nullable().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  maxParticipants: z.number().int().min(1).nullable().optional(),
  isPublic: z.boolean().default(true),
  accessCode: z.string().max(64).default(""),
  passPct: z.number().int().min(0).max(100).default(50),
  titleKk: z.string().max(300).default(""),
  titleRu: z.string().max(300).default(""),
  descriptionKk: z.string().max(4000).default(""),
  descriptionRu: z.string().max(4000).default(""),
  prizesKk: z.string().max(2000).default(""),
  prizesRu: z.string().max(2000).default(""),
  activities: z.array(z.object({ testId: z.string().min(1), pointsWeight: z.number().min(0.1).max(10).default(1) })).default([]),
});
export type ChallengeInputT = z.infer<typeof ChallengeInput>;

export async function saveChallenge(orgId: string, actorId: string, data: ChallengeInputT, id?: string) {
  const core = {
    slug: data.slug,
    subjectId: data.subjectId ?? null,
    gradeLevelId: data.gradeLevelId ?? null,
    accessType: data.accessType,
    priceKzt: data.accessType === "PAID" ? data.priceKzt ?? 0 : null,
    regStartAt: data.regStartAt ? new Date(data.regStartAt) : null,
    regEndAt: data.regEndAt ? new Date(data.regEndAt) : null,
    startAt: new Date(data.startAt),
    endAt: new Date(data.endAt),
    maxParticipants: data.maxParticipants ?? null,
    isPublic: data.isPublic,
    accessCode: data.accessCode,
    passPct: data.passPct,
  };
  const translations = [
    { locale: "kk" as const, title: data.titleKk, description: data.descriptionKk, prizes: data.prizesKk },
    { locale: "ru" as const, title: data.titleRu, description: data.descriptionRu, prizes: data.prizesRu },
  ];
  return prisma.$transaction(async (tx) => {
    let chId = id;
    if (chId) {
      await tx.challenge.update({ where: { id: chId }, data: core });
      await tx.challengeActivity.deleteMany({ where: { challengeId: chId } });
    } else {
      const created = await tx.challenge.create({ data: { organizationId: orgId, createdById: actorId, ...core } });
      chId = created.id;
    }
    for (const tr of translations) {
      await tx.challengeTranslation.upsert({
        where: { challengeId_locale: { challengeId: chId!, locale: tr.locale } },
        update: tr,
        create: { challengeId: chId!, ...tr },
      });
    }
    for (const [i, act] of data.activities.entries()) {
      await tx.challengeActivity.create({
        data: { challengeId: chId!, testId: act.testId, sort: i, pointsWeight: act.pointsWeight },
      });
    }
    return tx.challenge.findUniqueOrThrow({ where: { id: chId! }, include: { translations: true, activities: true } });
  });
}


// ——— Курсы ———

export const CourseInput = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  subjectId: z.string().min(1),
  gradeLevelId: z.string().nullable().optional(),
  level: z.string().max(60).default(""),
  accessType: z.enum(["FREE", "PAID"]).default("FREE"),
  priceKzt: z.number().int().min(0).nullable().optional(),
  sequential: z.boolean().default(false),
  selfEnroll: z.boolean().default(true),
  certificateEnabled: z.boolean().default(true),
  titleKk: z.string().max(300).default(""),
  titleRu: z.string().max(300).default(""),
  descriptionKk: z.string().max(6000).default(""),
  descriptionRu: z.string().max(6000).default(""),
  seoTitleKk: z.string().max(200).default(""),
  seoTitleRu: z.string().max(200).default(""),
  seoDescriptionKk: z.string().max(400).default(""),
  seoDescriptionRu: z.string().max(400).default(""),
  teacherUserIds: z.array(z.string()).default([]),
});
export type CourseInputT = z.infer<typeof CourseInput>;

export async function saveCourse(orgId: string, actorId: string, data: CourseInputT, id?: string) {
  const core = {
    slug: data.slug,
    subjectId: data.subjectId,
    gradeLevelId: data.gradeLevelId ?? null,
    level: data.level,
    accessType: data.accessType,
    priceKzt: data.accessType === "PAID" ? data.priceKzt ?? 0 : null,
    sequential: data.sequential,
    selfEnroll: data.selfEnroll,
    certificateEnabled: data.certificateEnabled,
  };
  const translations = (["kk", "ru"] as const).map((l) => ({
    locale: l,
    title: l === "kk" ? data.titleKk : data.titleRu,
    description: l === "kk" ? data.descriptionKk : data.descriptionRu,
    seoTitle: l === "kk" ? data.seoTitleKk : data.seoTitleRu,
    seoDescription: l === "kk" ? data.seoDescriptionKk : data.seoDescriptionRu,
  }));

  return prisma.$transaction(async (tx) => {
    let courseId = id;
    if (courseId) {
      const exists = await tx.course.findFirst({ where: { id: courseId, deletedAt: null } });
      if (!exists) throw err.notFound();
      await tx.course.update({ where: { id: courseId }, data: core });
      await tx.courseTeacher.deleteMany({ where: { courseId } });
    } else {
      const created = await tx.course.create({ data: { organizationId: orgId, createdById: actorId, ...core } });
      courseId = created.id;
    }
    for (const tr of translations) {
      await tx.courseTranslation.upsert({
        where: { courseId_locale: { courseId: courseId!, locale: tr.locale } },
        update: tr,
        create: { courseId: courseId!, ...tr },
      });
    }
    for (const uid of data.teacherUserIds) {
      await tx.courseTeacher.create({ data: { courseId: courseId!, userId: uid } });
    }
    return tx.course.findUniqueOrThrow({ where: { id: courseId! }, include: { translations: true, teachers: true } });
  });
}

// ——— Уроки ———

export const LessonInput = z.object({
  moduleId: z.string().min(1),
  sort: z.number().int().default(0),
  videoUrl: z.string().max(500).default(""),
  titleKk: z.string().max(300).default(""),
  titleRu: z.string().max(300).default(""),
  contentMdKk: z.string().max(60000).default(""),
  contentMdRu: z.string().max(60000).default(""),
});
export type LessonInputT = z.infer<typeof LessonInput>;

/** Преподаватель может создавать/править черновики только в назначенных курсах. */
export async function saveLesson(
  actor: { userId: string; roles: RoleKey[] },
  data: LessonInputT,
  id?: string
) {
  const mod = await prisma.courseModule.findUnique({ where: { id: data.moduleId }, include: { course: true } });
  if (!mod) throw err.notFound();
  const admin = actor.roles.includes("ADMIN") || actor.roles.includes("SUPER_ADMIN");
  if (!admin) {
    const link = await prisma.courseTeacher.findUnique({
      where: { courseId_userId: { courseId: mod.courseId, userId: actor.userId } },
    });
    if (!link) throw err.forbidden();
  }

  const translations = (["kk", "ru"] as const).map((l) => ({
    locale: l,
    title: l === "kk" ? data.titleKk : data.titleRu,
    contentMd: l === "kk" ? data.contentMdKk : data.contentMdRu,
  }));

  if (id) {
    const existing = await prisma.lesson.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw err.notFound();
    return prisma.$transaction(async (tx) => {
      await tx.lesson.update({ where: { id }, data: { moduleId: data.moduleId, sort: data.sort, videoUrl: data.videoUrl } });
      for (const tr of translations) {
        await tx.lessonTranslation.upsert({
          where: { lessonId_locale: { lessonId: id, locale: tr.locale } },
          update: tr,
          create: { lessonId: id, ...tr },
        });
      }
      return tx.lesson.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    });
  }
  return prisma.lesson.create({
    data: {
      moduleId: data.moduleId,
      sort: data.sort,
      videoUrl: data.videoUrl,
      translations: { create: translations },
    },
    include: { translations: true },
  });
}

// ——— Импорт/экспорт вопросов CSV (§8) ———
// Колонки: type;subjectSlug;topicSlug;gradeNumber;difficulty;points;
//          promptKk;promptRu;explanationKk;explanationRu;configJson;choicesJson;tags

export function questionsToCsv(rows: {
  type: string;
  subject: { slug: string };
  topic: { slug: string } | null;
  gradeLevel: { number: number } | null;
  difficulty: number;
  points: number;
  config: unknown;
  translations: { locale: string; prompt: string; explanation: string }[];
  choices: { textKk: string; textRu: string; correct: boolean }[];
  tags: { tag: string }[];
}[]): string {
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = "type;subjectSlug;topicSlug;gradeNumber;difficulty;points;promptKk;promptRu;explanationKk;explanationRu;configJson;choicesJson;tags";
  const lines = rows.map((q) => {
    const tr = (l: string) => q.translations.find((x) => x.locale === l);
    return [
      q.type,
      q.subject.slug,
      q.topic?.slug ?? "",
      q.gradeLevel?.number ?? "",
      q.difficulty,
      q.points,
      tr("kk")?.prompt ?? "",
      tr("ru")?.prompt ?? "",
      tr("kk")?.explanation ?? "",
      tr("ru")?.explanation ?? "",
      JSON.stringify(q.config ?? {}),
      JSON.stringify(q.choices.map((c) => ({ kk: c.textKk, ru: c.textRu, correct: c.correct }))),
      q.tags.map((t) => t.tag).join(","),
    ]
      .map((v) => esc(String(v)))
      .join(";");
  });
  return "﻿" + [header, ...lines].join("\n");
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ";") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export async function importQuestionsCsv(orgId: string, actorId: string, csv: string) {
  const rows = parseCsvText(csv);
  const start = rows[0]?.[0]?.toLowerCase() === "type" ? 1 : 0;
  const errors: { line: number; message: string }[] = [];
  let imported = 0;

  const subjects = await prisma.subject.findMany({ where: { organizationId: orgId } });
  const topics = await prisma.topic.findMany({ where: { organizationId: orgId } });
  const grades = await prisma.gradeLevel.findMany({ where: { organizationId: orgId } });

  for (let i = start; i < rows.length; i++) {
    const line = i + 1;
    const r = rows[i];
    try {
      if (r.length < 12) throw new Error(`мало колонок (${r.length}/13)`);
      const subject = subjects.find((s) => s.slug === r[1].trim());
      if (!subject) throw new Error(`неизвестный предмет «${r[1]}»`);
      const topic = r[2].trim() ? topics.find((t) => t.slug === r[2].trim()) : null;
      if (r[2].trim() && !topic) throw new Error(`неизвестная тема «${r[2]}»`);
      const grade = r[3].trim() ? grades.find((g) => g.number === Number(r[3])) : null;
      let choicesJson: { kk: string; ru: string; correct?: boolean }[] = [];
      if (r[11]?.trim()) choicesJson = JSON.parse(r[11]);
      const payload = QuestionInput.parse({
        subjectId: subject.id,
        topicId: topic?.id ?? null,
        gradeLevelId: grade?.id ?? null,
        type: r[0].trim(),
        difficulty: Number(r[4]) || 2,
        points: Number(r[5]) || 1,
        promptKk: r[6] ?? "",
        promptRu: r[7] ?? "",
        explanationKk: r[8] ?? "",
        explanationRu: r[9] ?? "",
        config: r[10]?.trim() ? JSON.parse(r[10]) : {},
        choices: choicesJson.map((c) => ({ textKk: c.kk ?? "", textRu: c.ru ?? "", correct: !!c.correct })),
        tags: (r[12] ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      });
      await upsertQuestion(orgId, actorId, payload);
      imported++;
    } catch (e) {
      errors.push({ line, message: e instanceof Error ? e.message.slice(0, 200) : "ошибка разбора" });
    }
  }
  return { imported, errors };
}
