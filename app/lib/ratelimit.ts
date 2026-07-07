// Rate limiter, персистентный в SQLite (rate_events): переживает рестарты и
// работает при нескольких процессах на одной БД.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "./db";

let callCounter = 0;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const d = db();
  d.prepare("DELETE FROM rate_events WHERE key = ? AND ts < ?").run(key, now - windowMs);
  const { n } = d
    .prepare("SELECT COUNT(*) AS n FROM rate_events WHERE key = ?")
    .get(key) as { n: number };
  if (n >= limit) return false;
  d.prepare("INSERT INTO rate_events (key, ts) VALUES (?,?)").run(key, now);

  // Редкая глобальная уборка, чтобы таблица не росла от «мертвых» ключей.
  if (++callCounter % 500 === 0) {
    d.prepare("DELETE FROM rate_events WHERE ts < ?").run(now - 24 * 3600 * 1000);
  }
  return true;
}

export function clientIp(req: NextRequest): string {
  // Behind Caddy the client IP arrives in X-Forwarded-For.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function tooManyRequests() {
  return NextResponse.json({ error: "rate_limited" }, { status: 429 });
}
