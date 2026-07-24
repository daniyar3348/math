"use client";

// Банк вопросов (§8): все 10 типов через UI, двуязычный ввод, индикатор
// перевода, статусы, дублирование, импорт/экспорт CSV, предпросмотр.
import { Suspense, useEffect, useRef, useState } from "react";
import { AdminTable, api, Field, Bilingual, I18nBadge, StatusChip, StatusButtons, type Row } from "@/components/admin/kit";
import { Modal } from "@/components/ui";

const TYPES: { value: string; label: string }[] = [
  { value: "SINGLE_CHOICE", label: "Один правильный ответ" },
  { value: "MULTI_CHOICE", label: "Несколько правильных" },
  { value: "TRUE_FALSE", label: "Верно / неверно" },
  { value: "SHORT_TEXT", label: "Короткий текст" },
  { value: "NUMERIC", label: "Числовой (с погрешностью)" },
  { value: "FILL_BLANKS", label: "Заполнение пропусков" },
  { value: "MATCHING", label: "Сопоставление пар" },
  { value: "ORDERING", label: "Правильный порядок" },
  { value: "ESSAY", label: "Развёрнутый ответ" },
  { value: "FILE_UPLOAD", label: "Загрузка файла" },
];

interface Draft {
  id?: string;
  type: string;
  subjectId: string;
  gradeLevelId: string;
  topicId: string;
  difficulty: number;
  points: number;
  promptKk: string;
  promptRu: string;
  explanationKk: string;
  explanationRu: string;
  tags: string;
  choices: { textKk: string; textRu: string; correct: boolean }[];
  configText: string; // JSON конфига для сложных типов
}

const emptyDraft = (): Draft => ({
  type: "SINGLE_CHOICE",
  subjectId: "",
  gradeLevelId: "",
  topicId: "",
  difficulty: 2,
  points: 1,
  promptKk: "",
  promptRu: "",
  explanationKk: "",
  explanationRu: "",
  tags: "",
  choices: [
    { textKk: "", textRu: "", correct: true },
    { textKk: "", textRu: "", correct: false },
  ],
  configText: "{}",
});

const CONFIG_TEMPLATES: Record<string, string> = {
  TRUE_FALSE: '{"answer": true}',
  SHORT_TEXT: '{"answers": {"kk": ["жауап"], "ru": ["ответ"]}, "caseSensitive": false}',
  NUMERIC: '{"answer": 42, "tolerance": 0}',
  FILL_BLANKS: '{"blanks": [{"id": "a", "answers": {"kk": ["100"], "ru": ["100"]}}], "partial": true}',
  MATCHING: '{"pairs": [{"left": {"kk": "25%", "ru": "25%"}, "right": {"kk": "1/4", "ru": "1/4"}}], "partial": true}',
  ORDERING: '{"items": [{"kk": "бірінші", "ru": "первый"}, {"kk": "екінші", "ru": "второй"}], "partial": true}',
  ESSAY: '{"minWords": 15}',
  FILE_UPLOAD: '{"maxSizeMb": 10}',
  SINGLE_CHOICE: "{}",
  MULTI_CHOICE: '{"partial": "proportional"}',
};

function Inner() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [topics, setTopics] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [importMsg, setImportMsg] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ rows: Row[] }>("/api/admin/subjects?pageSize=100").then((d) => setSubjects(d.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/gradeLevels?pageSize=100").then((d) => setGrades(d.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/topics?pageSize=100").then((d) => setTopics(d.rows)).catch(() => {});
  }, []);

  const hasChoices = ["SINGLE_CHOICE", "MULTI_CHOICE"].includes(draft.type);
  const hasConfig = !["SINGLE_CHOICE"].includes(draft.type);

  const startCreate = () => {
    setDraft(emptyDraft());
    setError("");
    setOpen(true);
  };

  const startEdit = async (row: Row) => {
    const { row: full } = await api<{ row: Row }>(`/api/admin/questions/${row.id}`);
    const tr = (l: string) => (full.translations as Row[]).find((t) => t.locale === l);
    setDraft({
      id: full.id,
      type: full.type,
      subjectId: full.subjectId ?? "",
      gradeLevelId: full.gradeLevelId ?? "",
      topicId: full.topicId ?? "",
      difficulty: full.difficulty,
      points: full.points,
      promptKk: tr("kk")?.prompt ?? "",
      promptRu: tr("ru")?.prompt ?? "",
      explanationKk: tr("kk")?.explanation ?? "",
      explanationRu: tr("ru")?.explanation ?? "",
      tags: ((full.tags as Row[]) ?? []).map((t) => t.tag).join(", "),
      choices: ((full.choices as Row[]) ?? []).map((c) => ({ textKk: c.textKk, textRu: c.textRu, correct: c.correct })),
      configText: JSON.stringify(full.config ?? {}, null, 2),
    });
    setError("");
    setOpen(true);
  };

  const duplicate = async (row: Row) => {
    await startEdit(row);
    setDraft((d) => ({ ...d, id: undefined, promptRu: d.promptRu + " (копия)" }));
  };

  const save = async () => {
    setError("");
    let config: unknown = {};
    try {
      config = JSON.parse(draft.configText || "{}");
    } catch {
      setError("Конфигурация — некорректный JSON");
      return;
    }
    const payload = {
      subjectId: draft.subjectId,
      gradeLevelId: draft.gradeLevelId || null,
      topicId: draft.topicId || null,
      type: draft.type,
      difficulty: Number(draft.difficulty),
      points: Number(draft.points),
      config,
      promptKk: draft.promptKk,
      promptRu: draft.promptRu,
      explanationKk: draft.explanationKk,
      explanationRu: draft.explanationRu,
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      choices: hasChoices ? draft.choices : [],
    };
    try {
      if (draft.id) await api(`/api/admin/questions/${draft.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/admin/questions", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setError(
        m === "single_needs_one_correct" ? "У типа «один ответ» должен быть ровно один правильный вариант" :
        m === "choices_min_2" ? "Нужно минимум 2 варианта" :
        m === "bad_question_config" ? "Конфигурация не соответствует типу вопроса (см. шаблон)" :
        `Ошибка: ${m}`
      );
    }
  };

  const importCsv = async (file: File) => {
    setImportMsg([]);
    const csv = await file.text();
    try {
      const res = await api<{ imported: number; errors: { line: number; message: string }[] }>(
        "/api/admin/questions/import",
        { method: "POST", body: JSON.stringify({ csv }) }
      );
      setImportMsg([`✅ Импортировано: ${res.imported}`, ...res.errors.map((e) => `Строка ${e.line}: ${e.message}`)]);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setImportMsg([`⚠️ ${e instanceof Error ? e.message : "Ошибка импорта"}`]);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Банк вопросов</h1>

      {importMsg.length > 0 && (
        <div className="card mb-4 space-y-0.5 p-4 text-sm">
          {importMsg.slice(0, 12).map((m, i) => (
            <p key={i} className={m.startsWith("✅") ? "font-semibold text-emerald-600" : "text-amber-700"}>{m}</p>
          ))}
        </div>
      )}

      <AdminTable
        endpoint="/api/admin/questions"
        title="Вопросы"
        reloadKey={reloadKey}
        statusFilter={["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]}
        columns={[
          {
            key: "translations",
            title: "Вопрос",
            render: (r) => {
              const ru = (r.translations as Row[])?.find((t) => t.locale === "ru")?.prompt ?? "";
              return <span className="line-clamp-2 max-w-md">{ru}</span>;
            },
          },
          { key: "type", title: "Тип", render: (r) => TYPES.find((t) => t.value === r.type)?.label ?? r.type },
          { key: "subject", title: "Предмет", render: (r) => r.subject?.nameRu ?? "" },
          { key: "difficulty", title: "Сложн.", sortable: true },
          { key: "points", title: "Баллы" },
          { key: "i18nReady", title: "Перевод", render: (r) => <I18nBadge kk={r.i18nReady?.kk} ru={r.i18nReady?.ru} /> },
          { key: "status", title: "Статус", render: (r) => <StatusChip status={r.status} /> },
          {
            key: "id",
            title: "",
            render: (r) => (
              <div className="flex gap-1">
                <button className="btn-ghost !px-2 !py-1 text-xs" title="Дублировать" onClick={() => duplicate(r)}>📋</button>
                <StatusButtons entity="question" id={r.id} status={r.status} onDone={() => setReloadKey((k) => k + 1)} />
              </div>
            ),
          },
        ]}
        onEdit={startEdit}
        onDelete={async (row) => {
          await api(`/api/admin/questions/${row.id}`, { method: "DELETE" });
        }}
        toolbar={
          <>
            <button className="btn-outline !py-2" onClick={() => { window.location.href = "/api/admin/questions/export"; }}>⬇ Экспорт</button>
            <button className="btn-outline !py-2" onClick={() => fileRef.current?.click()}>⬆ Импорт CSV</button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            <button className="btn-primary !py-2" onClick={startCreate}>+ Вопрос</button>
          </>
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} title={draft.id ? "Редактирование вопроса" : "Новый вопрос"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Тип вопроса">
              <select
                className="input"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value, configText: CONFIG_TEMPLATES[e.target.value] ?? "{}" })}
                disabled={!!draft.id}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Предмет">
              <select className="input" value={draft.subjectId} onChange={(e) => setDraft({ ...draft, subjectId: e.target.value })}>
                <option value="">—</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.nameRu}</option>
                ))}
              </select>
            </Field>
            <Field label="Класс">
              <select className="input" value={draft.gradeLevelId} onChange={(e) => setDraft({ ...draft, gradeLevelId: e.target.value })}>
                <option value="">—</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.nameRu}</option>
                ))}
              </select>
            </Field>
            <Field label="Тема">
              <select className="input" value={draft.topicId} onChange={(e) => setDraft({ ...draft, topicId: e.target.value })}>
                <option value="">—</option>
                {topics.filter((t) => !draft.subjectId || t.subjectId === draft.subjectId).map((t) => (
                  <option key={t.id} value={t.id}>{t.nameRu}</option>
                ))}
              </select>
            </Field>
            <Field label="Сложность (1–5)">
              <input className="input" type="number" min={1} max={5} value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) })} />
            </Field>
            <Field label="Баллы">
              <input className="input" type="number" step="0.5" value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} />
            </Field>
          </div>

          <Bilingual label="Текст вопроса (поддерживается $LaTeX$)" area kk={draft.promptKk} ru={draft.promptRu}
            onKk={(v) => setDraft({ ...draft, promptKk: v })} onRu={(v) => setDraft({ ...draft, promptRu: v })} />

          {hasChoices && (
            <div>
              <p className="label">Варианты ответа (отметьте правильные)</p>
              <div className="space-y-2">
                {draft.choices.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <input
                      type={draft.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                      name="correct"
                      className="mt-3"
                      checked={c.correct}
                      onChange={() => {
                        const next = draft.choices.map((x, j) =>
                          draft.type === "SINGLE_CHOICE" ? { ...x, correct: j === i } : j === i ? { ...x, correct: !x.correct } : x
                        );
                        setDraft({ ...draft, choices: next });
                      }}
                      aria-label={`Правильный вариант ${i + 1}`}
                    />
                    <input className="input" placeholder={`Нұсқа ${i + 1} (KK)`} value={c.textKk}
                      onChange={(e) => setDraft({ ...draft, choices: draft.choices.map((x, j) => (j === i ? { ...x, textKk: e.target.value } : x)) })} />
                    <input className="input" placeholder={`Вариант ${i + 1} (RU)`} value={c.textRu}
                      onChange={(e) => setDraft({ ...draft, choices: draft.choices.map((x, j) => (j === i ? { ...x, textRu: e.target.value } : x)) })} />
                    {draft.choices.length > 2 && (
                      <button className="btn-ghost !px-2 text-red-500" aria-label="Удалить вариант"
                        onClick={() => setDraft({ ...draft, choices: draft.choices.filter((_, j) => j !== i) })}>✕</button>
                    )}
                  </div>
                ))}
                {draft.choices.length < 8 && (
                  <button className="btn-ghost text-xs" onClick={() => setDraft({ ...draft, choices: [...draft.choices, { textKk: "", textRu: "", correct: false }] })}>
                    + вариант
                  </button>
                )}
              </div>
            </div>
          )}

          {hasConfig && !hasChoices && (
            <Field label="Конфигурация типа (JSON — шаблон подставлен автоматически)" hint="Для MATCHING/ORDERING/FILL_BLANKS задаются пары/элементы/пропуски на двух языках">
              <textarea className="input resize-y font-mono text-xs" rows={6} value={draft.configText}
                onChange={(e) => setDraft({ ...draft, configText: e.target.value })} />
            </Field>
          )}
          {draft.type === "MULTI_CHOICE" && (
            <Field label="Частичный балл (JSON)">
              <textarea className="input resize-y font-mono text-xs" rows={2} value={draft.configText}
                onChange={(e) => setDraft({ ...draft, configText: e.target.value })} />
            </Field>
          )}

          <Bilingual label="Объяснение правильного ответа" area kk={draft.explanationKk} ru={draft.explanationRu}
            onKk={(v) => setDraft({ ...draft, explanationKk: v })} onRu={(v) => setDraft({ ...draft, explanationRu: v })} />

          <Field label="Теги (через запятую)">
            <input className="input" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
          </Field>

          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-outline" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={save} disabled={!draft.subjectId}>Сохранить</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
