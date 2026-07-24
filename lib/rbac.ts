// RBAC: каталог разрешений и наборы по ролям (§3 ТЗ).
// Проверки — ТОЛЬКО на сервере (lib/auth/guard.ts). Скрытие кнопок — UX, не защита.

export const PERMISSIONS = {
  // платформа
  "platform.manage": "Глобальные настройки, организации, администраторы",
  "audit.read": "Просмотр аудита",
  // пользователи
  "users.manage": "Управление пользователями, классами и группами",
  "users.read": "Просмотр пользователей",
  // контент
  "courses.manage": "Создание/редактирование курсов",
  "courses.publish": "Публикация и архивирование курсов",
  "lessons.draft": "Создание черновиков уроков/заданий (в назначенных курсах)",
  "questions.manage": "Банк вопросов: создание и правка",
  "questions.publish": "Публикация вопросов",
  "tests.manage": "Конструктор тестов",
  "tests.publish": "Публикация тестов",
  "challenges.manage": "Создание челленджей",
  "challenges.publish": "Публикация челленджей",
  "landing.manage": "Управление главной страницей и отзывами",
  // учебный процесс
  "enrollments.manage": "Запись учеников на курсы",
  "submissions.review": "Проверка заданий и развёрнутых ответов",
  "grades.read.own": "Просмотр успеваемости своих учеников",
  "grades.read.all": "Просмотр всех результатов и экспорт отчётов",
  "points.adjust": "Ручная корректировка баллов",
  // финансы
  "payments.read": "Просмотр платежей",
  "payments.grant": "Ручная выдача доступа",
  // обучение (студент)
  "learn.self": "Прохождение курсов и тестов",
  // родитель
  "children.read": "Просмотр прогресса привязанных детей",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type RoleKey = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

const ADMIN_PERMS: PermissionKey[] = [
  "users.manage", "users.read",
  "courses.manage", "courses.publish",
  "questions.manage", "questions.publish",
  "tests.manage", "tests.publish",
  "challenges.manage", "challenges.publish",
  "landing.manage",
  "enrollments.manage", "submissions.review",
  "grades.read.all", "grades.read.own",
  "points.adjust", "payments.read", "payments.grant",
  "audit.read",
];

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: [...ADMIN_PERMS, "platform.manage"],
  ADMIN: ADMIN_PERMS,
  // Преподаватель работает только с назначенными курсами (§3) — общий список
  // пользователей ему не положен, свои ученики видны через course-scoped API.
  TEACHER: ["lessons.draft", "submissions.review", "grades.read.own"],
  STUDENT: ["learn.self"],
  PARENT: ["children.read"],
};

export function roleCan(roles: RoleKey[], perm: PermissionKey): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(perm));
}

export function isStaff(roles: RoleKey[]): boolean {
  return roles.some((r) => r === "SUPER_ADMIN" || r === "ADMIN" || r === "TEACHER");
}

export function isAdmin(roles: RoleKey[]): boolean {
  return roles.some((r) => r === "SUPER_ADMIN" || r === "ADMIN");
}
