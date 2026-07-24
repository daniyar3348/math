// RBAC на сервере (§3/§18.12–13): ученик не открывает admin API,
// преподаватель не меняет системные роли.
import { test, expect } from "@playwright/test";
import { loginStaff, loginStudentOtp, TEACHER_EMAIL } from "./helpers";

const PHONE = `+7703${String(Date.now()).slice(-7)}`;

test("ученик: admin API запрещён, /admin недоступен (§18.12)", async ({ page }) => {
  await loginStudentOtp(page, PHONE, "Санжар");

  for (const url of ["/api/admin/users", "/api/admin/questions", "/api/admin/settings", "/api/admin/stats"]) {
    const res = await page.request.get(url);
    expect(res.status(), url).toBe(403);
  }
  const post = await page.request.post("/api/admin/status", {
    data: { entity: "test", id: "whatever", status: "PUBLISHED" },
  });
  expect(post.status()).toBe(403);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Доступ только для персонала" })).toBeVisible();
  await expect(page.getByRole("link", { name: "📊 Dashboard" })).toHaveCount(0);
});

test("преподаватель: не может управлять пользователями и ролями (§18.13)", async ({ page }) => {
  await loginStaff(page, TEACHER_EMAIL, false);

  const list = await page.request.get("/api/admin/users");
  expect(list.status()).toBe(403);

  const action = await page.request.post("/api/admin/users/actions", {
    data: { userId: "any", action: "set_roles", roles: ["ADMIN"] },
  });
  expect(action.status()).toBe(403);

  // а очередь ручной проверки преподавателю доступна
  const queue = await page.request.get("/api/review/queue");
  expect(queue.status()).toBe(200);
});

test("гость: приватные API требуют входа", async ({ request }) => {
  for (const url of ["/api/dashboard/student", "/api/notifications", "/api/admin/users"]) {
    const res = await request.get(url);
    expect([401, 403]).toContain(res.status());
  }
});
