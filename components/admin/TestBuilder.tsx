"use client";

// Конструктор теста (§8): двуязычные поля, настройки, секции с ручным выбором
// вопросов и случайной выборкой из банка, публикация с i18n-гейтом.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Field, Bilingual, StatusButtons, type Row } from "./kit";
import { Modal } from "@/components/ui";

interface Section {
  titleKk: string;
  titleRu: string;
  questionIds: string[];
  randomFromTopicId: string;
  randomCount: string;
  randomDifficulty: string;
}

interface State {
  slug: string;
  subjectId: string;
  gradeLevelId: string;
  mode: string;
  accessType: string;
  priceKzt: string;
  timeLimitMin: string;
  attemptsAllowed: number;
  passPct: number;
  availableFrom: string;
  availableTo: string;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  allowBack: boolean;
  onePerPage: boolean;
  autoSubmit: boolean;
  resultsPolicy: string;
  showCorrect: string;
  showExplanations: boolean;
  accessCode: string;
  titleKk: string;
  titleRu: string;
  descriptionKk: string;
  descriptionRu: string;
  instructionsKk: string;
  instructionsRu: string;
  cohortIds: string[];
  sections: Section[];
}

const initial: State = {
  slug: "",
  subjectId: "",
  gradeLevelId: "",
  mode: "STANDARD",
  accessType: "FREE",
  priceKzt: "",
  timeLimitMin: "",
  attemptsAllowed: 1,
  passPct: 60,
  availableFrom: "",
  availableTo: "",
  shuffleQuestions: false,
  shuffleChoices: false,
  allowBack: true,
  onePerPage: false,
  autoSubmit: true,
  resultsPolicy: "IMMEDIATE",
  showCorrect: "AFTER_SUBMIT",
  showExplanations: true,
  accessCode: "",
  titleKk: "",
  titleRu: "",
  descriptionKk: "",
  descriptionRu: "",
  instructionsKk: "",
  instructionsRu: "",
  cohortIds: [],
  sections: [{ titleKk: "", titleRu: "", questionIds: [], randomFromTopicId: "", randomCount: "", randomDifficulty: "" }],
};

export function TestBuilder({ testId }: { testId: string | null }) {
  const router = useRouter();
  const [s, setS] = useState<State>(initial);
  const [id, setId] = useState<string | null>(testId);
  const [status, setStatus] = useState("DRAFT");
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [topics, setTopics] = useState<Row[]>([]);
  const [cohorts, setCohorts] = useState<Row[]>([]);
  const [questions, setQuestions] = useState<Row[]>([]);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ rows: Row[] }>("/api/admin/subjects?pageSize=100").then((d) => setSubjects(d.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/gradeLevels?pageSize=100").then((d) => setGrades(d.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/topics?pageSize=100").then((d) => setTopics(d.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/cohorts?pageSize=100").then((d) => setCohorts(d.rows)).catch(() => {});
  }, []);

  useEffect(() => {
    api<{ rows: Row[] }>(`/api/admin/questions?pageSize=100&status=PUBLISHED${pickQuery ? `&q=${encodeURIComponent(pickQuery)}` : ""}`)
      .then((d) => setQuestions(d.rows))
      .catch(() => {});
  }, [pickQuery]);

  useEffect(() => {
    if (!id) return;
    api<{ row: Row }>(`/api/admin/tests/${id}`).then(({ row }) => {
      const tr = (l: string) => (row.translations as Row[]).find((t) => t.locale === l);
      setStatus(row.status);
      setS({
        slug: row.slug,
        subjectId: row.subjectId ?? "",
        gradeLevelId: row.gradeLevelId ?? "",
        mode: row.mode,
        accessType: row.accessType,
        priceKzt: row.priceKzt != null ? String(row.priceKzt) : "",
        timeLimitMin: row.timeLimitSec != null ? String(Math.round(row.timeLimitSec / 60)) : "",
        attemptsAllowed: row.attemptsAllowed,
        passPct: row.passPct,
        availableFrom: row.availableFrom ? new Date(row.availableFrom).toISOString().slice(0, 16) : "",
        availableTo: row.availableTo ? new Date(row.availableTo).toISOString().slice(0, 16) : "",
        shuffleQuestions: row.shuffleQuestions,
        shuffleChoices: row.shuffleChoices,
        allowBack: row.allowBack,
        onePerPage: row.onePerPage,
        autoSubmit: row.autoSubmit,
        resultsPolicy: row.resultsPolicy,
        showCorrect: row.showCorrect,
        showExplanations: row.showExplanations,
        accessCode: row.accessCode ?? "",
        titleKk: tr("kk")?.title ?? "",
        titleRu: tr("ru")?.title ?? "",
        descriptionKk: tr("kk")?.description ?? "",
        descriptionRu: tr("ru")?.description ?? "",
        instructionsKk: tr("kk")?.instructions ?? "",
        instructionsRu: tr("ru")?.instructions ?? "",
        cohortIds: ((row.cohortAccess as Row[]) ?? []).map((c) => c.cohortId),
        sections: ((row.sections as Row[]) ?? []).map((sec) => ({
          titleKk: sec.titleKk ?? "",
          titleRu: sec.titleRu ?? "",
          questionIds: ((sec.questions as Row[]) ?? []).map((q) => q.questionId),
          randomFromTopicId: sec.randomFromTopicId ?? "",
          randomCount: sec.randomCount != null ? String(sec.randomCount) : "",
          randomDifficulty: sec.randomDifficulty != null ? String(sec.randomDifficulty) : "",
        })),
      });
    });
  }, [id]);

  const qTitle = (qid: string) => {
    const q = questions.find((x) => x.id === qid);
    return (q?.translations as Row[])?.find((t) => t.locale === "ru")?.prompt?.slice(0, 70) ?? qid.slice(0, 12);
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        slug: s.slug,
        subjectId: s.subjectId,
        gradeLevelId: s.gradeLevelId || null,
        mode: s.mode,
        accessType: s.accessType,
        priceKzt: s.priceKzt ? Number(s.priceKzt) : null,
        timeLimitSec: s.timeLimitMin ? Number(s.timeLimitMin) * 60 : null,
        attemptsAllowed: Number(s.attemptsAllowed),
        passPct: Number(s.passPct),
        availableFrom: s.availableFrom ? new Date(s.availableFrom).toISOString() : null,
        availableTo: s.availableTo ? new Date(s.availableTo).toISOString() : null,
        shuffleQuestions: s.shuffleQuestions,
        shuffleChoices: s.shuffleChoices,
        allowBack: s.allowBack,
        onePerPage: s.onePerPage,
        autoSubmit: s.autoSubmit,
        resultsPolicy: s.resultsPolicy,
        showCorrect: s.showCorrect,
        showExplanations: s.showExplanations,
        accessCode: s.accessCode,
        titleKk: s.titleKk,
        titleRu: s.titleRu,
        descriptionKk: s.descriptionKk,
        descriptionRu: s.descriptionRu,
        instructionsKk: s.instructionsKk,
        instructionsRu: s.instructionsRu,
        cohortIds: s.cohortIds,
        sections: s.sections.map((sec) => ({
          titleKk: sec.titleKk,
          titleRu: sec.titleRu,
          questionIds: sec.questionIds,
          randomFromTopicId: sec.randomFromTopicId || null,
          randomCount: sec.randomCount ? Number(sec.randomCount) : null,
          randomDifficulty: sec.randomDifficulty ? Number(sec.randomDifficulty) : null,
        })),
      };
      if (id) {
        await api(`/api/admin/tests/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        setMsg("✅ Сохранено");
      } else {
        const { row } = await api<{ row: Row }>("/api/admin/tests", { method: "POST", body: JSON.stringify(payload) });
        setId(row.id);
        router.replace(`/admin/tests/${row.id}`);
        setMsg("✅ Тест создан (черновик)");
      }
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Ошибка"}`);
    } finally {
      setSaving(false);
    }
  };

  const upSection = (i: number, patch: Partial<Section>) =>
    setS({ ...s, sections: s.sections.map((sec, j) => (j === i ? { ...sec, ...patch } : sec)) });

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{id ? "Редактирование теста" : "Новый тест"}</h1>
        <div className="flex items-center gap-2">
          {id && <StatusButtons entity="test" id={id} status={status} onDone={() => setStatus(status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")} />}
          <button className="btn-primary" onClick={save} disabled={saving || !s.slug || !s.subjectId}>
            {saving ? "…" : "Сохранить"}
          </button>
        </div>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold">{msg}</p>}

      <section className="card mt-5 space-y-4 p-5">
        <h2 className="font-bold">Основное</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Slug (URL)"><input className="input" value={s.slug} onChange={(e) => setS({ ...s, slug: e.target.value })} placeholder="algebra-6-diagnostika" /></Field>
          <Field label="Предмет">
            <select className="input" value={s.subjectId} onChange={(e) => setS({ ...s, subjectId: e.target.value })}>
              <option value="">—</option>
              {subjects.map((x) => <option key={x.id} value={x.id}>{x.nameRu}</option>)}
            </select>
          </Field>
          <Field label="Класс">
            <select className="input" value={s.gradeLevelId} onChange={(e) => setS({ ...s, gradeLevelId: e.target.value })}>
              <option value="">—</option>
              {grades.map((x) => <option key={x.id} value={x.id}>{x.nameRu}</option>)}
            </select>
          </Field>
          <Field label="Режим">
            <select className="input" value={s.mode} onChange={(e) => setS({ ...s, mode: e.target.value })}>
              <option value="STANDARD">Обычный</option>
              <option value="DIAGNOSTIC">Диагностический</option>
              <option value="EXAM">Экзамен</option>
            </select>
          </Field>
          <Field label="Доступ">
            <select className="input" value={s.accessType} onChange={(e) => setS({ ...s, accessType: e.target.value })}>
              <option value="FREE">Бесплатный</option>
              <option value="PAID">Платный</option>
            </select>
          </Field>
          {s.accessType === "PAID" && (
            <Field label="Цена, ₸"><input className="input" type="number" value={s.priceKzt} onChange={(e) => setS({ ...s, priceKzt: e.target.value })} /></Field>
          )}
        </div>
        <Bilingual label="Название" kk={s.titleKk} ru={s.titleRu} onKk={(v) => setS({ ...s, titleKk: v })} onRu={(v) => setS({ ...s, titleRu: v })} />
        <Bilingual label="Описание" area kk={s.descriptionKk} ru={s.descriptionRu} onKk={(v) => setS({ ...s, descriptionKk: v })} onRu={(v) => setS({ ...s, descriptionRu: v })} />
        <Bilingual label="Инструкция" area kk={s.instructionsKk} ru={s.instructionsRu} onKk={(v) => setS({ ...s, instructionsKk: v })} onRu={(v) => setS({ ...s, instructionsRu: v })} />
      </section>

      <section className="card mt-4 space-y-4 p-5">
        <h2 className="font-bold">Параметры прохождения</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Лимит времени, мин"><input className="input" type="number" value={s.timeLimitMin} onChange={(e) => setS({ ...s, timeLimitMin: e.target.value })} placeholder="∞" /></Field>
          <Field label="Попыток"><input className="input" type="number" min={1} value={s.attemptsAllowed} onChange={(e) => setS({ ...s, attemptsAllowed: Number(e.target.value) })} /></Field>
          <Field label="Проходной, %"><input className="input" type="number" min={0} max={100} value={s.passPct} onChange={(e) => setS({ ...s, passPct: Number(e.target.value) })} /></Field>
          <Field label="Код доступа"><input className="input" value={s.accessCode} onChange={(e) => setS({ ...s, accessCode: e.target.value })} /></Field>
          <Field label="Доступен с"><input className="input" type="datetime-local" value={s.availableFrom} onChange={(e) => setS({ ...s, availableFrom: e.target.value })} /></Field>
          <Field label="Доступен до"><input className="input" type="datetime-local" value={s.availableTo} onChange={(e) => setS({ ...s, availableTo: e.target.value })} /></Field>
          <Field label="Показ результатов">
            <select className="input" value={s.resultsPolicy} onChange={(e) => setS({ ...s, resultsPolicy: e.target.value })}>
              <option value="IMMEDIATE">Сразу</option>
              <option value="AFTER_CLOSE">После закрытия</option>
              <option value="MANUAL">Вручную (персоналу)</option>
            </select>
          </Field>
          <Field label="Правильные ответы">
            <select className="input" value={s.showCorrect} onChange={(e) => setS({ ...s, showCorrect: e.target.value })}>
              <option value="NEVER">Не показывать</option>
              <option value="AFTER_SUBMIT">После сдачи</option>
              <option value="AFTER_CLOSE">После закрытия</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["shuffleQuestions", "Перемешивать вопросы"],
              ["shuffleChoices", "Перемешивать варианты"],
              ["allowBack", "Можно возвращаться назад"],
              ["onePerPage", "По одному вопросу"],
              ["autoSubmit", "Автоотправка по времени"],
              ["showExplanations", "Показывать объяснения"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5">
              <input type="checkbox" checked={s[key] as boolean} onChange={(e) => setS({ ...s, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        {cohorts.length > 0 && (
          <div>
            <p className="label">Доступ только группам (пусто = всем)</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {cohorts.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={s.cohortIds.includes(c.id)}
                    onChange={(e) =>
                      setS({ ...s, cohortIds: e.target.checked ? [...s.cohortIds, c.id] : s.cohortIds.filter((x) => x !== c.id) })
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Секции и вопросы</h2>
          <button className="btn-outline !py-2 text-xs" onClick={() => setS({ ...s, sections: [...s.sections, { titleKk: "", titleRu: "", questionIds: [], randomFromTopicId: "", randomCount: "", randomDifficulty: "" }] })}>
            + Секция
          </button>
        </div>
        {s.sections.map((sec, i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-slate-500">Секция {i + 1}</p>
              {s.sections.length > 1 && (
                <button className="btn-ghost !px-2 text-red-500" onClick={() => setS({ ...s, sections: s.sections.filter((_, j) => j !== i) })}>✕</button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Атауы (KK)"><input className="input" value={sec.titleKk} onChange={(e) => upSection(i, { titleKk: e.target.value })} /></Field>
              <Field label="Название (RU)"><input className="input" value={sec.titleRu} onChange={(e) => upSection(i, { titleRu: e.target.value })} /></Field>
            </div>

            <div>
              <p className="label">Вопросы вручную ({sec.questionIds.length})</p>
              <ol className="space-y-1 text-sm">
                {sec.questionIds.map((qid, qi) => (
                  <li key={qid} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="text-slate-400">{qi + 1}.</span>
                    <span className="flex-1 truncate">{qTitle(qid)}</span>
                    <button className="btn-ghost !px-1.5 !py-0.5 text-red-500" aria-label="Убрать"
                      onClick={() => upSection(i, { questionIds: sec.questionIds.filter((x) => x !== qid) })}>✕</button>
                  </li>
                ))}
              </ol>
              <button className="btn-outline mt-2 !py-1.5 text-xs" onClick={() => setPickFor(i)}>+ Добавить из банка</button>
            </div>

            <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
              <Field label="Случайно из темы">
                <select className="input" value={sec.randomFromTopicId} onChange={(e) => upSection(i, { randomFromTopicId: e.target.value })}>
                  <option value="">— нет —</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.nameRu}</option>)}
                </select>
              </Field>
              <Field label="Сколько вопросов"><input className="input" type="number" value={sec.randomCount} onChange={(e) => upSection(i, { randomCount: e.target.value })} /></Field>
              <Field label="Сложность (опц.)"><input className="input" type="number" min={1} max={5} value={sec.randomDifficulty} onChange={(e) => upSection(i, { randomDifficulty: e.target.value })} /></Field>
            </div>
          </div>
        ))}
      </section>

      <Modal open={pickFor !== null} onClose={() => setPickFor(null)} title="Выбор вопросов из банка (опубликованные)">
        <input className="input mb-3" placeholder="Поиск по тексту…" value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} />
        <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
          {questions.map((q) => {
            const inSection = pickFor !== null && s.sections[pickFor]?.questionIds.includes(q.id);
            return (
              <li key={q.id}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${inSection ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-100"}`}
                  onClick={() => {
                    if (pickFor === null) return;
                    const sec = s.sections[pickFor];
                    upSection(pickFor, {
                      questionIds: inSection ? sec.questionIds.filter((x) => x !== q.id) : [...sec.questionIds, q.id],
                    });
                  }}
                >
                  {inSection ? "✓ " : ""}
                  {(q.translations as Row[])?.find((t) => t.locale === "ru")?.prompt?.slice(0, 90)}
                  <span className="ml-1 text-xs text-slate-400">({q.type}, {q.points} б.)</span>
                </button>
              </li>
            );
          })}
          {questions.length === 0 && <li className="p-3 text-slate-400">Нет опубликованных вопросов</li>}
        </ul>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={() => setPickFor(null)}>Готово</button>
        </div>
      </Modal>
    </div>
  );
}
