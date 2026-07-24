"use client";

// Проверка работ: развёрнутые ответы тестов + задания курсов (§8/§7).
import { Suspense, useState } from "react";
import { AdminTable, api, Field, type Row } from "@/components/admin/kit";
import { Modal } from "@/components/ui";

function Inner() {
  const [tab, setTab] = useState<"essays" | "assignments">("essays");
  const [grading, setGrading] = useState<Row | null>(null);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const submitGrade = async () => {
    if (!grading) return;
    setMsg("");
    try {
      if (tab === "essays") {
        await api(`/api/review/${grading.id}`, {
          method: "POST",
          body: JSON.stringify({ score: Number(score), comment }),
        });
      } else {
        await api(`/api/submissions/${grading.id}/grade`, {
          method: "POST",
          body: JSON.stringify({ score: Number(score), feedback: comment, status: "GRADED" }),
        });
      }
      setGrading(null);
      setScore("");
      setComment("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Ошибка"}`);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Проверка работ</h1>
      <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ["essays", "Развёрнутые ответы тестов"],
            ["assignments", "Задания курсов"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === k ? "bg-white shadow-sm" : "text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "essays" ? (
        <AdminTable
          key="essays"
          endpoint="/api/review/queue"
          title="Очередь ручной проверки"
          reloadKey={reloadKey}
          columns={[
            { key: "createdAt", title: "Поступил", render: (r) => new Date(r.createdAt).toLocaleString("ru-RU") },
            { key: "student", title: "Ученик" },
            { key: "test", title: "Тест", render: (r) => (r.test as Row[])?.find((t) => t.locale === "ru")?.title ?? "" },
            { key: "questionType", title: "Тип" },
            { key: "maxPoints", title: "Макс. балл" },
            {
              key: "status",
              title: "Статус",
              render: (r) => <span className={`chip ${r.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{r.status}</span>,
            },
            {
              key: "id",
              title: "",
              render: (r) =>
                r.status === "PENDING" ? (
                  <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => { setGrading(r); setMsg(""); setScore(""); setComment(""); }}>
                    Проверить
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">{r.score} б.</span>
                ),
            },
          ]}
        />
      ) : (
        <AdminTable
          key="assignments"
          endpoint="/api/admin/submissions"
          title="Задания"
          reloadKey={reloadKey}
          columns={[
            { key: "submittedAt", title: "Сдано", render: (r) => new Date(r.submittedAt).toLocaleString("ru-RU") },
            { key: "student", title: "Ученик", render: (r) => `${r.student?.profile?.firstName ?? ""} ${r.student?.profile?.lastName ?? ""}` },
            { key: "assignment", title: "Задание", render: (r) => r.assignment?.titleRu ?? "" },
            { key: "attemptNo", title: "Попытка" },
            {
              key: "id",
              title: "",
              render: (r) => (
                <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => { setGrading(r); setMsg(""); setScore(""); setComment(""); }}>
                  Проверить
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal open={!!grading} onClose={() => setGrading(null)} title="Проверка работы">
        {grading && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              {tab === "essays" ? (
                <>
                  <p className="font-semibold text-slate-500">
                    {(grading.questionTranslations as Row[])?.find((t) => t.locale === "ru")?.prompt}
                  </p>
                  <p className="mt-2 whitespace-pre-line">{(grading.response as Row)?.text ?? JSON.stringify(grading.response)}</p>
                  {(grading.response as Row)?.fileId && (
                    <a className="mt-2 inline-block underline" href={`/api/files/${(grading.response as Row).fileId}`} target="_blank">
                      📎 Открыть файл
                    </a>
                  )}
                </>
              ) : (
                <>
                  <p className="whitespace-pre-line">{grading.text || "(без текста)"}</p>
                  {grading.fileAssetId && (
                    <a className="mt-2 inline-block underline" href={`/api/files/${grading.fileAssetId}`} target="_blank">
                      📎 Открыть файл
                    </a>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Балл${tab === "essays" ? ` (макс. ${grading.maxPoints})` : ` (макс. ${grading.assignment?.maxScore ?? 100})`}`}>
                <input className="input" type="number" value={score} onChange={(e) => setScore(e.target.value)} />
              </Field>
            </div>
            <Field label="Комментарий ученику">
              <textarea className="input resize-y" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            {msg && <p className="text-sm font-semibold">{msg}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setGrading(null)}>Отмена</button>
              <button className="btn-primary" onClick={submitGrade} disabled={score === ""}>Выставить</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
