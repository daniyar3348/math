# Модель данных

~60 моделей Prisma (см. [prisma/schema.prisma](../prisma/schema.prisma)) —
источник истины. Все содержательные сущности принадлежат организации
(multi-tenant-ready, D-012); контентные несут `createdAt/updatedAt`,
`createdById` и мягкое удаление `deletedAt`; переводимый контент — в таблицах
переводов с полем `locale` (kk|ru).

## Кластеры

- **Идентичность**: User, Profile (имя, класс, локаль, opt-out из публичного
  рейтинга), Organization, Role, Permission, RolePermission, Membership,
  StudentParent (связь родитель↔ребёнок), Session (sha256-хэши токенов),
  OtpCode, LoginEvent, RateEvent.
- **Таксономия**: Subject, GradeLevel, Topic, LearningObjective, Cohort,
  CohortMember.
- **LMS**: Course (+CourseTranslation, CourseTeacher), CourseModule,
  Lesson (+LessonTranslation), Resource, Enrollment, LessonProgress,
  Assignment, AssignmentSubmission, GradeItem, Announcement, CourseComment,
  CertificateAward.
- **Тесты**: Question (+QuestionTranslation, QuestionChoice, QuestionVersion,
  QuestionTag), Test (+TestTranslation, TestSection, TestQuestion, TestCohort),
  TestAttempt, TestAnswer, ManualReview.
- **Челленджи/геймификация**: Challenge (+ChallengeTranslation,
  ChallengeActivity, ChallengeEnrollment), PointTransaction (unique
  `idempotencyKey`), Badge, UserBadge.
- **Прочее**: Payment, Notification, AuditLog, FileAsset, Review, SiteSettings.

## ER: ядро тестирования

```mermaid
erDiagram
  Subject ||--o{ Topic : has
  Topic ||--o{ LearningObjective : has
  Subject ||--o{ Question : classifies
  Topic o|--o{ Question : classifies
  Question ||--o{ QuestionTranslation : "kk/ru"
  Question ||--o{ QuestionChoice : choices
  Question ||--o{ QuestionVersion : versions
  Test ||--o{ TestTranslation : "kk/ru"
  Test ||--o{ TestSection : sections
  TestSection ||--o{ TestQuestion : picks
  TestQuestion }o--|| Question : refs
  TestSection o|--o| Topic : "random pool"
  Test ||--o{ TestAttempt : attempts
  TestAttempt ||--o{ TestAnswer : answers
  TestAnswer o|--o| ManualReview : "essay/file"
  User ||--o{ TestAttempt : takes
```

`TestAttempt.layout` (Json) — снимок раскладки на момент старта: список
`{questionId, points, choiceOrder?, presentOrder?, presentOrderRight?}` —
фиксирует перемешивание и случайные выборки, чтобы попытка была
воспроизводимой и оценивалась ровно по тому, что видел ученик.

## ER: LMS

```mermaid
erDiagram
  Course ||--o{ CourseTranslation : "kk/ru"
  Course ||--o{ CourseModule : modules
  Course ||--o{ CourseTeacher : teachers
  CourseModule ||--o{ Lesson : lessons
  Lesson ||--o{ LessonTranslation : "kk/ru"
  Lesson ||--o{ Resource : media
  Course ||--o{ Enrollment : enrolls
  Enrollment }o--|| User : student
  Lesson ||--o{ LessonProgress : progress
  Course ||--o{ Assignment : tasks
  Assignment ||--o{ AssignmentSubmission : submissions
  Course ||--o{ Announcement : news
  Course ||--o{ CertificateAward : certificates
```

## ER: челленджи и баллы

```mermaid
erDiagram
  Challenge ||--o{ ChallengeTranslation : "kk/ru"
  Challenge ||--o{ ChallengeActivity : "tests + weight"
  ChallengeActivity }o--|| Test : refs
  Challenge ||--o{ ChallengeEnrollment : participants
  ChallengeEnrollment }o--|| User : student
  User ||--o{ PointTransaction : points
  User ||--o{ UserBadge : badges
  UserBadge }o--|| Badge : refs
  User ||--o{ Payment : pays
```

## Инварианты

- `PointTransaction.idempotencyKey` уникален — повторное начисление невозможно
  на уровне БД.
- `TestAttempt @@unique(testId,userId,attemptNo)` — нумерация попыток.
- `Payment` меняет статус только PENDING→(PAID|FAILED), PAID→REFUNDED;
  fulfillment выполняется один раз при переходе в PAID.
- Удаление контента — `deletedAt` (архив), физически ничего не удаляется.
