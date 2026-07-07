// Client-safe shared types & static reference data.
// No server imports here — this file is imported by client components.

export type Lang = "kk" | "ru";
export type SchoolId = "bil" | "nish" | "ktl";

export interface LocalizedText {
  kk: string;
  ru: string;
}

export interface School {
  id: SchoolId;
  name: LocalizedText;
  full: LocalizedText;
  accent: string;
}

export const SCHOOLS: School[] = [
  {
    id: "bil",
    name: { kk: "БИЛ", ru: "БИЛ" },
    full: { kk: "Білім-инновация лицейлері", ru: "Билим-инновационные лицеи" },
    accent: "emerald",
  },
  {
    id: "nish",
    name: { kk: "НЗМ", ru: "НИШ" },
    full: { kk: "Назарбаев Зияткерлік мектептері", ru: "Назарбаев Интеллектуальные Школы" },
    accent: "sky",
  },
  {
    id: "ktl",
    name: { kk: "ҚТЛ", ru: "КТЛ" },
    full: { kk: "Қазақ-Түрік лицейлері", ru: "Казахско-Турецкие лицеи" },
    accent: "amber",
  },
];

export function schoolById(id: SchoolId | string): School {
  return SCHOOLS.find((s) => s.id === id) ?? SCHOOLS[0];
}

export const REGIONS = [
  "Алматы",
  "Астана",
  "Шымкент",
  "Қарағанды",
  "Атырау",
  "Ақтөбе",
  "Тараз",
  "Павлодар",
  "Өскемен",
  "Орал",
];

// ————— API payload shapes —————

export interface ApiCourse {
  id: string;
  school: SchoolId;
  title: LocalizedText;
  description: LocalizedText;
  level: LocalizedText;
  priceKzt: number;
  cover: string;
  published?: number;
  lessonsCount?: number;
  challengesCount?: number;
}

export interface ApiLesson {
  id: string;
  title: LocalizedText;
  body: LocalizedText | null; // null when the course is locked for this user
  sort: number;
}

export interface ApiChallengeMeta {
  id: string;
  courseId: string;
  title: LocalizedText;
  description: LocalizedText;
  xp: number;
  timeLimitSec: number;
  questionCount: number;
  locked: boolean;
  courseTitle?: LocalizedText;
  school?: SchoolId;
  coursePriceKzt?: number;
}

export interface ApiQuestion {
  id: string;
  prompt: LocalizedText;
  options: { id: string; text: LocalizedText }[];
}

export interface AnswerResult {
  correct: boolean;
  correctOptionId: string;
  explanation: LocalizedText;
}

export interface SubmitResult {
  scorePct: number;
  correctCount: number;
  total: number;
  gainedXp: number;
}

export interface Me {
  user: {
    id: string;
    name: string;
    email: string;
    region: string;
    grade: number | null;
    role: "student" | "admin";
    xp: number;
    totpEnabled: boolean;
  };
  enrolledCourseIds: string[];
  bestScores: Record<string, number>;
}

export interface LeaderboardRow {
  name: string;
  region: string;
  xp: number;
  me: boolean;
}

export interface ApiAttempt {
  id: string;
  challengeId: string;
  challengeTitle: LocalizedText;
  scorePct: number;
  xpEarned: number;
  finishedAt: string;
}
