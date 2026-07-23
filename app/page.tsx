"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { ApiDeck, ProgressStats } from "@/lib/types";
import { DeckCard, Spinner } from "@/components/ui";

export default function Home() {
  const { t } = useI18n();
  const [decks, setDecks] = useState<ApiDeck[] | null>(null);
  const [stats, setStats] = useState<ProgressStats | null>(null);

  useEffect(() => {
    api<{ decks: ApiDeck[] }>("/api/decks").then((d) => setDecks(d.decks)).catch(() => setDecks([]));
    api<{ stats: ProgressStats }>("/api/progress").then((d) => setStats(d.stats)).catch(() => {});
  }, []);

  if (decks === null) return <Spinner />;

  const started = !!stats && stats.learnedCards > 0;

  return (
    <div className="container-app py-8 sm:py-12">
      {/* Hero / greeting */}
      <section className="rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 p-6 text-white sm:p-10">
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">
          {t("heroTitle")}
        </h1>
        <p className="mt-3 max-w-xl text-teal-50">{t("heroSub")}</p>
        {stats && (
          <div className="mt-6 flex flex-wrap gap-3">
            <HeroStat value={`🔥 ${stats.streak}`} label={t("streak")} />
            <HeroStat value={`${stats.dueNow}`} label={t("dueNow")} />
            <HeroStat value={`${stats.learnedCards}/${stats.totalCards}`} label={t("learned")} />
          </div>
        )}
        <div className="mt-6">
          <Link
            href="/decks"
            className="inline-flex rounded-xl bg-white px-6 py-3 text-sm font-bold text-teal-700 transition hover:bg-teal-50"
          >
            {started ? t("cont") : t("start")} →
          </Link>
        </div>
      </section>

      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">{t("chooseDeck")}</h2>
        <Link href="/progress" className="text-sm font-semibold text-brand hover:underline">
          {t("yourProgress")} →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((d) => (
          <DeckCard key={d.id} deck={d} />
        ))}
      </div>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[11px] font-medium text-teal-50">{label}</div>
    </div>
  );
}
