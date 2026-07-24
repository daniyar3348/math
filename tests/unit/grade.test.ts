// Unit-тесты автооценивания (§8, §18): все объективные типы, частичный балл,
// ручные типы, защита от мусорных ответов.
import { describe, it, expect } from "vitest";
import { gradeAnswer, type GradableQuestion } from "@/lib/engine/grade";

const q = (type: GradableQuestion["type"], points: number, config: unknown = {}, choices?: GradableQuestion["choices"]): GradableQuestion =>
  ({ type, points, config, choices });

describe("SINGLE_CHOICE", () => {
  const choices = [
    { id: "a", correct: false },
    { id: "b", correct: true },
    { id: "c", correct: false },
  ];
  it("полный балл за верный вариант", () => {
    expect(gradeAnswer(q("SINGLE_CHOICE", 2, {}, choices), { choiceId: "b" })).toEqual({ score: 2, requiresManual: false });
  });
  it("ноль за неверный вариант и за null", () => {
    expect(gradeAnswer(q("SINGLE_CHOICE", 2, {}, choices), { choiceId: "a" }).score).toBe(0);
    expect(gradeAnswer(q("SINGLE_CHOICE", 2, {}, choices), null).score).toBe(0);
  });
});

describe("MULTI_CHOICE", () => {
  const choices = [
    { id: "a", correct: true },
    { id: "b", correct: true },
    { id: "c", correct: true },
    { id: "d", correct: false },
  ];
  it("proportional: hits/correct − wrong/correct, не ниже нуля", () => {
    // 2 верных из 3 + 1 лишний → 2/3 − 1/3 = 1/3 от 6 = 2
    expect(gradeAnswer(q("MULTI_CHOICE", 6, { partial: "proportional" }, choices), { choiceIds: ["a", "b", "d"] }).score).toBe(2);
    // только лишние → 0, не отрицательное
    expect(gradeAnswer(q("MULTI_CHOICE", 6, { partial: "proportional" }, choices), { choiceIds: ["d"] }).score).toBe(0);
    // все верные без лишних → полный балл
    expect(gradeAnswer(q("MULTI_CHOICE", 6, { partial: "proportional" }, choices), { choiceIds: ["a", "b", "c"] }).score).toBe(6);
  });
  it("all_or_nothing: только точное совпадение", () => {
    const cfg = { partial: "all_or_nothing" };
    expect(gradeAnswer(q("MULTI_CHOICE", 5, cfg, choices), { choiceIds: ["a", "b", "c"] }).score).toBe(5);
    expect(gradeAnswer(q("MULTI_CHOICE", 5, cfg, choices), { choiceIds: ["a", "b"] }).score).toBe(0);
    expect(gradeAnswer(q("MULTI_CHOICE", 5, cfg, choices), { choiceIds: ["a", "b", "c", "d"] }).score).toBe(0);
  });
});

describe("TRUE_FALSE", () => {
  it("сравнивает с config.answer", () => {
    expect(gradeAnswer(q("TRUE_FALSE", 1, { answer: true }), { value: true }).score).toBe(1);
    expect(gradeAnswer(q("TRUE_FALSE", 1, { answer: true }), { value: false }).score).toBe(0);
  });
});

describe("SHORT_TEXT", () => {
  const cfg = { answers: { kk: ["Астана"], ru: ["Астана", "г. Астана"] }, caseSensitive: false };
  it("принимает ответы обоих языков без учёта регистра и лишних пробелов", () => {
    expect(gradeAnswer(q("SHORT_TEXT", 2, cfg), { text: "  астана " }).score).toBe(2);
    expect(gradeAnswer(q("SHORT_TEXT", 2, cfg), { text: "Г.  АСТАНА" }).score).toBe(2);
    expect(gradeAnswer(q("SHORT_TEXT", 2, cfg), { text: "Алматы" }).score).toBe(0);
    expect(gradeAnswer(q("SHORT_TEXT", 2, cfg), { text: "" }).score).toBe(0);
  });
  it("caseSensitive: регистр учитывается", () => {
    const cs = { answers: { kk: [], ru: ["pH"] }, caseSensitive: true };
    expect(gradeAnswer(q("SHORT_TEXT", 1, cs), { text: "pH" }).score).toBe(1);
    expect(gradeAnswer(q("SHORT_TEXT", 1, cs), { text: "ph" }).score).toBe(0);
  });
});

describe("NUMERIC", () => {
  it("границы допуска включительно", () => {
    const cfg = { answer: 10, tolerance: 0.5 };
    expect(gradeAnswer(q("NUMERIC", 3, cfg), { value: 10.5 }).score).toBe(3);
    expect(gradeAnswer(q("NUMERIC", 3, cfg), { value: 9.5 }).score).toBe(3);
    expect(gradeAnswer(q("NUMERIC", 3, cfg), { value: 10.51 }).score).toBe(0);
    expect(gradeAnswer(q("NUMERIC", 3, cfg), { value: "не число" }).score).toBe(0);
  });
});

describe("FILL_BLANKS", () => {
  const cfg = {
    blanks: [
      { id: "b1", answers: { kk: ["төрт"], ru: ["четыре", "4"] } },
      { id: "b2", answers: { kk: ["сегіз"], ru: ["восемь", "8"] } },
    ],
    caseSensitive: false,
    partial: true,
  };
  it("частичный балл по числу верных пропусков", () => {
    expect(gradeAnswer(q("FILL_BLANKS", 4, cfg), { values: { b1: "4", b2: "семь" } }).score).toBe(2);
    expect(gradeAnswer(q("FILL_BLANKS", 4, cfg), { values: { b1: "төрт", b2: "8" } }).score).toBe(4);
  });
  it("без partial — только всё или ничего", () => {
    const strict = { ...cfg, partial: false };
    expect(gradeAnswer(q("FILL_BLANKS", 4, strict), { values: { b1: "4" } }).score).toBe(0);
  });
});

describe("MATCHING", () => {
  const cfg = {
    pairs: [
      { left: { kk: "1", ru: "1" }, right: { kk: "a", ru: "a" } },
      { left: { kk: "2", ru: "2" }, right: { kk: "b", ru: "b" } },
      { left: { kk: "3", ru: "3" }, right: { kk: "c", ru: "c" } },
    ],
    partial: true,
  };
  it("частичный балл; канон — l===r", () => {
    expect(gradeAnswer(q("MATCHING", 3, cfg), { pairs: [{ l: 0, r: 0 }, { l: 1, r: 2 }, { l: 2, r: 1 }] }).score).toBe(1);
    expect(gradeAnswer(q("MATCHING", 3, cfg), { pairs: [{ l: 0, r: 0 }, { l: 1, r: 1 }, { l: 2, r: 2 }] }).score).toBe(3);
  });
  it("дубль левого элемента не даёт двойной балл", () => {
    expect(gradeAnswer(q("MATCHING", 3, cfg), { pairs: [{ l: 0, r: 0 }, { l: 0, r: 0 }, { l: 0, r: 0 }] }).score).toBe(1);
  });
});

describe("ORDERING", () => {
  const cfg = { items: [{ kk: "а", ru: "а" }, { kk: "б", ru: "б" }, { kk: "в", ru: "в" }, { kk: "г", ru: "г" }], partial: true };
  it("частичный балл по числу элементов на своём месте", () => {
    expect(gradeAnswer(q("ORDERING", 4, cfg), { order: [0, 1, 3, 2] }).score).toBe(2);
    expect(gradeAnswer(q("ORDERING", 4, cfg), { order: [0, 1, 2, 3] }).score).toBe(4);
  });
  it("неверная длина массива → 0", () => {
    expect(gradeAnswer(q("ORDERING", 4, cfg), { order: [0, 1] }).score).toBe(0);
  });
});

describe("ручные типы", () => {
  it("ESSAY и FILE_UPLOAD уходят в ручную проверку с нулевым автобаллом", () => {
    expect(gradeAnswer(q("ESSAY", 10, { minWords: 0 }), { text: "..." })).toEqual({ score: 0, requiresManual: true });
    expect(gradeAnswer(q("FILE_UPLOAD", 5, { maxSizeMb: 10 }), { fileId: "x" })).toEqual({ score: 0, requiresManual: true });
  });
});
