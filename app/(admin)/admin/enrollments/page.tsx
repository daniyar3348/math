"use client";

// Записи на курсы (§7): просмотр, ручная запись администратором, смена статуса.
import { Suspense, useEffect, useState } from "react";
import { AdminTable, api, Field, type Row } from "@/components/admin/kit";
import { Modal } from "@/components/ui";

const STATUS_RU: Record<string, string> = { ACTIVE: "Активна", COMPLETED: "Завершена", DROPPED: "Отчислен" };

function Inner() {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<{ id?: string; userId: string; courseId: string; status: string }>({ userId: "", courseId: "", status: "ACTIVE" });
  const [courses, setCourses] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api<{ rows: Row[] }>("/api/admin/courses?pageSize=100").then((x) => setCourses(x.rows)).catch(() => {});
  }, []);

  const save = async () => {
    setError("");
    try {
      const payload = { userId: d.userId.trim(), courseId: d.courseId, status: d.status };
      if (d.id) await api(`/api/admin/enrollments/${d.id}`, { method: "PUT", body: JSON.stringify({ status: d.status }) });
      else await api("/api/admin/enrollments", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Записи на курсы</h1>
        <button className="btn-primary !py-2" onClick={() => { setD({ userId: "", courseId: "", status: "ACTIVE" }); setError(""); setOpen(true); }}>
          + Записать ученика
        </button>
      </div>
      <AdminTable
        endpoint="/api/admin/enrollments"
        title="Записи"
        reloadKey={reloadKey}
        columns={[
          { key: "user", title: "Ученик", render: (r) => r.user?.profile?.displayName || r.user?.email || r.user?.phone || r.userId },
          { key: "course", title: "Курс", render: (r) => (r.course?.translations as Row[])?.find((t) => t.locale === "ru")?.title || r.course?.slug },
          { key: "progressPct", title: "Прогресс", render: (r) => `${r.progressPct ?? 0}%` },
          { key: "status", title: "Статус", render: (r) => STATUS_RU[r.status as string] ?? r.status },
          { key: "createdAt", title: "Дата", render: (r) => new Date(r.createdAt).toLocaleDateString("ru-RU") },
        ]}
        onEdit={(r) => { setD({ id: r.id, userId: r.userId, courseId: r.courseId, status: r.status }); setError(""); setOpen(true); }}
        onDelete={async (r) => { await api(`/api/admin/enrollments/${r.id}`, { method: "DELETE" }); }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={d.id ? "Статус записи" : "Записать ученика"}>
        <div className="space-y-3">
          {!d.id && (
            <>
              <Field label="ID ученика" hint="Скопируйте из раздела «Пользователи»">
                <input className="input" value={d.userId} onChange={(e) => setD({ ...d, userId: e.target.value })} />
              </Field>
              <Field label="Курс">
                <select className="input" value={d.courseId} onChange={(e) => setD({ ...d, courseId: e.target.value })}>
                  <option value="">— выберите курс —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{(c.translations as Row[])?.find((t) => t.locale === "ru")?.title || c.slug}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Статус">
            <select className="input" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>
              {Object.entries(STATUS_RU).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={save} disabled={!d.id && (!d.userId || !d.courseId)}>Сохранить</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
