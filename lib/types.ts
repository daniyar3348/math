// Client-safe shared types.

export type Lang = "kk" | "ru";

export interface ApiDeck {
  id: string;
  emoji: string;
  title_kk: string;
  title_ru: string;
  desc_kk: string;
  desc_ru: string;
  total: number;
  due: number; // cards due now (already-seen)
  fresh: number; // never-studied cards
  learned: number; // reps >= 1
}

export interface ApiCard {
  id: string;
  deckId: string;
  kk: string;
  ru: string;
  hint: string | null;
}

export interface ProgressStats {
  totalCards: number;
  learnedCards: number;
  dueNow: number;
  reviewsToday: number;
  streak: number;
}
