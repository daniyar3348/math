// Публичная часть (§6/§5): лендинг, SEO, переключение языка, фильтры каталога.
import { test, expect } from "@playwright/test";

test("лендинг: редирект на язык по умолчанию, hero, SEO-метаданные", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(kk|ru)$/);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", /kk|ru/);
  // hreflang-альтернативы и canonical (§5)
  await expect(page.locator('link[rel="alternate"][hreflang="kk"]')).toHaveCount(1);
  await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveCount(1);
  await expect(page).toHaveTitle(/.+/);
});

test("переключение языка сохраняет страницу и меняет lang (§18.11)", async ({ page }) => {
  await page.goto("/ru/challenges/matematika-marafon");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  const h1ru = (await page.locator("h1").first().textContent())!.trim();
  expect(h1ru.length).toBeGreaterThan(3);

  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "kk" }).click();
  await page.waitForURL(/\/kk\/challenges\/matematika-marafon/);
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  // авто-ожидание: после client-side перехода заголовок реально казахский
  await expect(page.locator("h1").first()).not.toHaveText(h1ru);
  await expect(page.locator("h1").first()).toHaveText("Математикалық марафон");
});

test("каталог челленджей: фильтры пишутся в URL, карточки ведут на /challenges/[slug]", async ({ page }) => {
  await page.goto("/ru/challenges");
  await expect(page.locator("h1")).toBeVisible();

  await page.locator("#f-price").selectOption("free");
  await expect(page).toHaveURL(/price=free/);
  const freeCard = page.locator('a[href*="/ru/challenges/matematika-marafon"]').first();
  await expect(freeCard).toBeVisible();

  // платный при фильтре «бесплатные» скрыт
  await expect(page.locator('a[href*="/ru/challenges/olimp-daiyndyq"]')).toHaveCount(0);

  await page.locator("#f-price").selectOption("paid");
  await expect(page).toHaveURL(/price=paid/);
  await expect(page.locator('a[href*="/ru/challenges/olimp-daiyndyq"]').first()).toBeVisible();
});

test("каталог курсов открывается и показывает карточки", async ({ page }) => {
  await page.goto("/ru/courses");
  await expect(page.locator('a[href*="/ru/courses/procenty-praktika"]').first()).toBeVisible();
});
