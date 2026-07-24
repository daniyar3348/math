// HTTP-хелперы API: единый формат ошибок, zod-парсинг (анти-mass-assignment),
// пагинация. Все route handlers пользуются только этим слоем.

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export const err = {
  badRequest: (code = "bad_request") => new ApiError(code, 400),
  unauthorized: () => new ApiError("unauthorized", 401),
  forbidden: () => new ApiError("forbidden", 403),
  notFound: () => new ApiError("not_found", 404),
  conflict: (code = "conflict") => new ApiError(code, 409),
  tooMany: () => new ApiError("rate_limited", 429),
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

/** Обёртка handler'а: ловит ApiError/ZodError → единый JSON {error}. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handler<A extends any[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.code }, { status: e.status });
      }
      if (e && typeof e === "object" && "issues" in (e as object)) {
        // ZodError → 400 с первым полем
        const issues = (e as { issues: { path: (string | number)[]; message: string }[] }).issues;
        return NextResponse.json(
          { error: "validation", details: issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) },
          { status: 400 }
        );
      }
      console.error("[api:unhandled]", e);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }
  };
}

/** Строгий парс тела: только описанные поля (mass assignment исключён). */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => {
    throw err.badRequest("bad_json");
  });
  return schema.parse(raw);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (obj[k] = v));
  return schema.parse(obj);
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function pageArgs(page: number, pageSize: number) {
  const size = Math.min(Math.max(pageSize, 1), 100);
  const p = Math.max(page, 1);
  return { skip: (p - 1) * size, take: size, page: p, pageSize: size };
}

export function clientIp(req: Request): string {
  const h = (name: string) => (req.headers.get(name) ?? "").split(",")[0].trim();
  return h("x-forwarded-for") || h("x-real-ip") || "local";
}
