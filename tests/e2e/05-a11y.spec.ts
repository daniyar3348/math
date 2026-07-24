// Accessibility smoke (§15/§18): axe-core на ключевых публичных страницах.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/kk", "/ru/login", "/ru/challenges", "/ru/challenges/matematika-marafon"];

for (const path of PAGES) {
  test(`axe: ${path} — без критических нарушений`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious, serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`).join("\n")).toEqual([]);
  });
}

test("скелет доступности: skip-link, lang, заголовок, фокус", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.locator("a.skip-link, [href='#main']").first()).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("h1")).toHaveCount(1);
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBeTruthy();
});
