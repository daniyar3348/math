"use client";

// Questions manager: bilingual prompt/options/explanation, pick the correct
// option, add/edit/delete. Everything persists to the DB via /api/admin.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, post, put, del } from "@/lib/api";
import { Field, Area, AdminSection, DangerBtn } from "@/components/admin";
import { Spinner } from "@/components/ui";

interface OptionRow {
  id: string;
  text_kk: string;
  text_ru: string;
}
interface QuestionRow {
  id: string;
  challenge_id: string;
  prompt_kk: string;
  prompt_ru: string;
  explanation_kk: string;
  explanation_ru: string;
  options: OptionRow[];
  correctIndex: number;
}
interface ChallengeRow {
  id: string;
  course_id: string;
  title_ru: string;
}

interface Draft {
  id?: string;
  prompt_kk: string;
  prompt_ru: string;
  explanation_kk: string;
  explanation_ru: string;
  options: { text_kk: string; text_ru: string }[];
  correctIndex: number;
}

const emptyDraft = (): Draft => ({
  prompt_kk: "",
  prompt_ru: "",
  explanation_kk: "",
  explanation_ru: "",
  options: [
    { text_kk: "", text_ru: "" },
    { text_kk: "", text_ru: "" },
    { text_kk: "", text_ru: "" },
    { text_kk: "", text_ru: "" },
  ],
  correctIndex: 0,
});

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvCell(s: string) {
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AdminQuestions() {
  const { id } = useParams<{ id: string }>();
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [rows, setRows] = useState<QuestionRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importReplace, setImportReplace] = useState(false);
  const [importMsg, setImportMsg] = useState<string[]>([]);

  const load = useCallback(() => {
    api<{ rows: QuestionRow[] }>(`/api/admin/questions?challenge_id=${id}`).then((d) =>
      setRows(d.rows)
    );
    api<{ rows: ChallengeRow[] }>(`/api/admin/challenges`).then((d) =>
      setChallenge(d.rows.find((r) => r.id === id) ?? null)
    );
  }, [id]);
  useEffect(load, [load]);

  if (!rows) return <Spinner />;

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const payload = { ...draft, challenge_id: id };
      if (draft.id) await put(`/api/admin/questions/${draft.id}`, payload);
      else await post("/api/admin/questions", payload);
      setDraft(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const editQuestion = (q: QuestionRow) =>
    setDraft({
      id: q.id,
      prompt_kk: q.prompt_kk,
      prompt_ru: q.prompt_ru,
      explanation_kk: q.explanation_kk,
      explanation_ru: q.explanation_ru,
      options: q.options.map((o) => ({ text_kk: o.text_kk, text_ru: o.text_ru })),
      correctIndex: Math.max(q.correctIndex, 0),
    });

  return (
    <div className="space-y-6">
      <div>
        {challenge && (
          <Link
            href={`/admin/courses/${challenge.course_id}`}
            className="text-sm font-semibold text-slate-400 hover:text-brand"
          >
            ← {challenge.title_ru}
          </Link>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Вопросы ({rows.length})
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-outline !py-2 text-xs"
              onClick={() => {
                const data = rows.map((q) => ({
                  prompt_kk: q.prompt_kk,
                  prompt_ru: q.prompt_ru,
                  explanation_kk: q.explanation_kk,
                  explanation_ru: q.explanation_ru,
                  options: q.options.map((o) => ({ text_kk: o.text_kk, text_ru: o.text_ru })),
                  correctIndex: Math.max(q.correctIndex, 0),
                }));
                download(`questions-${id}.json`, JSON.stringify({ questions: data }, null, 2), "application/json");
              }}
            >
              ⬇ JSON
            </button>
            <button
              className="btn-outline !py-2 text-xs"
              onClick={() => {
                const header =
                  "prompt_kk;prompt_ru;opt1_kk;opt1_ru;opt2_kk;opt2_ru;opt3_kk;opt3_ru;opt4_kk;opt4_ru;correct;explanation_kk;explanation_ru";
                const lines = rows.map((q) => {
                  const cells = [q.prompt_kk, q.prompt_ru];
                  for (let i = 0; i < 4; i++) {
                    cells.push(q.options[i]?.text_kk ?? "", q.options[i]?.text_ru ?? "");
                  }
                  cells.push(String(Math.max(q.correctIndex, 0) + 1), q.explanation_kk, q.explanation_ru);
                  return cells.map(csvCell).join(";");
                });
                // BOM so Excel opens UTF-8 Cyrillic correctly
                download(`questions-${id}.csv`, "\uFEFF" + [header, ...lines].join("\n"), "text/csv;charset=utf-8");
              }}
            >
              ⬇ CSV
            </button>
            <button className="btn-outline !py-2 text-xs" onClick={() => setImportOpen((v) => !v)}>
              ⬆ Импорт
            </button>
            <button className="btn-brand !py-2" onClick={() => setDraft(emptyDraft())}>
              + Вопрос
            </button>
          </div>
        </div>
      </div>

      {importOpen && (
        <AdminSection
          title="Импорт вопросов"
          action={
            <button className="btn-ghost !py-1.5" onClick={() => setImportOpen(false)}>
              ✕
            </button>
          }
        >
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={importFormat === "json"}
                onChange={() => setImportFormat("json")}
                className="accent-indigo-600"
              />
              JSON
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={importFormat === "csv"}
                onChange={() => setImportFormat("csv")}
                className="accent-indigo-600"
              />
              CSV (разделитель ; — как в Excel)
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={importReplace}
                onChange={(e) => setImportReplace(e.target.checked)}
                className="accent-red-500"
              />
              заменить существующие
            </label>
            <input
              type="file"
              accept=".json,.csv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.name.endsWith(".csv")) setImportFormat("csv");
                if (f.name.endsWith(".json")) setImportFormat("json");
                f.text().then(setImportText);
              }}
              className="text-xs"
            />
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder='JSON: {"questions":[{"prompt_kk":"…","prompt_ru":"…","options":[{"text_kk":"…","text_ru":"…"},…],"correctIndex":0,"explanation_ru":"…"}]}  |  CSV: см. экспорт как образец'
            className="input mt-3 resize-y font-mono text-xs"
          />
          {importMsg.length > 0 && (
            <div className="mt-2 space-y-0.5 text-xs">
              {importMsg.map((m, i) => (
                <p key={i} className={m.startsWith("✅") ? "text-emerald-600" : "text-amber-600"}>
                  {m}
                </p>
              ))}
            </div>
          )}
          <button
            className="btn-brand mt-3 !py-2"
            disabled={!importText.trim() || busy}
            onClick={async () => {
              setBusy(true);
              setImportMsg([]);
              try {
                const res = await post<{ inserted: number; errors: string[] }>(
                  "/api/admin/questions-import",
                  { challenge_id: id, format: importFormat, data: importText, replace: importReplace }
                );
                setImportMsg([`✅ Импортировано: ${res.inserted}`, ...(res.errors ?? [])]);
                setImportText("");
                load();
              } catch (e) {
                setImportMsg([`⚠️ Ошибка: ${e instanceof Error ? e.message : "unknown"}`]);
              } finally {
                setBusy(false);
              }
            }}
          >
            Импортировать
          </button>
        </AdminSection>
      )}

      {draft && (
        <AdminSection
          title={draft.id ? "Редактировать вопрос" : "Новый вопрос"}
          action={
            <button className="btn-ghost !py-1.5" onClick={() => setDraft(null)}>
              ✕
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Area
              label="Вопрос (KK)"
              value={draft.prompt_kk}
              onChange={(v) => setDraft({ ...draft, prompt_kk: v })}
            />
            <Area
              label="Вопрос (RU)"
              value={draft.prompt_ru}
              onChange={(v) => setDraft({ ...draft, prompt_ru: v })}
            />
          </div>

          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold text-slate-500">
              Варианты (отметь правильный)
            </span>
            {draft.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={draft.correctIndex === i}
                  onChange={() => setDraft({ ...draft, correctIndex: i })}
                  className="h-4 w-4 flex-none accent-emerald-600"
                  title="Правильный ответ"
                />
                <input
                  value={o.text_kk}
                  placeholder={`Вариант ${i + 1} (KK)`}
                  onChange={(e) => {
                    const options = [...draft.options];
                    options[i] = { ...options[i], text_kk: e.target.value };
                    setDraft({ ...draft, options });
                  }}
                  className="input"
                />
                <input
                  value={o.text_ru}
                  placeholder={`Вариант ${i + 1} (RU)`}
                  onChange={(e) => {
                    const options = [...draft.options];
                    options[i] = { ...options[i], text_ru: e.target.value };
                    setDraft({ ...draft, options });
                  }}
                  className="input"
                />
                {draft.options.length > 2 && (
                  <DangerBtn
                    onClick={() => {
                      const options = draft.options.filter((_, j) => j !== i);
                      setDraft({
                        ...draft,
                        options,
                        correctIndex:
                          draft.correctIndex === i
                            ? 0
                            : draft.correctIndex > i
                            ? draft.correctIndex - 1
                            : draft.correctIndex,
                      });
                    }}
                  >
                    ✕
                  </DangerBtn>
                )}
              </div>
            ))}
            {draft.options.length < 6 && (
              <button
                onClick={() =>
                  setDraft({
                    ...draft,
                    options: [...draft.options, { text_kk: "", text_ru: "" }],
                  })
                }
                className="btn-ghost !py-1.5 text-xs"
              >
                + Вариант
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Area
              label="Разбор (KK)"
              value={draft.explanation_kk}
              onChange={(v) => setDraft({ ...draft, explanation_kk: v })}
            />
            <Area
              label="Разбор (RU)"
              value={draft.explanation_ru}
              onChange={(v) => setDraft({ ...draft, explanation_ru: v })}
            />
          </div>

          <button onClick={save} disabled={busy} className="btn-brand mt-4 !py-2.5">
            {busy ? "Сохранение…" : "Сохранить вопрос"}
          </button>
        </AdminSection>
      )}

      <div className="space-y-3">
        {rows.map((q, i) => (
          <div key={q.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-400">#{i + 1}</div>
                <p className="mt-0.5 font-semibold text-slate-800">{q.prompt_ru}</p>
                <p className="text-sm text-slate-500">{q.prompt_kk}</p>
              </div>
              <div className="flex flex-none gap-1">
                <button
                  onClick={() => editQuestion(q)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  ✏️ Изменить
                </button>
                <DangerBtn
                  onClick={async () => {
                    if (!confirm("Удалить вопрос?")) return;
                    await del(`/api/admin/questions/${q.id}`);
                    load();
                  }}
                >
                  Удалить
                </DangerBtn>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.options.map((o, j) => (
                <span
                  key={o.id}
                  className={`chip ${
                    j === q.correctIndex
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {j === q.correctIndex && "✓ "}
                  {o.text_ru}
                </span>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-slate-400">Пока нет вопросов — добавь первый.</p>
        )}
      </div>
    </div>
  );
}
