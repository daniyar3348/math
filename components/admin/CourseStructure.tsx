"use client";

// Структура курса (§7): модули → уроки (двуязычный Markdown-редактор) → задания.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, Field, Bilingual, StatusButtons, type Row } from "./kit";
import { Modal } from "@/components/ui";

export function CourseStructure({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Row | null>(null);
  const [error, setError] = useState("");
  // module form
  const [modOpen, setModOpen] = useState(false);
  const [modDraft, setModDraft] = useState<{ id?: string; titleKk: string; titleRu: string; sort: number }>({ titleKk: "", titleRu: "", sort: 0 });
  // lesson form
  const [lesOpen, setLesOpen] = useState(false);
  const [lesDraft, setLesDraft] = useState<{ id?: string; moduleId: string; titleKk: string; titleRu: string; contentMdKk: string; contentMdRu: string; videoUrl: string; sort: number }>(
    { moduleId: "", titleKk: "", titleRu: "", contentMdKk: "", contentMdRu: "", videoUrl: "", sort: 0 }
  );
  // assignment form
  const [asgOpen, setAsgOpen] = useState(false);
  const [asgDraft, setAsgDraft] = useState<{ id?: string; moduleId: string; titleKk: string; titleRu: string; descriptionKk: string; descriptionRu: string; dueAt: string; maxScore: number }>(
    { moduleId: "", titleKk: "", titleRu: "", descriptionKk: "", descriptionRu: "", dueAt: "", maxScore: 100 }
  );
  // announcement form
  const [annOpen, setAnnOpen] = useState(false);
  const [annDraft, setAnnDraft] = useState<{ titleKk: string; titleRu: string; bodyKk: string; bodyRu: string }>({ titleKk: "", titleRu: "", bodyKk: "", bodyRu: "" });
  const [anns, setAnns] = useState<Row[]>([]);

  const load = useCallback(() => {
    api<{ row: Row }>(`/api/admin/courses/${courseId}`)
      .then(({ row }) => setCourse(row))
      .catch((e) => setError(e.message));
    api<{ rows: Row[] }>(`/api/admin/announcements?pageSize=50&f_courseId=${courseId}`)
      .then((x) => setAnns(x.rows))
      .catch(() => {});
  }, [courseId]);
  useEffect(load, [load]);

  if (error) return <p role="alert" className="card border-red-200 bg-red-50 p-4 text-red-700">Ошибка: {error}</p>;
  if (!course) return <div className="skeleton h-60 w-full" />;

  const title = (course.translations as Row[])?.find((t) => t.locale === "ru")?.title || course.slug;

  const saveModule = async () => {
    const payload = { courseId, titleKk: modDraft.titleKk, titleRu: modDraft.titleRu, sort: Number(modDraft.sort) };
    if (modDraft.id) await api(`/api/admin/modules/${modDraft.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/api/admin/modules", { method: "POST", body: JSON.stringify(payload) });
    setModOpen(false);
    load();
  };

  const saveLesson = async () => {
    const payload = { ...lesDraft, sort: Number(lesDraft.sort) };
    if (lesDraft.id) await api(`/api/admin/lessons/${lesDraft.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/api/admin/lessons", { method: "POST", body: JSON.stringify(payload) });
    setLesOpen(false);
    load();
  };

  const saveAssignment = async () => {
    const payload = {
      courseId,
      moduleId: asgDraft.moduleId || null,
      titleKk: asgDraft.titleKk,
      titleRu: asgDraft.titleRu,
      descriptionKk: asgDraft.descriptionKk,
      descriptionRu: asgDraft.descriptionRu,
      dueAt: asgDraft.dueAt ? new Date(asgDraft.dueAt).toISOString() : null,
      maxScore: Number(asgDraft.maxScore),
      status: "PUBLISHED",
    };
    if (asgDraft.id) await api(`/api/admin/assignments/${asgDraft.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/api/admin/assignments", { method: "POST", body: JSON.stringify(payload) });
    setAsgOpen(false);
    load();
  };

  return (
    <div className="max-w-4xl">
      <Link href="/admin/courses" className="text-sm font-semibold text-slate-400 hover:underline">← Курсы</Link>
      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <button className="btn-primary !py-2" onClick={() => { setModDraft({ titleKk: "", titleRu: "", sort: ((course.modules as Row[])?.length ?? 0) }); setModOpen(true); }}>
          + Модуль
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {((course.modules as Row[]) ?? []).map((m, mi) => (
          <section key={m.id} className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{mi + 1}. {m.titleRu} <span className="ml-1 text-sm font-normal text-slate-400">/ {m.titleKk}</span></h2>
              <div className="flex gap-1">
                <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => { setModDraft({ id: m.id, titleKk: m.titleKk, titleRu: m.titleRu, sort: m.sort }); setModOpen(true); }}>✏️</button>
                <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => { setLesDraft({ moduleId: m.id, titleKk: "", titleRu: "", contentMdKk: "", contentMdRu: "", videoUrl: "", sort: ((m.lessons as Row[])?.length ?? 0) }); setLesOpen(true); }}>+ урок</button>
                <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => { setAsgDraft({ moduleId: m.id, titleKk: "", titleRu: "", descriptionKk: "", descriptionRu: "", dueAt: "", maxScore: 100 }); setAsgOpen(true); }}>+ задание</button>
              </div>
            </div>

            <ul className="mt-3 space-y-1.5">
              {((m.lessons as Row[]) ?? []).map((l) => {
                const lt = (loc: string) => (l.translations as Row[])?.find((t) => t.locale === loc);
                return (
                  <li key={l.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span aria-hidden>📖</span>
                    <span className="flex-1">{lt("ru")?.title || lt("kk")?.title}</span>
                    <StatusButtons entity="lesson" id={l.id} status={l.status} onDone={load} />
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs"
                      onClick={() => {
                        setLesDraft({
                          id: l.id,
                          moduleId: m.id,
                          titleKk: lt("kk")?.title ?? "",
                          titleRu: lt("ru")?.title ?? "",
                          contentMdKk: lt("kk")?.contentMd ?? "",
                          contentMdRu: lt("ru")?.contentMd ?? "",
                          videoUrl: l.videoUrl ?? "",
                          sort: l.sort,
                        });
                        setLesOpen(true);
                      }}
                    >
                      ✏️
                    </button>
                  </li>
                );
              })}
              {((m.assignments as Row[]) ?? []).map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm">
                  <span aria-hidden>📝</span>
                  <span className="flex-1">{a.titleRu}</span>
                  <button className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => { setAsgDraft({ id: a.id, moduleId: m.id, titleKk: a.titleKk, titleRu: a.titleRu, descriptionKk: a.descriptionKk, descriptionRu: a.descriptionRu, dueAt: a.dueAt ? new Date(a.dueAt).toISOString().slice(0, 16) : "", maxScore: a.maxScore }); setAsgOpen(true); }}>
                    ✏️
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {((course.modules as Row[]) ?? []).length === 0 && (
          <p className="card p-8 text-center text-slate-400">Модулей пока нет — создайте первый.</p>
        )}

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">📣 Объявления курса</h2>
            <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => { setAnnDraft({ titleKk: "", titleRu: "", bodyKk: "", bodyRu: "" }); setAnnOpen(true); }}>
              + Объявление
            </button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {anns.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="flex-1">{a.titleRu} <span className="text-slate-400">/ {a.titleKk}</span></span>
                <span className="text-xs text-slate-400">{new Date(a.publishedAt ?? a.createdAt).toLocaleDateString("ru-RU")}</span>
                <button className="btn-ghost !px-2 !py-1 text-xs text-red-500"
                  onClick={async () => { await api(`/api/admin/announcements/${a.id}`, { method: "DELETE" }); load(); }}>
                  ✕
                </button>
              </li>
            ))}
            {anns.length === 0 && <li className="text-sm text-slate-400">Объявлений нет.</li>}
          </ul>
        </section>
      </div>

      <Modal open={modOpen} onClose={() => setModOpen(false)} title={modDraft.id ? "Модуль" : "Новый модуль"}>
        <div className="space-y-3">
          <Bilingual label="Название модуля" kk={modDraft.titleKk} ru={modDraft.titleRu}
            onKk={(v) => setModDraft({ ...modDraft, titleKk: v })} onRu={(v) => setModDraft({ ...modDraft, titleRu: v })} />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setModOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={saveModule} disabled={!modDraft.titleRu && !modDraft.titleKk}>Сохранить</button>
          </div>
        </div>
      </Modal>

      <Modal open={lesOpen} onClose={() => setLesOpen(false)} title={lesDraft.id ? "Урок" : "Новый урок"}>
        <div className="space-y-3">
          <Bilingual label="Название урока" kk={lesDraft.titleKk} ru={lesDraft.titleRu}
            onKk={(v) => setLesDraft({ ...lesDraft, titleKk: v })} onRu={(v) => setLesDraft({ ...lesDraft, titleRu: v })} />
          <Bilingual label="Содержимое (Markdown, $LaTeX$)" area rows={8} kk={lesDraft.contentMdKk} ru={lesDraft.contentMdRu}
            onKk={(v) => setLesDraft({ ...lesDraft, contentMdKk: v })} onRu={(v) => setLesDraft({ ...lesDraft, contentMdRu: v })} />
          <Field label="Видео URL (mp4/webm, опционально)">
            <input className="input" value={lesDraft.videoUrl} onChange={(e) => setLesDraft({ ...lesDraft, videoUrl: e.target.value })} />
          </Field>
          <p className="text-xs text-slate-400">Публикация урока — кнопкой статуса в списке; для публикации нужны оба языка.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setLesOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={saveLesson}>Сохранить</button>
          </div>
        </div>
      </Modal>

      <Modal open={annOpen} onClose={() => setAnnOpen(false)} title="Новое объявление">
        <div className="space-y-3">
          <Bilingual label="Заголовок" kk={annDraft.titleKk} ru={annDraft.titleRu}
            onKk={(v) => setAnnDraft({ ...annDraft, titleKk: v })} onRu={(v) => setAnnDraft({ ...annDraft, titleRu: v })} />
          <Bilingual label="Текст" area kk={annDraft.bodyKk} ru={annDraft.bodyRu}
            onKk={(v) => setAnnDraft({ ...annDraft, bodyKk: v })} onRu={(v) => setAnnDraft({ ...annDraft, bodyRu: v })} />
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setAnnOpen(false)}>Отмена</button>
            <button className="btn-primary" disabled={!annDraft.titleKk || !annDraft.titleRu}
              onClick={async () => {
                await api("/api/admin/announcements", { method: "POST", body: JSON.stringify({ courseId, ...annDraft }) });
                setAnnOpen(false);
                load();
              }}>
              Опубликовать
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={asgOpen} onClose={() => setAsgOpen(false)} title={asgDraft.id ? "Задание" : "Новое задание"}>
        <div className="space-y-3">
          <Bilingual label="Название" kk={asgDraft.titleKk} ru={asgDraft.titleRu}
            onKk={(v) => setAsgDraft({ ...asgDraft, titleKk: v })} onRu={(v) => setAsgDraft({ ...asgDraft, titleRu: v })} />
          <Bilingual label="Описание" area kk={asgDraft.descriptionKk} ru={asgDraft.descriptionRu}
            onKk={(v) => setAsgDraft({ ...asgDraft, descriptionKk: v })} onRu={(v) => setAsgDraft({ ...asgDraft, descriptionRu: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Дедлайн"><input className="input" type="datetime-local" value={asgDraft.dueAt} onChange={(e) => setAsgDraft({ ...asgDraft, dueAt: e.target.value })} /></Field>
            <Field label="Макс. балл"><input className="input" type="number" value={asgDraft.maxScore} onChange={(e) => setAsgDraft({ ...asgDraft, maxScore: Number(e.target.value) })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setAsgOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={saveAssignment}>Сохранить</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
