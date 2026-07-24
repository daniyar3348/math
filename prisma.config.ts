import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Подключение для CLI-команд (migrate / studio). Рантайм-клиент получает
  // соединение через driver adapter в lib/db.ts.
  datasource: {
    // Фолбэк нужен только чтобы `prisma generate` работал без .env
    // (postinstall на чистом клоне/CI); реальные команды требуют env.
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5433/bilimhub",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
