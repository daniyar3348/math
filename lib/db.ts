// Prisma 7 client (driver adapter → pg). Единственная точка подключения к БД.
// Параметр ?schema=X из DATABASE_URL передаётся адаптеру явно: драйвер pg,
// в отличие от нативного коннектора Prisma, сам его не понимает — без этого
// тесты с DATABASE_URL_TEST (?schema=test) попадали бы в public.
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  // Фолбэк — только чтобы импорт модуля не падал при сборке без .env
  // (docker build/CI): соединение в этот момент не открывается. В рантайме
  // env обязателен и задаётся окружением.
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost:5433/bilimhub");
  const schema = url.searchParams.get("schema") ?? undefined;
  url.searchParams.delete("schema");
  const adapter = new PrismaPg({ connectionString: url.toString() }, schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
