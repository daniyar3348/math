// Сессии: httpOnly cookies, короткий access (15 мин) + refresh (30 дней)
// с one-time ротацией и детекцией повторного использования (кража токена →
// все сессии пользователя завершаются). См. docs/decisions.md D-006.

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const ACCESS_COOKIE = "bh_access";
export const REFRESH_COOKIE = "bh_refresh";
const ACCESS_TTL_MS = 15 * 60_000;
const REFRESH_TTL_MS = 30 * 24 * 3600_000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("hex");

function cookieOpts(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export async function createSession(userId: string, ip: string, userAgent: string) {
  const access = newToken();
  const refresh = newToken();
  const now = Date.now();
  await prisma.session.create({
    data: {
      userId,
      accessTokenHash: sha(access),
      refreshTokenHash: sha(refresh),
      accessExpiresAt: new Date(now + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
      ip: ip.slice(0, 64),
      userAgent: userAgent.slice(0, 256),
    },
  });
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, access, cookieOpts(REFRESH_TTL_MS));
  jar.set(REFRESH_COOKIE, refresh, cookieOpts(REFRESH_TTL_MS));
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (access) {
    await prisma.session.updateMany({
      where: { accessTokenHash: sha(access) },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * Возвращает userId активной сессии.
 * Если access истёк — пробует refresh с ротацией; повторное использование
 * старого refresh = компрометация → revoke всех сессий.
 */
export async function resolveSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  const now = new Date();

  if (access) {
    const s = await prisma.session.findUnique({ where: { accessTokenHash: sha(access) } });
    if (s && !s.revokedAt && s.accessExpiresAt > now) {
      // редкое обновление lastUsedAt, чтобы не писать на каждый запрос
      if (now.getTime() - s.lastUsedAt.getTime() > 60_000) {
        prisma.session.update({ where: { id: s.id }, data: { lastUsedAt: now } }).catch(() => {});
      }
      return s.userId;
    }
  }

  if (!refresh) return null;
  const rHash = sha(refresh);
  const s = await prisma.session.findUnique({ where: { refreshTokenHash: rHash } });

  if (!s) {
    // возможно, это уже ротированный (старый) refresh → детекция кражи
    const reused = await prisma.session.findFirst({ where: { rotatedFromHash: rHash, revokedAt: null } });
    if (reused) await revokeAllSessions(reused.userId);
    return null;
  }
  if (s.revokedAt || s.refreshExpiresAt <= now) return null;

  // Ротация: новые access+refresh, старый refresh сохраняем для детекции reuse.
  // Сначала пишем cookies: в Server Component запись запрещена (Next бросает) —
  // тогда работаем в peek-режиме БЕЗ ротации, иначе браузер остался бы со
  // старым refresh и следующий запрос сработал бы как «кража токена».
  // Полноценная ротация выполнится в ближайшем Route Handler (любой /api).
  const nAccess = newToken();
  const nRefresh = newToken();
  try {
    jar.set(ACCESS_COOKIE, nAccess, cookieOpts(REFRESH_TTL_MS));
    jar.set(REFRESH_COOKIE, nRefresh, cookieOpts(REFRESH_TTL_MS));
  } catch {
    return s.userId; // read-only контекст (RSC): доступ по действующему refresh
  }
  await prisma.session.update({
    where: { id: s.id },
    data: {
      accessTokenHash: sha(nAccess),
      refreshTokenHash: sha(nRefresh),
      rotatedFromHash: rHash,
      accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_MS),
      refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      lastUsedAt: now,
    },
  });
  return s.userId;
}
