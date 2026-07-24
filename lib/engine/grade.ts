// Автооценивание (§8): чистые функции без БД — покрываются unit-тестами.
// Возвращают балл 0..points; частичный балл настраивается конфигом вопроса.

import { CONFIG_SCHEMAS, MANUAL_TYPES, type QuestionTypeKey } from "./types";

export interface GradableQuestion {
  type: QuestionTypeKey;
  points: number;
  config: unknown;
  /** Для choice-типов — из QuestionChoice. */
  choices?: { id: string; correct: boolean }[];
}

export interface GradeResult {
  score: number;
  requiresManual: boolean;
}

const norm = (s: string, caseSensitive: boolean) => {
  const t = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? t : t.toLowerCase();
};

export function gradeAnswer(q: GradableQuestion, response: unknown): GradeResult {
  if (MANUAL_TYPES.includes(q.type)) return { score: 0, requiresManual: true };
  if (response == null) return { score: 0, requiresManual: false };

  const r = response as Record<string, unknown>;
  const pts = q.points;

  switch (q.type) {
    case "SINGLE_CHOICE": {
      const correct = (q.choices ?? []).find((c) => c.correct);
      return { score: correct && r.choiceId === correct.id ? pts : 0, requiresManual: false };
    }
    case "MULTI_CHOICE": {
      const cfg = CONFIG_SCHEMAS.MULTI_CHOICE.parse(q.config ?? {});
      const correctIds = new Set((q.choices ?? []).filter((c) => c.correct).map((c) => c.id));
      const picked = new Set((r.choiceIds as string[]) ?? []);
      if (correctIds.size === 0) return { score: 0, requiresManual: false };
      const hits = [...picked].filter((id) => correctIds.has(id)).length;
      const wrong = [...picked].filter((id) => !correctIds.has(id)).length;
      if (cfg.partial === "all_or_nothing") {
        const exact = hits === correctIds.size && wrong === 0;
        return { score: exact ? pts : 0, requiresManual: false };
      }
      // proportional: доля верных минус доля лишних, не ниже нуля
      const frac = Math.max(0, hits / correctIds.size - wrong / correctIds.size);
      return { score: round2(pts * frac), requiresManual: false };
    }
    case "TRUE_FALSE": {
      const cfg = CONFIG_SCHEMAS.TRUE_FALSE.parse(q.config);
      return { score: r.value === cfg.answer ? pts : 0, requiresManual: false };
    }
    case "SHORT_TEXT": {
      const cfg = CONFIG_SCHEMAS.SHORT_TEXT.parse(q.config);
      const given = norm(String(r.text ?? ""), cfg.caseSensitive);
      if (!given) return { score: 0, requiresManual: false };
      const all = [...cfg.answers.kk, ...cfg.answers.ru].map((a) => norm(a, cfg.caseSensitive));
      return { score: all.includes(given) ? pts : 0, requiresManual: false };
    }
    case "NUMERIC": {
      const cfg = CONFIG_SCHEMAS.NUMERIC.parse(q.config);
      const v = Number(r.value);
      if (!Number.isFinite(v)) return { score: 0, requiresManual: false };
      return { score: Math.abs(v - cfg.answer) <= cfg.tolerance ? pts : 0, requiresManual: false };
    }
    case "FILL_BLANKS": {
      const cfg = CONFIG_SCHEMAS.FILL_BLANKS.parse(q.config);
      const values = (r.values as Record<string, string>) ?? {};
      let hit = 0;
      for (const b of cfg.blanks) {
        const given = norm(String(values[b.id] ?? ""), cfg.caseSensitive);
        const all = [...b.answers.kk, ...b.answers.ru].map((a) => norm(a, cfg.caseSensitive));
        if (given && all.includes(given)) hit++;
      }
      if (cfg.blanks.length === 0) return { score: 0, requiresManual: false };
      if (!cfg.partial) return { score: hit === cfg.blanks.length ? pts : 0, requiresManual: false };
      return { score: round2((pts * hit) / cfg.blanks.length), requiresManual: false };
    }
    case "MATCHING": {
      const cfg = CONFIG_SCHEMAS.MATCHING.parse(q.config);
      const pairs = (r.pairs as { l: number; r: number }[]) ?? [];
      const seen = new Set<number>();
      let hit = 0;
      for (const p of pairs) {
        if (seen.has(p.l)) continue; // защита от дублей левого элемента
        seen.add(p.l);
        if (p.l === p.r && p.l >= 0 && p.l < cfg.pairs.length) hit++;
      }
      if (!cfg.partial) return { score: hit === cfg.pairs.length ? pts : 0, requiresManual: false };
      return { score: round2((pts * hit) / cfg.pairs.length), requiresManual: false };
    }
    case "ORDERING": {
      const cfg = CONFIG_SCHEMAS.ORDERING.parse(q.config);
      const order = (r.order as number[]) ?? [];
      const n = cfg.items.length;
      if (order.length !== n) return { score: 0, requiresManual: false };
      let inPlace = 0;
      for (let i = 0; i < n; i++) if (order[i] === i) inPlace++;
      if (!cfg.partial) return { score: inPlace === n ? pts : 0, requiresManual: false };
      return { score: round2((pts * inPlace) / n), requiresManual: false };
    }
    default:
      return { score: 0, requiresManual: false };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
