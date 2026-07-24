import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Интеграционные тесты используют отдельную PG-схему (D-011) и общий
    // Prisma-клиент — гоняем файлы последовательно, чтобы не конфликтовать.
    fileParallelism: false,
    setupFiles: ["tests/setup-env.ts"],
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
