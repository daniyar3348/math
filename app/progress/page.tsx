"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { ProgressStats, ApiDeck } from "@/lib/types";
import { Spinner } from "@/components/ui";

export default function ProgressPage() {
  const { t, tr } = useI18n();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [decks, setDecks] = useState<ApiDeck[] | null>(null);

  useEffect(() => {
    api<{ stats: ProgressStats }>("/api/progress").then((d) => setStats(d.stats)).catch(() => setStats(null));
    api<{ decks: ApiDeck[] }>("/api/decks").then((d) => setDecks(d.decks)).catch(() => setDecks([]));
  }, []);

  if (!stats || decks === null) return <Spinner />;

  const overall = stats.totalCards ? Math.round((stats.learnedCards / stats.totalCards) * 100) : 0;

  return (
    <div className="container-app max-w-3xl py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold text-slate-900">{t("yourProgress")}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat value={`🔥 ${stats.streak}`} label={t("streak")} accent="text-orange-500" />
        <Stat value={stats.reviewsToday} label={t("reviewsToday")} accent="text-brand" />
        <Stat value={stats.dueNow} label={t("dueNow")} accent="text-amber-500" />
        <Stat value={`${stats.learnedCards}/${stats.totalCards}`} label={t("learned")} accent="text-emerald-600" />
      </div>

      {/* overall bar */}
      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">{t("learned")}</span>
          <span className="font-bold text-brand">{overall}%</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${overall}%` }} />
        </div>
      </div>

      {/* per-deck */}
      <h2 className="mt-8 mb-3 text-lg font-bold text-slate-800">{t("decks")}</h2>
      <div className="card divide-y divide-slate-100">
        {decks.map((d) => {
          const pct = d.total ? Math.round((d.learned / d.total) * 100) : 0;
          return (
            <Link key={d.id} href={`/review/${d.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
              <span className="text-2xl">{d.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">{tr({ kk: d.title_kk, ru: d.title_ru })}</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-500">
                {d.learned}/{d.total}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent: string }) {
  return (
    <div className="card p-4 text-center">
      <div className={`text-2xl font-extrabold ${accent}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium leading-tight text-slate-400">{label}</div>
    </div>
  );
}
