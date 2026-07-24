// Конфиг ресурсов generic-CRUD админки: whitelist моделей/полей (анти-mass-
// assignment), поиск, права. Спец-логика (вопросы/тесты/публикация) — в
// отдельных обработчиках lib/admin-actions.ts.
import { z } from "zod";
import type { PermissionKey } from "./rbac";

export interface ResourceConfig {
  model: string; // имя prisma-модели (camelCase)
  perm: PermissionKey;
  writePerm?: PermissionKey;
  searchFields?: string[]; // строковые поля для поиска contains
  orderBy?: Record<string, "asc" | "desc">;
  // zod-схема записи (create/update); только эти поля попадают в БД
  schema?: z.ZodTypeAny;
  include?: Record<string, unknown>;
  readonly?: boolean;
  softDelete?: boolean;
}

const LocaleText = z.object({ locale: z.enum(["kk", "ru"]) });

export const RESOURCES: Record<string, ResourceConfig> = {
  users: {
    model: "user",
    perm: "users.read",
    writePerm: "users.manage",
    searchFields: ["email", "phone"],
    orderBy: { createdAt: "desc" },
    include: { profile: true, memberships: { include: { role: true } } },
    readonly: true, // мутации — через admin-actions (роли/блокировки/сброс)
  },
  cohorts: {
    model: "cohort",
    perm: "users.manage",
    searchFields: ["name"],
    orderBy: { createdAt: "desc" },
    schema: z.object({
      name: z.string().min(1).max(120),
      gradeLevelId: z.string().nullable().optional(),
      teacherUserId: z.string().nullable().optional(),
    }),
    include: { _count: { select: { members: true } }, gradeLevel: true },
  },
  subjects: {
    model: "subject",
    perm: "courses.manage",
    searchFields: ["nameKk", "nameRu", "slug"],
    orderBy: { sort: "asc" },
    schema: z.object({
      slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
      nameKk: z.string().min(1).max(120),
      nameRu: z.string().min(1).max(120),
      sort: z.number().int().default(0),
    }),
  },
  gradeLevels: {
    model: "gradeLevel",
    perm: "courses.manage",
    orderBy: { number: "asc" },
    schema: z.object({
      number: z.number().int().min(0).max(12),
      nameKk: z.string().min(1).max(60),
      nameRu: z.string().min(1).max(60),
    }),
  },
  topics: {
    model: "topic",
    perm: "courses.manage",
    searchFields: ["nameKk", "nameRu", "slug"],
    orderBy: { sort: "asc" },
    schema: z.object({
      subjectId: z.string().min(1),
      gradeLevelId: z.string().nullable().optional(),
      slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
      nameKk: z.string().min(1).max(160),
      nameRu: z.string().min(1).max(160),
      sort: z.number().int().default(0),
    }),
    include: { subject: true, gradeLevel: true },
  },
  enrollments: {
    model: "enrollment",
    perm: "enrollments.manage",
    orderBy: { createdAt: "desc" },
    schema: z.object({
      userId: z.string().min(1),
      courseId: z.string().min(1),
      cohortId: z.string().nullable().optional(),
      status: z.enum(["ACTIVE", "COMPLETED", "DROPPED"]).default("ACTIVE"),
    }),
    include: { user: { include: { profile: true } }, course: { include: { translations: true } } },
  },
  payments: {
    model: "payment",
    perm: "payments.read",
    orderBy: { createdAt: "desc" },
    include: { user: { include: { profile: true } } },
    readonly: true,
  },
  reviews: {
    model: "review",
    perm: "landing.manage",
    searchFields: ["authorName", "textKk", "textRu"],
    orderBy: { sort: "asc" },
    schema: z.object({
      authorName: z.string().min(1).max(120),
      textKk: z.string().min(1).max(1000),
      textRu: z.string().min(1).max(1000),
      rating: z.number().int().min(1).max(5).default(5),
      published: z.boolean().default(false),
      sort: z.number().int().default(0),
    }),
  },
  files: {
    model: "fileAsset",
    perm: "landing.manage",
    searchFields: ["name", "mime"],
    orderBy: { createdAt: "desc" },
    readonly: true,
    softDelete: true,
  },
  notifications: {
    model: "notification",
    perm: "users.manage",
    orderBy: { createdAt: "desc" },
    readonly: true,
  },
  audit: {
    model: "auditLog",
    perm: "audit.read",
    searchFields: ["action", "entityType", "entityId"],
    orderBy: { createdAt: "desc" },
    readonly: true,
  },
  modules: {
    model: "courseModule",
    perm: "courses.manage",
    orderBy: { sort: "asc" },
    schema: z.object({
      courseId: z.string().min(1),
      titleKk: z.string().min(1).max(200),
      titleRu: z.string().min(1).max(200),
      sort: z.number().int().default(0),
    }),
  },
  assignments: {
    model: "assignment",
    perm: "courses.manage",
    orderBy: { createdAt: "desc" },
    schema: z.object({
      courseId: z.string().min(1),
      moduleId: z.string().nullable().optional(),
      titleKk: z.string().min(1).max(200),
      titleRu: z.string().min(1).max(200),
      descriptionKk: z.string().max(8000).default(""),
      descriptionRu: z.string().max(8000).default(""),
      dueAt: z.string().datetime().nullable().optional().transform((v) => (v ? new Date(v) : null)),
      maxScore: z.number().int().min(1).max(1000).default(100),
      allowResubmit: z.boolean().default(true),
      allowText: z.boolean().default(true),
      allowFile: z.boolean().default(true),
      status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
    }),
    softDelete: true,
  },
  announcements: {
    model: "announcement",
    perm: "courses.manage",
    orderBy: { publishedAt: "desc" },
    schema: z.object({
      courseId: z.string().min(1),
      titleKk: z.string().min(1).max(200),
      titleRu: z.string().min(1).max(200),
      bodyKk: z.string().max(4000).default(""),
      bodyRu: z.string().max(4000).default(""),
    }),
  },
};

export { LocaleText };
