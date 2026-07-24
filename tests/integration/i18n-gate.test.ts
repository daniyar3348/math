// i18n-гейт публикации (§5): черновик может быть одноязычным,
// публикация требует kk+ru обязательного контента.
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { setContentStatus } from "@/lib/admin-actions";
import { resetDb, makeOrg, makeTaxonomy, makeQuestions, makePublishedTest } from "../helpers/fixtures";

let orgId: string;
let subjectId: string;
let topicId: string;

beforeAll(async () => {
  await resetDb();
  const org = await makeOrg();
  orgId = org.id;
  const tax = await makeTaxonomy(orgId);
  subjectId = tax.subject.id;
  topicId = tax.topic.id;
});

describe("вопрос", () => {
  it("публикация без казахского перевода блокируется, с обоими — проходит", async () => {
    const question = await prisma.question.create({
      data: {
        organizationId: orgId, subjectId, topicId, type: "TRUE_FALSE", points: 1,
        config: { answer: true },
        translations: { create: [{ locale: "ru", prompt: "Процент — это сотая часть числа?" }] },
      },
    });
    await expect(setContentStatus({ entity: "question", id: question.id, status: "PUBLISHED" }))
      .rejects.toMatchObject({ status: 409, message: "i18n_incomplete" });

    await prisma.questionTranslation.create({
      data: { questionId: question.id, locale: "kk", prompt: "Пайыз — санның жүзден бір бөлігі ме?" },
    });
    await setContentStatus({ entity: "question", id: question.id, status: "PUBLISHED" });
    const fresh = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    expect(fresh.status).toBe("PUBLISHED");
  });
});

describe("тест", () => {
  it("пустой тест без вопросов публиковать нельзя", async () => {
    const empty = await prisma.test.create({
      data: {
        organizationId: orgId, slug: "empty-test", subjectId,
        translations: { create: [
          { locale: "kk", title: "Бос тест" },
          { locale: "ru", title: "Пустой тест" },
        ] },
      },
    });
    await expect(setContentStatus({ entity: "test", id: empty.id, status: "PUBLISHED" }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("тест с вопросами и двумя языками публикуется", async () => {
    const q = await makeQuestions(orgId, subjectId, topicId);
    const test = await makePublishedTest(orgId, subjectId, [q.single.id], { status: "DRAFT", publishedAt: null });
    await setContentStatus({ entity: "test", id: test.id, status: "PUBLISHED" });
    const fresh = await prisma.test.findUniqueOrThrow({ where: { id: test.id } });
    expect(fresh.status).toBe("PUBLISHED");
  });
});

describe("челлендж", () => {
  it("без активностей публиковать нельзя", async () => {
    const ch = await prisma.challenge.create({
      data: {
        organizationId: orgId, slug: "no-tests",
        startAt: new Date(), endAt: new Date(Date.now() + 86400000),
        translations: { create: [
          { locale: "kk", title: "Бос челлендж" },
          { locale: "ru", title: "Пустой челлендж" },
        ] },
      },
    });
    await expect(setContentStatus({ entity: "challenge", id: ch.id, status: "PUBLISHED" }))
      .rejects.toMatchObject({ status: 409 });
  });
});
