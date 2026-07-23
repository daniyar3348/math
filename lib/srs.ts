// Spaced-repetition scheduler (SM-2 lite). Pure & shared (client + server).
// Day-based intervals; "again" reschedules within the same session.

export type Grade = "again" | "hard" | "good" | "easy";

export interface SrsState {
  ease: number; // ease factor, starts 2.5
  intervalDays: number; // current interval in days (0 = learning)
  reps: number; // successful reps in a row
  lapses: number; // times forgotten
}

export const DEFAULT_SRS: SrsState = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };
const MIN_EASE = 1.3;
const DAY = 86_400_000;
const AGAIN_MS = 60_000; // ~1 min — comes back this session

const round1 = (n: number) => Math.round(n * 10) / 10;

export function schedule(
  prev: SrsState | null,
  grade: Grade,
  now: number
): { next: SrsState; dueAt: number } {
  const s = prev ?? { ...DEFAULT_SRS };
  let { ease, intervalDays, reps, lapses } = s;

  switch (grade) {
    case "again":
      ease = Math.max(MIN_EASE, ease - 0.2);
      reps = 0;
      lapses += 1;
      intervalDays = 0;
      return { next: { ease, intervalDays, reps, lapses }, dueAt: now + AGAIN_MS };

    case "hard":
      ease = Math.max(MIN_EASE, ease - 0.15);
      intervalDays = intervalDays > 0 ? Math.max(1, round1(intervalDays * 1.2)) : 1;
      reps += 1;
      break;

    case "good":
      if (reps === 0) intervalDays = 1;
      else if (reps === 1) intervalDays = 3;
      else intervalDays = Math.max(1, Math.round(intervalDays * ease));
      reps += 1;
      break;

    case "easy":
      ease = ease + 0.1;
      intervalDays = reps === 0 ? 2 : Math.max(1, Math.round(intervalDays * ease * 1.3));
      reps += 1;
      break;
  }

  return { next: { ease: round1(ease), intervalDays, reps, lapses }, dueAt: now + intervalDays * DAY };
}

// Human-friendly "next review in" label for a grade preview.
export function nextLabel(prev: SrsState | null, grade: Grade, lang: "kk" | "ru"): string {
  const { dueAt } = schedule(prev, grade, Date.now());
  const mins = Math.round((dueAt - Date.now()) / 60000);
  if (mins < 60) return lang === "kk" ? `${mins} мин` : `${mins} мин`;
  const days = Math.round(mins / 1440);
  if (days < 1) return lang === "kk" ? "1 сағ" : "1 ч";
  return lang === "kk" ? `${days} күн` : `${days} дн`;
}
