"use client";

// Экран прохождения теста (§8): серверный таймер (синхронизация по serverNow),
// автосохранение (debounce), восстановление после перезагрузки, навигация
// с метками отвечен/пропущен/помечен, предупреждение о неотвеченных,
// аналитика переключения вкладки, автоотправка по времени.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import katex from "katex";
import { t, pickPair, type Locale } from "@/lib/i18n";
import { Modal, Skeleton } from "@/components/ui";

interface Item {
  index: number;
  questionId: string;
  type: string;
  points: number;
  sectionKk: string;
  sectionRu: string;
  translations: { locale: string; prompt: string }[];
  choices: { id: string; textKk: string; textRu: string }[];
  config: Record<string, unknown>;
  response: Record<string, unknown> | null;
  flagged: boolean;
}

interface AttemptData {
  attempt: {
    id: string;
    status: string;
    deadlineAt: string | null;
    serverNow: string;
    testSlug: string;
    allowBack: boolean;
    onePerPage: boolean;
    autoSubmit: boolean;
    translations: { locale: string; title: string; instructions: string }[];
  };
  items: Item[];
}

function esc(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function mathHtml(s: string): string {
  return esc(s)
    .replace(/\$\$([^$]+)\$\$/g, (_, tex) => katex.renderToString(tex, { displayMode: true, throwOnError: false }))
    .replace(/\$([^$\n]+)\$/g, (_, tex) => katex.renderToString(tex, { throwOnError: false }));
}

export function AttemptRunner({ locale, attemptId }: { locale: Locale; attemptId: string }) {
  const router = useRouter();
  const [data, setData] = useState<AttemptData | null>(null);
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, Record<string, unknown> | null>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [leftSec, setLeftSec] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const finishedRef = useRef(false);
  // Ответы, ожидающие отправки (debounce ещё не сработал) — сбрасываются
  // на сервер перед завершением, иначе быстрый клик «Завершить» терял ответ.
  const pendingRef = useRef<Record<string, { response: Record<string, unknown> | null; flagged?: boolean }>>({});

  // загрузка/восстановление
  useEffect(() => {
    fetch(`/api/attempts/${attemptId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const j: AttemptData = await r.json();
        if (j.attempt.status !== "IN_PROGRESS") {
          router.replace(`/${locale}/attempt/${attemptId}/result`);
          return;
        }
        setData(j);
        const resp: Record<string, Record<string, unknown> | null> = {};
        const fl: Record<string, boolean> = {};
        for (const it of j.items) {
          resp[it.questionId] = it.response && Object.keys(it.response).length ? it.response : null;
          fl[it.questionId] = it.flagged;
        }
        setResponses(resp);
        setFlags(fl);
        if (j.attempt.deadlineAt) {
          const drift = Date.now() - new Date(j.attempt.serverNow).getTime();
          const left = Math.floor((new Date(j.attempt.deadlineAt).getTime() + drift - Date.now()) / 1000);
          setLeftSec(Math.max(0, left));
        }
      })
      .catch(() => setError(true));
  }, [attemptId, locale, router]);

  const finish = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinishing(true);
    // сначала доставляем несохранённые ответы
    for (const timer of Object.values(timers.current)) clearTimeout(timer);
    const pending = Object.entries(pendingRef.current);
    pendingRef.current = {};
    await Promise.all(
      pending.map(([questionId, p]) =>
        fetch(`/api/attempts/${attemptId}/answer`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, response: p.response, flagged: p.flagged }),
        }).catch(() => {})
      )
    );
    await fetch(`/api/attempts/${attemptId}/finish`, { method: "POST" }).catch(() => {});
    router.replace(`/${locale}/attempt/${attemptId}/result`);
  }, [attemptId, locale, router]);

  // таймер
  useEffect(() => {
    if (leftSec === null || finishedRef.current) return;
    if (leftSec <= 0) {
      if (data?.attempt.autoSubmit) finish();
      return;
    }
    const id = setTimeout(() => setLeftSec((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [leftSec, data, finish]);

  // аналитика: переключение вкладки
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        fetch(`/api/attempts/${attemptId}/event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "tab_switch" }),
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [attemptId]);

  const save = useCallback(
    (questionId: string, response: Record<string, unknown> | null, flagged?: boolean) => {
      setSaving("saving");
      pendingRef.current[questionId] = { response, flagged };
      clearTimeout(timers.current[questionId]);
      timers.current[questionId] = setTimeout(async () => {
        delete pendingRef.current[questionId];
        await fetch(`/api/attempts/${attemptId}/answer`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, response, flagged }),
        }).catch(() => {});
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 1500);
      }, 600);
    },
    [attemptId]
  );

  const setResponse = (questionId: string, r: Record<string, unknown> | null) => {
    setResponses((prev) => ({ ...prev, [questionId]: r }));
    save(questionId, r, flags[questionId]);
  };
  const toggleFlag = (questionId: string) => {
    const next = !flags[questionId];
    setFlags((prev) => ({ ...prev, [questionId]: next }));
    save(questionId, responses[questionId] ?? null, next);
  };

  if (error)
    return (
      <div className="container-app py-20 text-center" role="alert">
        <p className="text-4xl">⚠️</p>
        <p className="mt-3 font-semibold">{t(locale, "common.error")}</p>
      </div>
    );
  if (!data)
    return (
      <div className="container-app max-w-3xl space-y-4 py-10" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );

  const { attempt, items } = data;
  const title = attempt.translations.find((x) => x.locale === locale)?.title ?? "";
  const item = items[idx];
  const answered = (q: string) => responses[q] != null;
  const unansweredCount = items.filter((it) => !answered(it.questionId)).length;
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="container-app grid gap-6 py-8 lg:grid-cols-[1fr_260px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold">{title}</h1>
          <div className="flex items-center gap-3">
            <span aria-live="polite" className="text-xs text-slate-400">
              {saving === "saving" ? "…" : saving === "saved" ? `✓ ${t(locale, "test.autosaved")}` : ""}
            </span>
            {leftSec !== null && (
              <span
                className={`chip ${leftSec <= 60 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}
                role="timer"
                aria-label={t(locale, "test.timeLeft")}
              >
                ⏱ {fmtTime(leftSec)}
              </span>
            )}
          </div>
        </div>

        <section className="card mt-4 p-6" aria-labelledby="q-heading">
          <div className="flex items-start justify-between gap-3">
            <p id="q-heading" className="text-sm font-bold text-slate-400">
              {t(locale, "test.question")} {idx + 1}/{items.length}
              {(item.sectionKk || item.sectionRu) && (
                <span className="ml-2 font-normal">· {pickPair(locale, item.sectionKk, item.sectionRu)}</span>
              )}
              <span className="ml-2 font-normal">· {item.points} б.</span>
            </p>
            <button
              onClick={() => toggleFlag(item.questionId)}
              aria-pressed={flags[item.questionId]}
              className={`chip ${flags[item.questionId] ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}
            >
              🚩 {t(locale, flags[item.questionId] ? "test.flagged" : "test.flag")}
            </button>
          </div>

          <div
            className="prose-md mt-3 text-lg font-semibold text-slate-900"
            dangerouslySetInnerHTML={{
              __html: mathHtml(item.translations.find((x) => x.locale === locale)?.prompt ?? item.translations[0]?.prompt ?? ""),
            }}
          />

          <div className="mt-5">
            <QuestionInput
              locale={locale}
              item={item}
              value={responses[item.questionId]}
              onChange={(r) => setResponse(item.questionId, r)}
            />
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between">
          <button
            className="btn-outline"
            disabled={idx === 0 || !attempt.allowBack}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            ← {t(locale, "common.back")}
          </button>
          {idx < items.length - 1 ? (
            <button className="btn-primary" onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))}>
              →
            </button>
          ) : (
            <button className="btn-accent" onClick={() => setConfirmOpen(true)}>
              {t(locale, "test.finish")}
            </button>
          )}
        </div>
      </div>

      {/* Навигация по вопросам */}
      <aside>
        <nav aria-label={t(locale, "test.question")} className="card sticky top-24 p-4">
          <div className="grid grid-cols-5 gap-2">
            {items.map((it, i) => {
              const st = answered(it.questionId) ? "answered" : "skipped";
              return (
                <button
                  key={it.questionId}
                  onClick={() => (attempt.allowBack || i >= idx ? setIdx(i) : null)}
                  aria-current={i === idx ? "true" : undefined}
                  aria-label={`${t(locale, "test.question")} ${i + 1}: ${
                    st === "answered" ? t(locale, "test.answered") : t(locale, "test.skipped")
                  }${flags[it.questionId] ? " 🚩" : ""}`}
                  className={`relative grid h-9 w-9 place-items-center rounded-lg text-sm font-bold transition ${
                    i === idx
                      ? "text-white"
                      : st === "answered"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                  style={i === idx ? { background: "var(--primary)" } : undefined}
                >
                  {i + 1}
                  {flags[it.questionId] && <span aria-hidden className="absolute -right-1 -top-1 text-[10px]">🚩</span>}
                </button>
              );
            })}
          </div>
          <button className="btn-accent mt-4 w-full" onClick={() => setConfirmOpen(true)} disabled={finishing}>
            {t(locale, "test.finish")}
          </button>
        </nav>
      </aside>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t(locale, "test.finish")}>
        <p className="text-slate-700">{t(locale, "test.finishConfirm")}</p>
        {unansweredCount > 0 && (
          <p className="mt-2 font-semibold text-amber-600">
            ⚠️ {t(locale, "test.unansweredWarn", { n: unansweredCount })}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setConfirmOpen(false)}>
            {t(locale, "common.cancel")}
          </button>
          <button className="btn-primary" disabled={finishing} onClick={finish}>
            {t(locale, "common.confirm")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ——— Ввод ответа по типу вопроса ———

function QuestionInput({
  locale,
  item,
  value,
  onChange,
}: {
  locale: Locale;
  item: Item;
  value: Record<string, unknown> | null | undefined;
  onChange: (r: Record<string, unknown> | null) => void;
}) {
  const ct = (c: { textKk: string; textRu: string }) => pickPair(locale, c.textKk, c.textRu);
  const lt = (o: unknown) => {
    const x = o as { kk?: string; ru?: string };
    return pickPair(locale, x?.kk ?? "", x?.ru ?? "");
  };

  switch (item.type) {
    case "SINGLE_CHOICE":
      return (
        <fieldset className="space-y-2">
          {item.choices.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition ${value?.choiceId === c.id ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-slate-200 hover:border-slate-300"}`}>
              <input
                type="radio"
                name={item.questionId}
                checked={value?.choiceId === c.id}
                onChange={() => onChange({ choiceId: c.id })}
                className="h-4 w-4"
              />
              <span dangerouslySetInnerHTML={{ __html: mathHtml(ct(c)) }} />
            </label>
          ))}
        </fieldset>
      );

    case "MULTI_CHOICE": {
      const picked = new Set((value?.choiceIds as string[]) ?? []);
      return (
        <fieldset className="space-y-2">
          {item.choices.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition ${picked.has(c.id) ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-slate-200 hover:border-slate-300"}`}>
              <input
                type="checkbox"
                checked={picked.has(c.id)}
                onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  onChange(next.size ? { choiceIds: [...next] } : null);
                }}
                className="h-4 w-4"
              />
              <span dangerouslySetInnerHTML={{ __html: mathHtml(ct(c)) }} />
            </label>
          ))}
        </fieldset>
      );
    }

    case "TRUE_FALSE":
      return (
        <fieldset className="flex gap-3">
          {[true, false].map((v) => (
            <label key={String(v)} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 font-semibold transition ${value?.value === v ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-slate-200 hover:border-slate-300"}`}>
              <input type="radio" name={item.questionId} checked={value?.value === v} onChange={() => onChange({ value: v })} className="sr-only" />
              {v ? `✓ ${t(locale, "common.yes")}` : `✕ ${t(locale, "common.no")}`}
            </label>
          ))}
        </fieldset>
      );

    case "SHORT_TEXT":
      return (
        <input
          className="input"
          value={(value?.text as string) ?? ""}
          onChange={(e) => onChange(e.target.value ? { text: e.target.value } : null)}
          aria-label={t(locale, "assignment.yourAnswer")}
        />
      );

    case "NUMERIC":
      return (
        <input
          type="number"
          step="any"
          className="input max-w-48"
          value={(value?.value as number | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : { value: Number(e.target.value) })}
          aria-label={t(locale, "assignment.yourAnswer")}
        />
      );

    case "FILL_BLANKS": {
      const blankIds = (item.config.blankIds as string[]) ?? [];
      const values = (value?.values as Record<string, string>) ?? {};
      return (
        <div className="space-y-3">
          {blankIds.map((bid) => (
            <div key={bid} className="flex items-center gap-3">
              <span className="chip bg-slate-100 font-mono text-slate-600">{`{{${bid}}}`}</span>
              <input
                className="input"
                value={values[bid] ?? ""}
                aria-label={`${t(locale, "assignment.yourAnswer")} ${bid}`}
                onChange={(e) => {
                  const next = { ...values, [bid]: e.target.value };
                  if (!e.target.value) delete next[bid];
                  onChange(Object.keys(next).length ? { values: next } : null);
                }}
              />
            </div>
          ))}
        </div>
      );
    }

    case "MATCHING": {
      const left = (item.config.left as unknown[]) ?? [];
      const right = (item.config.right as unknown[]) ?? [];
      const rightOrder = (item.config.rightOrder as number[]) ?? right.map((_, i) => i);
      const pairs = (value?.pairs as { l: number; r: number }[]) ?? [];
      const chosen = new Map(pairs.map((p) => [p.l, p.r]));
      return (
        <div className="space-y-3">
          {left.map((lItem, li) => (
            <div key={li} className="flex items-center gap-3">
              <span className="min-w-28 flex-1 rounded-xl bg-slate-50 px-4 py-2.5 font-semibold">{lt(lItem)}</span>
              <span aria-hidden>→</span>
              <select
                className="input flex-1"
                aria-label={lt(lItem)}
                value={chosen.has(li) ? String(chosen.get(li)) : ""}
                onChange={(e) => {
                  const next = new Map(chosen);
                  if (e.target.value === "") next.delete(li);
                  else next.set(li, Number(e.target.value));
                  const arr = [...next.entries()].map(([l, r]) => ({ l, r }));
                  onChange(arr.length ? { pairs: arr } : null);
                }}
              >
                <option value="">—</option>
                {rightOrder.map((canonIdx, pos) => (
                  <option key={canonIdx} value={canonIdx}>
                    {lt(right[pos])}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    case "ORDERING": {
      const presented = (item.config.items as unknown[]) ?? [];
      const canonOrder = (item.config.itemOrder as number[]) ?? presented.map((_, i) => i);
      // текущий порядок (канонические индексы); по умолчанию — как предъявлено
      const order = (value?.order as number[]) ?? canonOrder;
      const labelByCanon = new Map(canonOrder.map((c, pos) => [c, lt(presented[pos])]));
      const move = (from: number, dir: -1 | 1) => {
        const to = from + dir;
        if (to < 0 || to >= order.length) return;
        const next = [...order];
        [next[from], next[to]] = [next[to], next[from]];
        onChange({ order: next });
      };
      return (
        <ol className="space-y-2">
          {order.map((canonIdx, pos) => (
            <li key={canonIdx} className="flex items-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-2.5">
              <span className="w-6 text-sm font-bold text-slate-400">{pos + 1}.</span>
              <span className="flex-1 font-semibold">{labelByCanon.get(canonIdx)}</span>
              <button type="button" className="btn-ghost !px-2" aria-label="↑" disabled={pos === 0} onClick={() => move(pos, -1)}>
                ↑
              </button>
              <button type="button" className="btn-ghost !px-2" aria-label="↓" disabled={pos === order.length - 1} onClick={() => move(pos, 1)}>
                ↓
              </button>
            </li>
          ))}
        </ol>
      );
    }

    case "ESSAY":
      return (
        <textarea
          rows={8}
          className="input resize-y"
          value={(value?.text as string) ?? ""}
          onChange={(e) => onChange(e.target.value ? { text: e.target.value } : null)}
          aria-label={t(locale, "assignment.yourAnswer")}
        />
      );

    case "FILE_UPLOAD":
      return <FileAnswer locale={locale} value={value} onChange={onChange} />;

    default:
      return null;
  }
}

function FileAnswer({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: Record<string, unknown> | null | undefined;
  onChange: (r: Record<string, unknown> | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string>("");
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setName(f.name);
      onChange({ fileId: j.id });
    } catch {
      setName("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        aria-label={t(locale, "assignment.attachFile")}
        className="text-sm"
      />
      {busy && <p className="mt-2 text-sm text-slate-400">…</p>}
      {(value?.fileId as string) && !busy && (
        <p className="mt-2 text-sm font-semibold text-emerald-600">✓ {name || "OK"}</p>
      )}
    </div>
  );
}
