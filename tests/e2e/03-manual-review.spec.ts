// Ручная проверка развёрнутого ответа (§18.10): ученик сдаёт эссе в сид-тесте,
// администратор оценивает через очередь, результат ученика обновляется.
import { test, expect } from "@playwright/test";
import { loginStaff, loginStudentOtp, ADMIN_EMAIL } from "./helpers";

test.describe.configure({ mode: "serial" });

const PHONE = `+7702${String(Date.now()).slice(-7)}`;
const ESSAY_TEXT = "Скидка 20% на товар за 800 тенге экономит 160 тенге — проценты нужны каждый день.";
let resultUrl = "";

test("ученик отвечает на эссе в сид-тесте и сдаёт", async ({ page }) => {
  await loginStudentOtp(page, PHONE, "Дана");
  await page.goto("/ru/tests/procenty-bekitu");
  await page.getByRole("button", { name: /Начать тест|Продолжить попытку/ }).click();
  await page.waitForURL(/\/ru\/attempt\//);

  // Ждём загрузку попытки (runner тянет состояние с сервера), затем ищем
  // вопрос-эссе по навигации: единственный с textarea
  const navRoot = page.getByRole("navigation", { name: "Вопрос" });
  await navRoot.waitFor({ timeout: 15000 });
  const nav = navRoot.getByRole("button");
  const count = await nav.count();
  let found = false;
  for (let i = 0; i < count; i++) {
    await nav.nth(i).click();
    const area = page.locator("main textarea, form textarea").first();
    if (await area.isVisible().catch(() => false)) {
      await area.fill(ESSAY_TEXT);
      found = true;
      break;
    }
  }
  expect(found).toBeTruthy();

  await page.getByRole("button", { name: "Завершить тест" }).last().click();
  await expect(page.getByText(/неотвеченные/)).toBeVisible(); // предупреждение (§8)
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await page.waitForURL(/\/result/);
  await expect(page.getByText("Ожидает ручной проверки")).toBeVisible();
  resultUrl = page.url();
});

test("администратор оценивает эссе в очереди проверки", async ({ page }) => {
  await loginStaff(page, ADMIN_EMAIL);
  await page.goto("/admin/review");
  const row = page.locator("tr", { hasText: "PENDING" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText(ESSAY_TEXT.slice(0, 30))).toBeVisible();
  await page.getByLabel(/^Балл/).fill("4");
  await page.getByLabel("Комментарий ученику").fill("Хороший практичный пример.");
  await page.getByRole("button", { name: "Выставить" }).click();
  await expect(page.getByText(ESSAY_TEXT.slice(0, 30))).toBeHidden();
});

test("ученик видит обновлённый результат без пометки ручной проверки", async ({ page }) => {
  await loginStudentOtp(page, PHONE);
  await page.goto(resultUrl);
  await expect(page.getByText("Ваш балл")).toBeVisible();
  await expect(page.getByText("Ожидает ручной проверки")).toHaveCount(0);
});
