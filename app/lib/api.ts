// Tiny client-side fetch helper. Throws ApiError with the server's error code.

export class ApiError extends Error {
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.status = status;
  }
}

// В демо-сборке (GitHub Pages, NEXT_PUBLIC_DEMO=1) все вызовы уходят в
// браузерный демо-бэкенд (lib/demo.ts) вместо сети. В обычной сборке эта
// ветка вырезается бандлером (env инлайнится) — demo-код в бандл не попадает.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (IS_DEMO) {
    const { demoFetch } = await import("./demo");
    return demoFetch(path, init) as Promise<T>;
  }
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.error ?? String(res.status), res.status);
  return json as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

export const put = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });

export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
