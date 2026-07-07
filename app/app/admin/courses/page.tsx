"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, post, put, del } from "@/lib/api";
import { Field, Area, AdminSection, DangerBtn } from "@/components/admin";
import { Spinner } from "@/components/ui";

interface CourseRow {
  id: string;
  school: string;
  title_kk: string;
  title_ru: string;
  description_kk: string;
  description_ru: string;
  level_kk: string;
  level_ru: string;
  price_kzt: number;
  cover: string;
  sort: number;
  published: number;
}

const EMPTY: Omit<CourseRow, "id"> = {
  school: "bil",
  title_kk: "",
  title_ru: "",
  description_kk: "",
  description_ru: "",
  level_kk: "5–6 сынып",
  level_ru: "5–6 класс",
  price_kzt: 0,
  cover: "📘",
  sort: 0,
  published: 1,
};

export default function AdminCourses() {
  const [rows, setRows] = useState<CourseRow[] | null>(null);
  const [editing, setEditing] = useState<CourseRow | (typeof EMPTY & { id?: string }) | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ rows: CourseRow[] }>("/api/admin/courses").then((d) => setRows(d.rows));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const { id, ...fields } = editing as CourseRow;
      if (id) await put(`/api/admin/courses/${id}`, fields);
      else await post("/api/admin/courses", fields);
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить курс со всеми уроками и челленджами?")) return;
    await del(`/api/admin/courses/${id}`);
    load();
  };

  if (!rows) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Курсы</h1>
        <button className="btn-brand !py-2" onClick={() => setEditing({ ...EMPTY })}>
          + Новый курс
        </button>
      </div>

      {editing && (
        <AdminSection
          title={"id" in editing && editing.id ? "Редактировать курс" : "Новый курс"}
          action={
            <button className="btn-ghost !py-1.5" onClick={() => setEditing(null)}>
              ✕
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Школа</span>
              <select
                value={editing.school}
                onChange={(e) => setEditing({ ...editing, school: e.target.value })}
                className="input mt-1"
              >
                <option value="bil">БИЛ</option>
                <option value="nish">НИШ</option>
                <option value="ktl">КТЛ</option>
              </select>
            </label>
            <Field
              label="Обложка (emoji)"
              value={editing.cover}
              onChange={(v) => setEditing({ ...editing, cover: v })}
            />
            <Field
              label="Название (KK)"
              value={editing.title_kk}
              onChange={(v) => setEditing({ ...editing, title_kk: v })}
            />
            <Field
              label="Название (RU)"
              value={editing.title_ru}
              onChange={(v) => setEditing({ ...editing, title_ru: v })}
            />
            <Area
              label="Описание (KK)"
              value={editing.description_kk}
              onChange={(v) => setEditing({ ...editing, description_kk: v })}
            />
            <Area
              label="Описание (RU)"
              value={editing.description_ru}
              onChange={(v) => setEditing({ ...editing, description_ru: v })}
            />
            <Field
              label="Уровень (KK)"
              value={editing.level_kk}
              onChange={(v) => setEditing({ ...editing, level_kk: v })}
            />
            <Field
              label="Уровень (RU)"
              value={editing.level_ru}
              onChange={(v) => setEditing({ ...editing, level_ru: v })}
            />
            <Field
              label="Цена, ₸ (0 = бесплатный)"
              type="number"
              value={editing.price_kzt}
              onChange={(v) => setEditing({ ...editing, price_kzt: Number(v) || 0 })}
            />
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={!!editing.published}
                onChange={(e) =>
                  setEditing({ ...editing, published: e.target.checked ? 1 : 0 })
                }
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="text-sm font-semibold text-slate-600">Опубликован</span>
            </label>
          </div>
          <button onClick={save} disabled={busy} className="btn-brand mt-4 !py-2.5">
            {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </AdminSection>
      )}

      <div className="card divide-y divide-slate-100">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-2xl">{c.cover}</span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/courses/${c.id}`}
                className="font-semibold text-slate-800 hover:text-brand"
              >
                {c.title_ru}
              </Link>
              <div className="text-xs text-slate-400">
                {c.school.toUpperCase()} ·{" "}
                {c.price_kzt > 0 ? `${c.price_kzt.toLocaleString("ru-RU")} ₸` : "бесплатно"}
                {!c.published && " · 🚫 скрыт"}
              </div>
            </div>
            <Link href={`/admin/courses/${c.id}`} className="btn-outline !px-3 !py-1.5 text-xs">
              Уроки и челленджи
            </Link>
            <button
              onClick={() => setEditing(c)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              ✏️
            </button>
            <DangerBtn onClick={() => remove(c.id)}>Удалить</DangerBtn>
          </div>
        ))}
      </div>
    </div>
  );
}
