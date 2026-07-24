// Rate limiter, персистентный в Postgres (переживает рестарты, общий между инстансами).
import { prisma } from "./db";
import { err } from "./http";

let calls = 0;

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const now = Date.now();
  await prisma.rateEvent.deleteMany({ where: { key, ts: { lt: BigInt(now - windowMs) } } });
  const n = await prisma.rateEvent.count({ where: { key } });
  if (n >= limit) throw err.tooMany();
  await prisma.rateEvent.create({ data: { key, ts: BigInt(now) } });
  if (++calls % 500 === 0) {
    await prisma.rateEvent.deleteMany({ where: { ts: { lt: BigInt(now - 24 * 3600_000) } } });
  }
}
