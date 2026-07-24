"use client";

// Курсы: список + создание/редактирование ядра; структура (модули/уроки/
// задания) — на странице курса.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AdminTable, api, Field, Bilingual, StatusChip, StatusButtons, type Row } from "@/components/admin/kit";
import { Modal } from "@/components/ui";

interface Draft {
  id?: string;
  slug: string; subjectId: string; gradeLevelId: string; level: string;
  accessType: string; priceKzt: string;
  sequential: boolean; selfEnroll: boolean; certificateEnabled: boolean;
  titleKk: string; titleRu: string; descriptionKk: string; descriptionRu: string;
  teacherUserIds: string;
}

const empty = (): Draft => ({
  slug: "", subjectId: "", gradeLevelId: "", level: "",
  accessType: "FREE", priceKzt: "",
  sequential: false, selfEnroll: true, certificateEnabled: true,
  titleKk: "", titleRu: "", descriptionKk: "", descriptionRu: "",
  teacherUserIds: "",
});

function Inner() {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(empty());
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api<{ rows: Row[] }>("/api/admin/subjects?pageSize=100").then((x) => setSubjects(x.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/gradeLevels?pageSize=100").then((x) => setGrades(x.rows)).catch(() => {});
  }, []);

  const startEdit = async (row: Row) => {
    const { row: full } = await api<{ row: Row }>(`/api/admin/courses/${row.id}`);
    const tr = (l: string) => (full.translations as Row[]).find((t) => t.locale === l);
    setD({
      id: full.id,
      slug: full.slug,
      subjectId: full.subjectId ?? "",
      gradeLevelId: full.gradeLevelId ?? "",
      level: full.level ?? "",
      accessType: full.accessType,
      priceKzt: full.priceKzt != null ? String(full.priceKzt) : "",
      sequential: full.sequential,
      selfEnroll: full.selfEnroll,
      certificateEnabled: full.certificateEnabled,
      titleKk: tr("kk")?.title ?? "", titleRu: tr("ru")?.title ?? "",
      descriptionKk: tr("kk")?.description ?? "", descriptionRu: tr("ru")?.description ?? "",
      teacherUserIds: ((full.teachers as Row[]) ?? []).map((t) => t.userId).join(", "),
    });
    setError("");
    setOpen(true);
  };

  const save = async () => {
    setError("");
    try {
      const payload = {
        slug: d.slug,
        subjectId: d.subjectId,
        gradeLevelId: d.gradeLevelId || null,
        level: d.level,
        accessType: d.accessType,
        priceKzt: d.priceKzt ? Number(d.priceKzt) : null,
        sequential: d.sequential,
        selfEnroll: d.selfEnroll,
        certificateEnabled: d.certificateEnabled,
        titleKk: d.titleKk, titleRu: d.titleRu,
        descriptionKk: d.descriptionKk, descriptionRu: d.descriptionRu,
        seoTitleKk: d.titleKk.slice(0, 200), seoTitleRu: d.titleRu.slice(0, 200),
        seoDescriptionKk: d.descriptionKk.slice(0, 300), seoDescriptionRu: d.descriptionRu.slice(0, 300),
        teacherUserIds: d.teacherUserIds.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (d.id) await api(`/api/admin/courses/${d.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/admin/courses", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Курсы</h1>
        <button className="btn-primary !py-2" onClick={() => { setD(empty()); setError(""); setOpen(true); }}>+ Курс</button>
      </div>
      <AdminTable
        endpoint="/api/admin/courses"
        title="Курсы"
        reloadKey={reloadKey}
        statusFilter={["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]}
        columns={[
          {
            key: "translations",
            title: "Название",
            render: (r) => (
              <Link className="font-semibold hover:underline" href={`/admin/courses/${r.id}`}>
                {(r.translations as Row[])?.find((t) => t.locale === "ru")?.title || r.slug}
              </Link>
            ),
          },
          { key: "subject", title: "Предмет", render: (r) => r.subject?.nameRu ?? "" },
          { key: "accessType", title: "Доступ", render: (r) => (r.accessType === "FREE" ? "Бесплатный" : `${r.priceKzt} ₸`) },
          { key: "_count", title: "Учеников", render: (r) => r._count?.enrollments ?? 0 },
          { key: "modules", title: "Модулей", render: (r) => r._count?.modules ?? 0 },
          { key: "status", title: "Статус", render: (r) => <StatusChip status={r.status} /> },
          {
            key: "id",
            title: "",
            render: (r) => (
              <div className="flex items-center gap-1">
                <Link className="btn-outline !px-3 !py-1.5 text-xs" href={`/admin/courses/${r.id}`}>Структура</Link>
                <StatusButtons entity="course" id={r.id} status={r.status} onDone={() => setReloadKey((k) => k + 1)} />
              </div>
            ),
          },
        ]}
        onEdit={startEdit}
        onDelete={async (row) => {
          await api(`/api/admin/courses/${row.id}`, { method: "DELETE" });
        }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={d.id ? "Редактирование курса" : "Новый курс"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug"><input className="input" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} /></Field>
            <Field label="Предмет">
              <select className="input" value={d.subjectId} onChange={(e) => setD({ ...d, subjectId: e.target.value })}>
                <option value="">—</option>
                {subjects.map((x) => <option key={x.id} value={x.id}>{x.nameRu}</option>)}
              </select>
            </Field>
            <Field label="Класс">
              <select className="input" value={d.gradeLevelId} onChange={(e) => setD({ ...d, gradeLevelId: e.target.value })}>
                <option value="">—</option>
                {grades.map((x) => <option key={x.id} value={x.id}>{x.nameRu}</option>)}
              </select>
            </Field>
            <Field label="Доступ">
              <select className="input" value={d.accessType} onChange={(e) => setD({ ...d, accessType: e.target.value })}>
                <option value="FREE">Бесплатный</option>
                <option value="PAID">Платный</option>
              </select>
            </Field>
            {d.accessType === "PAID" && (
              <Field label="Цена, ₸"><input className="input" type="number" value={d.priceKzt} onChange={(e) => setD({ ...d, priceKzt: e.target.value })} /></Field>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.sequential} onChange={(e) => setD({ ...d, sequential: e.target.checked })} /> Последовательное прохождение</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.selfEnroll} onChange={(e) => setD({ ...d, selfEnroll: e.target.checked })} /> Самозапись</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.certificateEnabled} onChange={(e) => setD({ ...d, certificateEnabled: e.target.checked })} /> Сертификат</label>
          </div>
          <Bilingual label="Название" kk={d.titleKk} ru={d.titleRu} onKk={(v) => setD({ ...d, titleKk: v })} onRu={(v) => setD({ ...d, titleRu: v })} />
          <Bilingual label="Описание" area kk={d.descriptionKk} ru={d.descriptionRu} onKk={(v) => setD({ ...d, descriptionKk: v })} onRu={(v) => setD({ ...d, descriptionRu: v })} />
          <Field label="ID преподавателей (через запятую)" hint="Скопируйте из раздела «Пользователи»">
            <input className="input" value={d.teacherUserIds} onChange={(e) => setD({ ...d, teacherUserIds: e.target.value })} />
          </Field>
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={save} disabled={!d.slug || !d.subjectId}>Сохранить</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
