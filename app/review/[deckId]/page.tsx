"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { api, post } from "@/lib/api";
import type { ApiCard } from "@/lib/types";
import type { Grade } from "@/lib/srs";
import { Spinner } from "@/components/ui";

const GRADES: { g: Grade; key: string; cls: string; hint: string }[] = [
  { g: "again", key: "again", cls: "bg-red-100 text-red-700 hover:bg-red-200", hint: "<1м" },
  { g: "hard", key: "hard", cls: "bg-amber-100 text-amber-700 hover:bg-amber-200", hint: "~1д" },
  { g: "good", key: "good", cls: "bg-teal-100 text-teal-700 hover:bg-teal-200", hint: "1-3д" },
  { g: "easy", key: "easy", cls: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200", hint: "2д+" },
];

export default function ReviewPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { t, tr } = useI18n();
  const [cards, setCards] = useState<ApiCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setCards(null);
    setIdx(0);
    setRevealed(false);
    api<{ cards: ApiCard[] }>(`/api/review?deck=${deckId}`)
      .then((d) => setCards(d.cards))
      .catch(() => setCards([]));
  }, [deckId]);

  useEffect(load, [load]);

  if (cards === null) return <Spinner />;

  // Empty queue → nothing due
  if (cards.length === 0 && reviewed === 0) {
    return (
      <Centered>
        <div className="text-6xl">🎉</div>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{t("nothingDue")}</h1>
        <p className="mt-2 text-slate-500">{t("allCaughtUp")}</p>
        <Link href="/decks" className="btn-brand mt-6 !py-3">
          {t("backToDecks")}
        </Link>
      </Centered>
    );
  }

  // Session finished
  if (idx >= cards.length) {
    return (
      <Centered>
        <div className="text-6xl">✅</div>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{t("sessionDone")}</h1>
        <p className="mt-2 text-slate-500">
          {reviewed} {t("reviewedN")}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={load} className="btn-outline !py-3">
            ↻ {t("cont")}
          </button>
          <Link href="/decks" className="btn-brand !py-3">
            {t("backToDecks")}
          </Link>
        </div>
      </Centered>
    );
  }

  const card = cards[idx];

  const grade = async (g: Grade) => {
    if (busy) return;
    setBusy(true);
    try {
      await post("/api/review", { cardId: card.id, grade: g });
      setReviewed((n) => n + 1);
      setRevealed(false);
      setIdx((i) => i + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-app max-w-xl py-8">
      {/* progress */}
      <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
        <Link href="/decks" className="hover:text-brand">
          ← {t("backToDecks")}
        </Link>
        <span>
          {idx + 1}/{cards.length}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${(idx / cards.length) * 100}%` }}
        />
      </div>

      {/* card */}
      <div className="mt-6">
        <div className="card flex min-h-64 flex-col items-center justify-center p-8 text-center">
          <div className="text-4xl font-extrabold text-slate-900 sm:text-5xl">{card.kk}</div>
          {card.hint && <div className="mt-2 text-sm text-slate-400">[{card.hint}]</div>}

          {revealed ? (
            <>
              <div className="my-5 h-px w-24 bg-slate-200" />
              <div className="text-2xl font-bold text-brand sm:text-3xl">{card.ru}</div>
            </>
          ) : (
            <p className="mt-6 text-xs text-slate-400">{t("flipHint")}</p>
          )}
        </div>

        {/* actions */}
        {!revealed ? (
          <button onClick={() => setRevealed(true)} className="btn-brand mt-5 w-full !py-3.5 text-base">
            {t("showAnswer")}
          </button>
        ) : (
          <div className="mt-5 grid grid-cols-4 gap-2">
            {GRADES.map(({ g, key, cls, hint }) => (
              <button
                key={g}
                onClick={() => grade(g)}
                disabled={busy}
                className={`flex flex-col items-center rounded-xl px-2 py-3 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${cls}`}
              >
                {t(key)}
                <span className="mt-0.5 text-[10px] font-medium opacity-70">{hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-app max-w-md py-16 text-center">
      <div className="card p-8">{children}</div>
    </div>
  );
}
