// Золотой путь §18 (1–9) и §21: админ через UI создаёт вопрос → тест → челлендж
// и публикует; ученик регистрируется, проходит тест, получает результат и баллы;
// админ видит результат.
import { test, expect } from "@playwright/test";
import { loginStaff, loginStudentOtp, ADMIN_EMAIL, runId } from "./helpers";

test.describe.configure({ mode: "serial" });

const PROMPT_RU = `Сколько будет 25% от 200? [${runId}]`;
const PROMPT_KK = `200-дің 25%-ы неге тең? [${runId}]`;
const TEST_SLUG = `procenty-${runId}`;
const TEST_TITLE_RU = `Проценты Е2Е ${runId}`;
const TEST_TITLE_KK = `Пайыздар Е2Е ${runId}`;
const CH_SLUG = `challenge-${runId}`;
const CH_TITLE_RU = `Челлендж Е2Е ${runId}`;
const STUDENT_PHONE = `+7701${String(Date.now()).slice(-7)}`;

test("админ: входит, создаёт и публикует вопрос/тест/челлендж через UI (§18.1–5)", async ({ page }) => {
  await loginStaff(page, ADMIN_EMAIL);

  await test.step("создать двуязычный вопрос", async () => {
    await page.goto("/admin/questions");
    await page.getByRole("button", { name: "+ Вопрос" }).click();
    await expect(page.getByText("Новый вопрос")).toBeVisible();

    await page.getByLabel("Предмет").selectOption({ label: "Математика" });
    await page.getByLabel(/Текст вопроса.*\(KK\)/).fill(PROMPT_KK);
    await page.getByLabel(/Текст вопроса.*\(RU\)/).fill(PROMPT_RU);
    await page.getByPlaceholder("Нұсқа 1 (KK)").fill("50");
    await page.getByPlaceholder("Вариант 1 (RU)").fill("50");
    await page.getByPlaceholder("Нұсқа 2 (KK)").fill("25");
    await page.getByPlaceholder("Вариант 2 (RU)").fill("25");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Новый вопрос")).toBeHidden();
  });

  await test.step("опубликовать вопрос", async () => {
    await page.getByLabel("Поиск").fill(runId);
    await page.getByLabel("Поиск").press("Enter");
    const row = page.locator("tr", { hasText: runId }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Опубликовать" }).click();
    await expect(row.getByText("Опубликован")).toBeVisible();
  });

  await test.step("создать тест и добавить вопрос из банка (§18.3)", async () => {
    await page.goto("/admin/tests/new");
    await page.getByLabel("Slug (URL)").fill(TEST_SLUG);
    await page.getByLabel("Предмет").selectOption({ label: "Математика" });
    // «Название (RU)» есть и у секции — берём поля из блока «Основное»
    const main = page.locator("section", { hasText: "Основное" }).first();
    await main.getByLabel("Название (KK)").fill(TEST_TITLE_KK);
    await main.getByLabel("Название (RU)").fill(TEST_TITLE_RU);

    await page.getByRole("button", { name: "+ Добавить из банка" }).click();
    await page.getByPlaceholder("Поиск по тексту…").fill(runId);
    await page.getByRole("button", { name: new RegExp(runId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
    await page.getByRole("button", { name: "Готово" }).click();
    await expect(page.getByText(/Вопросы вручную \(1\)/)).toBeVisible();

    await page.getByRole("button", { name: "Сохранить" }).click();
    await page.waitForURL(/\/admin\/tests\/(?!new)[a-z0-9]+/);
  });

  await test.step("опубликовать тест (§18.4)", async () => {
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByRole("button", { name: "В черновик" })).toBeVisible();
  });

  await test.step("создать и опубликовать челлендж с тестом (§18.5)", async () => {
    await page.goto("/admin/challenges");
    await page.getByRole("button", { name: "+ Челлендж" }).click();
    await page.getByLabel("Slug").fill(CH_SLUG);
    await page.getByLabel("Начало *").fill("2026-07-01T00:00");
    await page.getByLabel("Окончание *").fill("2026-12-31T23:59");
    await page.getByLabel("Название (KK)").fill(`Челлендж Е2Е KK ${runId}`);
    await page.getByLabel("Название (RU)").fill(CH_TITLE_RU);

    await page.getByRole("button", { name: "+ тест" }).click();
    await page.locator("select", { hasText: "— выберите тест —" }).selectOption({ label: TEST_TITLE_RU });
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Новый челлендж")).toBeHidden();

    await page.getByLabel("Поиск").fill(runId);
    await page.getByLabel("Поиск").press("Enter");
    const row = page.locator("tr", { hasText: CH_TITLE_RU }).first();
    await row.getByRole("button", { name: "Опубликовать" }).click();
    await expect(row.getByText("Опубликован")).toBeVisible();
  });
});

test("ученик: регистрируется, участвует, проходит тест, получает баллы (§18.6–8)", async ({ page }) => {
  await loginStudentOtp(page, STUDENT_PHONE, "Айдос");

  await test.step("записаться на челлендж", async () => {
    await page.goto(`/ru/challenges/${CH_SLUG}`);
    await page.getByRole("button", { name: "Участвовать" }).click();
    await expect(page.getByText("Вы участвуете")).toBeVisible();
  });

  await test.step("пройти тест", async () => {
    await page.getByRole("button", { name: "Начать тест" }).first().click();
    await page.waitForURL(/\/ru\/attempt\//);
    await expect(page.getByText(PROMPT_RU)).toBeVisible();
    await page.getByRole("radio", { name: "50" }).check();
    await page.getByRole("button", { name: "Завершить тест" }).last().click();
    await page.getByRole("button", { name: "Подтвердить" }).click();
    await page.waitForURL(/\/result/);
  });

  await test.step("результат и баллы", async () => {
    await expect(page.getByText("Ваш балл")).toBeVisible();
    await expect(page.getByText("Тест пройден")).toBeVisible();
    const dash = await page.request.get("/api/dashboard/student");
    expect(dash.ok()).toBeTruthy();
    const j = await dash.json();
    expect(j.gamification.points).toBeGreaterThan(0);
  });

  await test.step("ученик виден в рейтинге челленджа", async () => {
    await page.goto(`/ru/challenges/${CH_SLUG}`);
    await expect(page.getByText("Рейтинг")).toBeVisible();
    await expect(page.locator("main").getByText(/Айдос/)).toBeVisible();
  });
});

test("админ видит результат и начисленные баллы (§18.9)", async ({ page }) => {
  await loginStaff(page, ADMIN_EMAIL);
  const res = await page.request.get("/api/admin/points?pageSize=50");
  expect(res.ok()).toBeTruthy();
  const j = await res.json();
  const mine = (j.rows as { reason: string; refId?: string; user?: { profile?: { firstName?: string } } }[])
    .filter((r) => r.user?.profile?.firstName === "Айдос");
  expect(mine.length).toBeGreaterThan(0);
});
