"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, post, put, del } from "@/lib/api";
import { Field, Area, AdminSection, DangerBtn } from "@/components/admin";
import { Spinner } from "@/components/ui";

interface LessonRow {
  id: string;
  course_id: string;
  title_kk: string;
  title_ru: string;
  body_kk: string;
  body_ru: string;
  sort: number;
}
interface ChallengeRow {
  id: string;
  course_id: string;
  title_kk: string;
  title_ru: string;
  description_kk: string;
  description_ru: string;
  xp: number;
  time_limit_sec: number;
  sort: number;
}
interface CourseRow {
  id: string;
  title_ru: string;
  cover: string;
}

const EMPTY_LESSON = { title_kk: "", title_ru: "", body_kk: "", body_ru: "", sort: 0 };
const EMPTY_CH = {
  title_kk: "",
  title_ru: "",
  description_kk: "",
  description_ru: "",
  xp: 50,
  time_limit_sec: 300,
  sort: 0,
};

export default function AdminCourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRow[] | null>(null);
  const [editLesson, setEditLesson] = useState<(Partial<LessonRow> & typeof EMPTY_LESSON) | null>(null);
  const [editCh, setEditCh] = useState<(Partial<ChallengeRow> & typeof EMPTY_CH) | null>(null);

  const load = useCallback(() => {
    api<{ rows: CourseRow[] }>("/api/admin/courses").then((d) =>
      setCourse(d.rows.find((r) => r.id === id) ?? null)
    );
    api<{ rows: LessonRow[] }>(`/api/admin/lessons?course_id=${id}`).then((d) =>
      setLessons(d.rows)
    );
    api<{ rows: ChallengeRow[] }>(`/api/admin/challenges?course_id=${id}`).then((d) =>
      setChallenges(d.rows)
    );
  }, [id]);
  useEffect(load, [load]);

  if (!lessons || !challenges) return <Spinner />;

  const saveLesson = async () => {
    if (!editLesson) return;
    const { id: lid, course_id, ...fields } = editLesson as LessonRow;
    void course_id;
    if (lid) await put(`/api/admin/lessons/${lid}`, fields);
    else await post("/api/admin/lessons", { ...fields, course_id: id });
    setEditLesson(null);
    load();
  };

  const saveCh = async () => {
    if (!editCh) return;
    const { id: chid, course_id, ...fields } = editCh as ChallengeRow;
    void course_id;
    if (chid) await put(`/api/admin/challenges/${chid}`, fields);
    else await post("/api/admin/challenges", { ...fields, course_id: id });
    setEditCh(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/courses" className="text-sm font-semibold text-slate-400 hover:text-brand">
          ← Курсы
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
          {course?.cover} {course?.title_ru ?? id}
        </h1>
      </div>

      {/* Lessons */}
      <AdminSection
        title={`Уроки (${lessons.length})`}
        action={
          <button className="btn-brand !py-1.5 text-xs" onClick={() => setEditLesson({ ...EMPTY_LESSON, sort: lessons.length })}>
            + Урок
          </button>
        }
      >
        {editLesson && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Название (KK)" value={editLesson.title_kk} onChange={(v) => setEditLesson({ ...editLesson, title_kk: v })} />
              <Field label="Название (RU)" value={editLesson.title_ru} onChange={(v) => setEditLesson({ ...editLesson, title_ru: v })} />
              <Area label="Текст (KK)" rows={3} value={editLesson.body_kk} onChange={(v) => setEditLesson({ ...editLesson, body_kk: v })} />
              <Area label="Текст (RU)" rows={3} value={editLesson.body_ru} onChange={(v) => setEditLesson({ ...editLesson, body_ru: v })} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={saveLesson} className="btn-brand !py-2">Сохранить</button>
              <button onClick={() => setEditLesson(null)} className="btn-ghost !py-2">Отмена</button>
            </div>
          </div>
        )}
        <div className="divide-y divide-slate-100">
          {lessons.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-indigo-100 text-xs font-bold text-brand">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">{l.title_ru}</div>
                <div className="truncate text-xs text-slate-400">{l.body_ru}</div>
              </div>
              <button
                onClick={() => setEditLesson(l)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                ✏️
              </button>
              <DangerBtn
                onClick={async () => {
                  if (!confirm("Удалить урок?")) return;
                  await del(`/api/admin/lessons/${l.id}`);
                  load();
                }}
              >
                Удалить
              </DangerBtn>
            </div>
          ))}
          {lessons.length === 0 && <p className="py-3 text-sm text-slate-400">Пока нет уроков.</p>}
        </div>
      </AdminSection>

      {/* Challenges */}
      <AdminSection
        title={`Челленджи (${challenges.length})`}
        action={
          <button className="btn-brand !py-1.5 text-xs" onClick={() => setEditCh({ ...EMPTY_CH, sort: challenges.length })}>
            + Челлендж
          </button>
        }
      >
        {editCh && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Название (KK)" value={editCh.title_kk} onChange={(v) => setEditCh({ ...editCh, title_kk: v })} />
              <Field label="Название (RU)" value={editCh.title_ru} onChange={(v) => setEditCh({ ...editCh, title_ru: v })} />
              <Area label="Описание (KK)" value={editCh.description_kk} onChange={(v) => setEditCh({ ...editCh, description_kk: v })} />
              <Area label="Описание (RU)" value={editCh.description_ru} onChange={(v) => setEditCh({ ...editCh, description_ru: v })} />
              <Field label="XP" type="number" value={editCh.xp} onChange={(v) => setEditCh({ ...editCh, xp: Number(v) || 0 })} />
              <Field label="Лимит времени, сек" type="number" value={editCh.time_limit_sec} onChange={(v) => setEditCh({ ...editCh, time_limit_sec: Number(v) || 60 })} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={saveCh} className="btn-brand !py-2">Сохранить</button>
              <button onClick={() => setEditCh(null)} className="btn-ghost !py-2">Отмена</button>
            </div>
          </div>
        )}
        <div className="divide-y divide-slate-100">
          {challenges.map((ch) => (
            <div key={ch.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">{ch.title_ru}</div>
                <div className="text-xs text-slate-400">
                  ⚡ {ch.xp} XP · ⏱ {Math.round(ch.time_limit_sec / 60)} мин
                </div>
              </div>
              <Link
                href={`/admin/challenges/${ch.id}`}
                className="btn-outline !px-3 !py-1.5 text-xs"
              >
                Вопросы →
              </Link>
              <button
                onClick={async () => {
                  await post("/api/admin/duplicate-challenge", { challengeId: ch.id });
                  load();
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                title="Дублировать со всеми вопросами"
              >
                📋 Копия
              </button>
              <button
                onClick={() => setEditCh(ch)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                ✏️
              </button>
              <DangerBtn
                onClick={async () => {
                  if (!confirm("Удалить челлендж со всеми вопросами?")) return;
                  await del(`/api/admin/challenges/${ch.id}`);
                  load();
                }}
              >
                Удалить
              </DangerBtn>
            </div>
          ))}
          {challenges.length === 0 && (
            <p className="py-3 text-sm text-slate-400">Пока нет челленджей.</p>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
