// Движок тестов: типы конфигураций 10 видов вопросов, форматы ответов, zod-схемы.
// config хранится в Question.config (Json), двуязычные фрагменты — внутри
// ({kk,ru}) либо в QuestionTranslation (prompt/explanation/extra).

import { z } from "zod";

export const LText = z.object({ kk: z.string(), ru: z.string() });
export type LTextT = z.infer<typeof LText>;

// ——— Конфиги по типам ———

export const SingleChoiceConfig = z.object({}).default({}); // варианты — в QuestionChoice
export const MultiChoiceConfig = z.object({
  partial: z.enum(["proportional", "all_or_nothing"]).default("proportional"),
});
export const TrueFalseConfig = z.object({ answer: z.boolean() });
export const ShortTextConfig = z.object({
  answers: z.object({ kk: z.array(z.string()).default([]), ru: z.array(z.string()).default([]) }),
  caseSensitive: z.boolean().default(false),
});
export const NumericConfig = z.object({
  answer: z.number(),
  tolerance: z.number().min(0).default(0),
});
export const FillBlanksConfig = z.object({
  // Плейсхолдеры {{id}} в тексте вопроса; ответы по каждому пропуску
  blanks: z.array(
    z.object({
      id: z.string(),
      answers: z.object({ kk: z.array(z.string()).default([]), ru: z.array(z.string()).default([]) }),
    })
  ),
  caseSensitive: z.boolean().default(false),
  partial: z.boolean().default(true),
});
export const MatchingConfig = z.object({
  pairs: z.array(z.object({ left: LText, right: LText })).min(2),
  partial: z.boolean().default(true),
});
export const OrderingConfig = z.object({
  items: z.array(LText).min(2), // правильный порядок — как в массиве
  partial: z.boolean().default(true),
});
export const EssayConfig = z.object({ minWords: z.number().int().min(0).default(0) });
export const FileUploadConfig = z.object({
  maxSizeMb: z.number().min(1).max(20).default(10),
});

export const CONFIG_SCHEMAS = {
  SINGLE_CHOICE: SingleChoiceConfig,
  MULTI_CHOICE: MultiChoiceConfig,
  TRUE_FALSE: TrueFalseConfig,
  SHORT_TEXT: ShortTextConfig,
  NUMERIC: NumericConfig,
  FILL_BLANKS: FillBlanksConfig,
  MATCHING: MatchingConfig,
  ORDERING: OrderingConfig,
  ESSAY: EssayConfig,
  FILE_UPLOAD: FileUploadConfig,
} as const;

export type QuestionTypeKey = keyof typeof CONFIG_SCHEMAS;

// ——— Ответы ученика (response в TestAnswer) ———

export const ResponseSchemas = {
  SINGLE_CHOICE: z.object({ choiceId: z.string() }),
  MULTI_CHOICE: z.object({ choiceIds: z.array(z.string()).max(20) }),
  TRUE_FALSE: z.object({ value: z.boolean() }),
  SHORT_TEXT: z.object({ text: z.string().max(500) }),
  NUMERIC: z.object({ value: z.number() }),
  FILL_BLANKS: z.object({ values: z.record(z.string(), z.string().max(200)) }),
  MATCHING: z.object({ pairs: z.array(z.object({ l: z.number().int(), r: z.number().int() })).max(50) }),
  ORDERING: z.object({ order: z.array(z.number().int()).max(50) }),
  ESSAY: z.object({ text: z.string().max(20000) }),
  FILE_UPLOAD: z.object({ fileId: z.string() }),
} as const;

export function parseResponse(type: QuestionTypeKey, raw: unknown) {
  return ResponseSchemas[type].parse(raw);
}

export const MANUAL_TYPES: QuestionTypeKey[] = ["ESSAY", "FILE_UPLOAD"];

// ——— Снимок раскладки попытки (TestAttempt.layout) ———

export interface LayoutItem {
  questionId: string;
  points: number;
  sectionKk: string;
  sectionRu: string;
  /** Для choice-типов: порядок вариантов (id) с учётом перемешивания. */
  choiceOrder?: string[];
  /** Для ORDERING/MATCHING: порядок предъявления элементов (индексы конфига). */
  presentOrder?: number[];
  /** Для MATCHING: порядок правых элементов. */
  presentOrderRight?: number[];
}
