"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { ApiDeck } from "@/lib/types";

export function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-brand" />
    </div>
  );
}

export function DeckCard({ deck }: { deck: ApiDeck }) {
  const { t, tr } = useI18n();
  const actionable = deck.due + deck.fresh;
  const pct = deck.total ? Math.round((deck.learned / deck.total) * 100) : 0;
  return (
    <Link
      href={`/review/${deck.id}`}
      className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <span className="text-4xl">{deck.emoji}</span>
        {actionable > 0 ? (
          <span className="chip bg-teal-100 text-teal-700">{actionable} {t("study")}</span>
        ) : (
          <span className="chip bg-slate-100 text-slate-400">✓</span>
        )}
      </div>
      <h3 className="mt-3 font-bold text-slate-800 group-hover:text-brand">
        {tr({ kk: deck.title_kk, ru: deck.title_ru })}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
        {tr({ kk: deck.desc_kk, ru: deck.desc_ru })}
      </p>

      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>
            {deck.learned}/{deck.total} {t("learned").toLowerCase()}
          </span>
          <span className="flex gap-2">
            {deck.due > 0 && <span className="text-amber-600">↻ {deck.due}</span>}
            {deck.fresh > 0 && <span className="text-teal-600">+ {deck.fresh}</span>}
          </span>
        </div>
      </div>
    </Link>
  );
}
