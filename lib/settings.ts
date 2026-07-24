// Настройки сайта (бренд/цвета/контакты/лендинг) с кэшем на 30 секунд.
import { prisma } from "./db";

export interface Settings {
  brandName: string;
  logoFileId: string | null;
  primaryColor: string;
  accentColor: string;
  contacts: { phone?: string; email?: string; address?: { kk?: string; ru?: string } };
  landing: Record<string, unknown>;
}

let cache: { value: Settings; at: number } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const row = await prisma.siteSettings.findFirst();
  const value: Settings = {
    brandName: row?.brandName ?? "BilimHub",
    logoFileId: row?.logoFileId ?? null,
    primaryColor: row?.primaryColor ?? "#6d28d9",
    accentColor: row?.accentColor ?? "#f59e0b",
    contacts: (row?.contacts as Settings["contacts"]) ?? {},
    landing: (row?.landing as Record<string, unknown>) ?? {},
  };
  cache = { value, at: Date.now() };
  return value;
}

export function invalidateSettingsCache() {
  cache = null;
}

/** Затемнение hex-цвета для hover-состояния. */
export function darken(hex: string, k = 0.85): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
