"use client";

// Admin UI kit: таблица с серверной пагинацией/поиском/сортировкой/URL-state,
// массовыми действиями, экспортом CSV и подтверждением опасных операций (§12);
// поля форм (в т.ч. двуязычные) и фабрика CRUD-страниц.

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui";

// ——— fetch helpers ———
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? String(res.status));
  return j as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Column {
  key: string;
  title: string;
  render?: (row: Row) => React.ReactNode;
  sortable?: boolean;
  hide?: boolean;
}

export function useListQuery(endpoint: string, extra: Record<string, string> = {}) {
  const sp = useSearchParams();
  const [data, setData] = useState<{ rows: Row[]; total: number; page: number; pageSize: number } | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((x) => x + 1), []);

  const extraKey = JSON.stringify(extra);
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of ["q", "page", "sort", "dir", "status"]) {
      const v = sp.get(k);
      if (v) p.set(k, v);
    }
    for (const [k, v] of Object.entries(JSON.parse(extraKey) as Record<string, string>)) if (v) p.set(k, v);
    return p.toString();
  }, [sp, extraKey]);

  useEffect(() => {
    let alive = true;
    api<{ rows: Row[]; total: number; page: number; pageSize: number }>(`${endpoint}?${qs}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError("");
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [endpoint, qs, tick]);

  return { data, error, reload };
}

export function AdminTable(props: {
  endpoint: string;
  columns: Column[];
  title: string;
  onEdit?: (row: Row) => void;
  onDelete?: (row: Row) => Promise<void>;
  toolbar?: React.ReactNode;
  statusFilter?: string[];
  extra?: Record<string, string>;
  reloadKey?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { data, error, reload } = useListQuery(props.endpoint, props.extra ?? {});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  useEffect(() => {
    if (props.reloadKey !== undefined) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.reloadKey]);

  const setParams = (pairs: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    let dropPage = false;
    for (const [k, v] of Object.entries(pairs)) {
      if (v) next.set(k, v);
      else next.delete(k);
      if (k !== "page") dropPage = true;
    }
    if (dropPage) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  };
  const setParam = (k: string, v: string) => setParams({ [k]: v });

  const exportCsv = () => {
    if (!data) return;
    const esc = (s: unknown) => {
      const v = String(s ?? "");
      return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const cols = props.columns.filter((c) => !c.hide);
    const lines = [cols.map((c) => esc(c.title)).join(";")];
    for (const row of data.rows) {
      lines.push(cols.map((c) => esc(typeof row[c.key] === "object" ? JSON.stringify(row[c.key]) : row[c.key])).join(";"));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "export.csv";
    a.click();
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const page = Number(sp.get("page") ?? 1);
  const sort = sp.get("sort");
  const dir = sp.get("dir") ?? "asc";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-64"
          placeholder="Поиск…"
          defaultValue={sp.get("q") ?? ""}
          aria-label="Поиск"
          onKeyDown={(e) => e.key === "Enter" && setParam("q", (e.target as HTMLInputElement).value)}
        />
        {props.statusFilter && (
          <select className="input max-w-48" value={sp.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} aria-label="Статус">
            <option value="">Все статусы</option>
            {props.statusFilter.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && props.onDelete && (
            <button className="btn-outline !border-red-300 !text-red-600" onClick={() => setConfirmBulk(true)}>
              Удалить ({selected.size})
            </button>
          )}
          <button className="btn-outline" onClick={exportCsv}>⬇ CSV</button>
          {props.toolbar}
        </div>
      </div>

      {error && <p role="alert" className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">Ошибка: {error}</p>}
      {!data && !error && <div className="skeleton h-48 w-full" />}

      {data && (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  {props.onDelete && <th className="w-8 px-3 py-2.5" aria-label="Выбор" />}
                  {props.columns.filter((c) => !c.hide).map((c) => (
                    <th key={c.key} className="px-3 py-2.5">
                      {c.sortable ? (
                        <button
                          className="font-bold uppercase hover:underline"
                          onClick={() => setParams({ sort: c.key, dir: sort === c.key && dir === "asc" ? "desc" : "asc" })}
                        >
                          {c.title} {sort === c.key ? (dir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      ) : (
                        c.title
                      )}
                    </th>
                  ))}
                  {(props.onEdit || props.onDelete) && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={99} className="px-3 py-8 text-center text-slate-400">Пусто</td>
                  </tr>
                )}
                {data.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {props.onDelete && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label="Выбрать строку"
                          checked={selected.has(row.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                    )}
                    {props.columns.filter((c) => !c.hide).map((c) => (
                      <td key={c.key} className="px-3 py-2 align-top">
                        {c.render ? c.render(row) : String(row[c.key] ?? "")}
                      </td>
                    ))}
                    {(props.onEdit || props.onDelete) && (
                      <td className="px-3 py-2 text-right">
                        {props.onEdit && (
                          <button className="btn-ghost !px-2 !py-1" onClick={() => props.onEdit!(row)} aria-label="Редактировать">✏️</button>
                        )}
                        {props.onDelete && (
                          <button className="btn-ghost !px-2 !py-1 text-red-500" onClick={() => setConfirmRow(row)} aria-label="Удалить">🗑️</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>Всего: {data.total}</span>
            <div className="flex items-center gap-1">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>←</button>
              <span>{page}/{pages}</span>
              <button className="btn-ghost" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>→</button>
            </div>
          </div>
        </>
      )}

      <Modal open={!!confirmRow} onClose={() => setConfirmRow(null)} title="Подтвердите удаление">
        <p>Действие необратимо (или переводит запись в архив). Продолжить?</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setConfirmRow(null)}>Отмена</button>
          <button
            className="btn-primary !bg-red-600"
            onClick={async () => {
              if (confirmRow && props.onDelete) await props.onDelete(confirmRow);
              setConfirmRow(null);
              reload();
            }}
          >
            Удалить
          </button>
        </div>
      </Modal>
      <Modal open={confirmBulk} onClose={() => setConfirmBulk(false)} title={`Удалить ${selected.size} записей?`}>
        <div className="mt-2 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setConfirmBulk(false)}>Отмена</button>
          <button
            className="btn-primary !bg-red-600"
            onClick={async () => {
              if (props.onDelete && data) {
                for (const row of data.rows.filter((r) => selected.has(r.id))) await props.onDelete(row);
              }
              setSelected(new Set());
              setConfirmBulk(false);
              reload();
            }}
          >
            Удалить все
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ——— Поля форм ———

export function Field(p: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{p.label}</span>
      {p.children}
      {p.hint && <span className="mt-1 block text-xs text-slate-400">{p.hint}</span>}
    </label>
  );
}

export function Bilingual(p: {
  label: string;
  kk: string;
  ru: string;
  onKk: (v: string) => void;
  onRu: (v: string) => void;
  area?: boolean;
  rows?: number;
}) {
  const C = p.area ? "textarea" : "input";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${p.label} (KK)`}>
        <C className="input resize-y" rows={p.rows ?? 3} value={p.kk} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => p.onKk(e.target.value)} />
      </Field>
      <Field label={`${p.label} (RU)`}>
        <C className="input resize-y" rows={p.rows ?? 3} value={p.ru} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => p.onRu(e.target.value)} />
      </Field>
    </div>
  );
}

export function I18nBadge({ kk, ru }: { kk: boolean; ru: boolean }) {
  return (
    <span className="inline-flex gap-1" title="Готовность перевода">
      <span className={`chip ${kk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>KK</span>
      <span className={`chip ${ru ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>RU</span>
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-200 text-slate-600",
    REVIEW: "bg-sky-100 text-sky-700",
    PUBLISHED: "bg-emerald-100 text-emerald-700",
    ARCHIVED: "bg-amber-100 text-amber-700",
  };
  const label: Record<string, string> = { DRAFT: "Черновик", REVIEW: "На проверке", PUBLISHED: "Опубликован", ARCHIVED: "Архив" };
  return <span className={`chip ${map[status] ?? "bg-slate-100"}`}>{label[status] ?? status}</span>;
}

export function StatusButtons(p: { entity: string; id: string; status: string; onDone: () => void }) {
  const set = async (status: string) => {
    try {
      await api("/api/admin/status", { method: "POST", body: JSON.stringify({ entity: p.entity, id: p.id, status }) });
      p.onDone();
    } catch (e) {
      alert(e instanceof Error && e.message === "i18n_incomplete"
        ? "Публикация запрещена: заполните обязательный контент на обоих языках (KK и RU)."
        : `Ошибка: ${e instanceof Error ? e.message : ""}`);
    }
  };
  return (
    <div className="flex flex-wrap gap-1">
      {p.status !== "PUBLISHED" && (
        <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => set("PUBLISHED")}>Опубликовать</button>
      )}
      {p.status === "DRAFT" && (
        <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => set("REVIEW")}>На проверку</button>
      )}
      {p.status === "PUBLISHED" && (
        <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => set("DRAFT")}>В черновик</button>
      )}
      {p.status !== "ARCHIVED" && (
        <button className="btn-ghost !px-2 !py-1.5 text-xs text-amber-600" onClick={() => set("ARCHIVED")}>Архив</button>
      )}
    </div>
  );
}
