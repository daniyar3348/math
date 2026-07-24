"use client";

// Челленджи (§10): список + модальный builder (двуязычные поля, тесты-активности).
import { Suspense, useEffect, useState } from "react";
import { AdminTable, api, Field, Bilingual, StatusChip, StatusButtons, type Row } from "@/components/admin/kit";
import { Modal } from "@/components/ui";

interface Draft {
  id?: string;
  slug: string;
  subjectId: string;
  gradeLevelId: string;
  accessType: string;
  priceKzt: string;
  regStartAt: string;
  regEndAt: string;
  startAt: string;
  endAt: string;
  maxParticipants: string;
  isPublic: boolean;
  accessCode: string;
  passPct: number;
  titleKk: string; titleRu: string;
  descriptionKk: string; descriptionRu: string;
  prizesKk: string; prizesRu: string;
  activities: { testId: string; pointsWeight: number }[];
}

const empty = (): Draft => ({
  slug: "", subjectId: "", gradeLevelId: "", accessType: "FREE", priceKzt: "",
  regStartAt: "", regEndAt: "", startAt: "", endAt: "", maxParticipants: "",
  isPublic: true, accessCode: "", passPct: 50,
  titleKk: "", titleRu: "", descriptionKk: "", descriptionRu: "", prizesKk: "", prizesRu: "",
  activities: [],
});

const toLocal = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");

function Inner() {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(empty());
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [tests, setTests] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api<{ rows: Row[] }>("/api/admin/subjects?pageSize=100").then((x) => setSubjects(x.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/gradeLevels?pageSize=100").then((x) => setGrades(x.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/tests?pageSize=100&status=PUBLISHED").then((x) => setTests(x.rows)).catch(() => {});
  }, []);

  const startEdit = async (row: Row) => {
    const { row: full } = await api<{ row: Row }>(`/api/admin/challenges/${row.id}`);
    const tr = (l: string) => (full.translations as Row[]).find((t) => t.locale === l);
    setD({
      id: full.id,
      slug: full.slug,
      subjectId: full.subjectId ?? "",
      gradeLevelId: full.gradeLevelId ?? "",
      accessType: full.accessType,
      priceKzt: full.priceKzt != null ? String(full.priceKzt) : "",
      regStartAt: toLocal(full.regStartAt),
      regEndAt: toLocal(full.regEndAt),
      startAt: toLocal(full.startAt),
      endAt: toLocal(full.endAt),
      maxParticipants: full.maxParticipants != null ? String(full.maxParticipants) : "",
      isPublic: full.isPublic,
      accessCode: full.accessCode ?? "",
      passPct: full.passPct,
      titleKk: tr("kk")?.title ?? "", titleRu: tr("ru")?.title ?? "",
      descriptionKk: tr("kk")?.description ?? "", descriptionRu: tr("ru")?.description ?? "",
      prizesKk: tr("kk")?.prizes ?? "", prizesRu: tr("ru")?.prizes ?? "",
      activities: ((full.activities as Row[]) ?? []).map((a) => ({ testId: a.testId, pointsWeight: a.pointsWeight })),
    });
    setError("");
    setOpen(true);
  };

  const save = async () => {
    setError("");
    try {
      const payload = {
        slug: d.slug,
        subjectId: d.subjectId || null,
        gradeLevelId: d.gradeLevelId || null,
        accessType: d.accessType,
        priceKzt: d.priceKzt ? Number(d.priceKzt) : null,
        regStartAt: d.regStartAt ? new Date(d.regStartAt).toISOString() : null,
        regEndAt: d.regEndAt ? new Date(d.regEndAt).toISOString() : null,
        startAt: new Date(d.startAt).toISOString(),
        endAt: new Date(d.endAt).toISOString(),
        maxParticipants: d.maxParticipants ? Number(d.maxParticipants) : null,
        isPublic: d.isPublic,
        accessCode: d.accessCode,
        passPct: Number(d.passPct),
        titleKk: d.titleKk, titleRu: d.titleRu,
        descriptionKk: d.descriptionKk, descriptionRu: d.descriptionRu,
        prizesKk: d.prizesKk, prizesRu: d.prizesRu,
        activities: d.activities.filter((a) => a.testId),
      };
      if (d.id) await api(`/api/admin/challenges/${d.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/admin/challenges", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Челленджи</h1>
        <button className="btn-primary !py-2" onClick={() => { setD(empty()); setError(""); setOpen(true); }}>+ Челлендж</button>
      </div>
      <AdminTable
        endpoint="/api/admin/challenges"
        title="Челленджи"
        reloadKey={reloadKey}
        statusFilter={["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]}
        columns={[
          { key: "translations", title: "Название", render: (r) => (r.translations as Row[])?.find((t) => t.locale === "ru")?.title || r.slug },
          { key: "startAt", title: "Даты", render: (r) => `${new Date(r.startAt).toLocaleDateString("ru-RU")} — ${new Date(r.endAt).toLocaleDateString("ru-RU")}` },
          { key: "accessType", title: "Доступ", render: (r) => (r.accessType === "FREE" ? "Бесплатный" : `${r.priceKzt} ₸`) },
          { key: "_count", title: "Участников", render: (r) => r._count?.enrollments ?? 0 },
          { key: "activities", title: "Тестов", render: (r) => (r.activities as Row[])?.length ?? 0 },
          { key: "status", title: "Статус", render: (r) => <StatusChip status={r.status} /> },
          {
            key: "id",
            title: "",
            render: (r) => (
              <div className="flex items-center gap-1">
                <a className="btn-ghost !px-2 !py-1 text-xs" href={`/ru/challenges/${r.slug}`} target="_blank" title="Открыть на сайте">👁</a>
                <StatusButtons entity="challenge" id={r.id} status={r.status} onDone={() => setReloadKey((k) => k + 1)} />
              </div>
            ),
          },
        ]}
        onEdit={startEdit}
        onDelete={async (row) => {
          await api(`/api/admin/challenges/${row.id}`, { method: "DELETE" });
        }}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={d.id ? "Редактирование челленджа" : "Новый челлендж"}>
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
            <Field label="Лимит участников"><input className="input" type="number" value={d.maxParticipants} onChange={(e) => setD({ ...d, maxParticipants: e.target.value })} /></Field>
            <Field label="Регистрация с"><input className="input" type="datetime-local" value={d.regStartAt} onChange={(e) => setD({ ...d, regStartAt: e.target.value })} /></Field>
            <Field label="Регистрация до"><input className="input" type="datetime-local" value={d.regEndAt} onChange={(e) => setD({ ...d, regEndAt: e.target.value })} /></Field>
            <Field label="Начало *"><input className="input" type="datetime-local" value={d.startAt} onChange={(e) => setD({ ...d, startAt: e.target.value })} /></Field>
            <Field label="Окончание *"><input className="input" type="datetime-local" value={d.endAt} onChange={(e) => setD({ ...d, endAt: e.target.value })} /></Field>
            <Field label="Код доступа (закрытый)"><input className="input" value={d.accessCode} onChange={(e) => setD({ ...d, accessCode: e.target.value })} /></Field>
            <Field label="Критерий прохождения, %"><input className="input" type="number" value={d.passPct} onChange={(e) => setD({ ...d, passPct: Number(e.target.value) })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.isPublic} onChange={(e) => setD({ ...d, isPublic: e.target.checked })} />
            Показывать в публичном каталоге
          </label>

          <Bilingual label="Название" kk={d.titleKk} ru={d.titleRu} onKk={(v) => setD({ ...d, titleKk: v })} onRu={(v) => setD({ ...d, titleRu: v })} />
          <Bilingual label="Описание" area kk={d.descriptionKk} ru={d.descriptionRu} onKk={(v) => setD({ ...d, descriptionKk: v })} onRu={(v) => setD({ ...d, descriptionRu: v })} />
          <Bilingual label="Призы" area kk={d.prizesKk} ru={d.prizesRu} onKk={(v) => setD({ ...d, prizesKk: v })} onRu={(v) => setD({ ...d, prizesRu: v })} />

          <div>
            <p className="label">Тесты челленджа (опубликованные)</p>
            <div className="space-y-2">
              {d.activities.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className="input" value={a.testId} onChange={(e) => setD({ ...d, activities: d.activities.map((x, j) => (j === i ? { ...x, testId: e.target.value } : x)) })}>
                    <option value="">— выберите тест —</option>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>{(t.translations as Row[])?.find((x) => x.locale === "ru")?.title || t.slug}</option>
                    ))}
                  </select>
                  <input className="input max-w-24" type="number" step="0.1" title="Вес баллов" value={a.pointsWeight}
                    onChange={(e) => setD({ ...d, activities: d.activities.map((x, j) => (j === i ? { ...x, pointsWeight: Number(e.target.value) } : x)) })} />
                  <button className="btn-ghost !px-2 text-red-500" onClick={() => setD({ ...d, activities: d.activities.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              <button className="btn-ghost text-xs" onClick={() => setD({ ...d, activities: [...d.activities, { testId: "", pointsWeight: 1 }] })}>+ тест</button>
            </div>
          </div>

          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={save} disabled={!d.slug || !d.startAt || !d.endAt}>Сохранить</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
