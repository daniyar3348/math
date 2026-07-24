// Выполняется ДО импорта тестируемых модулей: переключаем Prisma на тестовую
// схему (D-011), чтобы интеграционные тесты не трогали dev-данные.
import "dotenv/config";

if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
process.env.APP_SECRET = process.env.APP_SECRET || "test-secret-not-for-prod";
