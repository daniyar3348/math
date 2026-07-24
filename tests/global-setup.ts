// Применяет миграции к тестовой PG-схеме перед прогоном (D-011).
// migrate deploy недеструктивен и заодно проверяет, что миграции
// проходят на чистой БД (§21).
import "dotenv/config";
import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    console.warn("DATABASE_URL_TEST не задан — интеграционные тесты будут падать");
    return;
  }
  execSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
    cwd: process.cwd(),
  });
}
