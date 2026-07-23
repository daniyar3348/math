"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { ApiDeck } from "@/lib/types";
import { DeckCard, Spinner } from "@/components/ui";

export default function DecksPage() {
  const { t } = useI18n();
  const [decks, setDecks] = useState<ApiDeck[] | null>(null);

  useEffect(() => {
    api<{ decks: ApiDeck[] }>("/api/decks").then((d) => setDecks(d.decks)).catch(() => setDecks([]));
  }, []);

  if (decks === null) return <Spinner />;

  return (
    <div className="container-app py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold text-slate-900">{t("decks")}</h1>
      <p className="mt-2 text-slate-500">{t("tagline")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((d) => (
          <DeckCard key={d.id} deck={d} />
        ))}
      </div>
    </div>
  );
}
