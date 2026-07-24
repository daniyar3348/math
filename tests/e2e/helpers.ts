import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@bilimhub.local";
export const TEACHER_EMAIL = "teacher@bilimhub.local";
export const DEV_PASSWORD = "Bilim2026!";

/** Вход сотрудника через UI (вкладка «Сотрудник / родитель»). */
export async function loginStaff(page: Page, email: string, expectAdmin = true) {
  await page.goto("/ru/login");
  await page.getByRole("tab", { name: /Сотрудник/ }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  if (expectAdmin) await page.waitForURL(/\/admin/);
  else await page.waitForURL(/\/dashboard/);
}

/**
 * Вход/регистрация ученика по телефону + OTP.
 * Dev-провайдер SMS показывает код прямо на странице.
 */
export async function loginStudentOtp(page: Page, phone: string, firstName = "Айдос") {
  await page.goto("/ru/login");
  await page.locator("#phone").fill(phone);
  await page.getByRole("button", { name: /Получить код|Код алу/ }).click();
  const codeEl = page.locator("code").first();
  await expect(codeEl).toBeVisible();
  const code = (await codeEl.textContent())!.trim();
  await page.locator("#otp").fill(code);
  const fn = page.locator("#fn");
  if (await fn.isVisible().catch(() => false)) {
    await fn.fill(firstName);
  }
  await page.getByRole("button", { name: /Подтвердить|Растау/ }).click();
  await page.waitForURL(/\/dashboard/);
}

/** Уникальный суффикс прогона — сценарии можно запускать многократно. */
export const runId = `e2e${Date.now().toString(36)}`;
