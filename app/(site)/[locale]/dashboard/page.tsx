// Кабинет: маршрутизирует по роли (ученик/преподаватель/родитель) — §11.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { isLocale, t, fmtDate, pickPair, type Locale } from "@/lib/i18n";
import { pointsTotal, streakDays, levelForPoints } from "@/lib/points";
import { isStaff } from "@/lib/rbac";
import { tr } from "@/components/site/cards";
import { ProgressBar, EmptyState } from "@/components/ui";

export default async function Dashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const auth = await getAuth();
  if (!auth) redirect(`/${locale}/login`);

  if (auth.roles.includes("PARENT")) return <ParentCabinet locale={locale} userId={auth.userId} childParam={(await searchParams).child} />;
  if (isStaff(auth.roles)) return <TeacherCabinet locale={locale} userId={auth.userId} admin={auth.roles.includes("ADMIN") || auth.roles.includes("SUPER_ADMIN")} />;
  return <StudentCabinet locale={locale} userId={auth.userId} firstName={auth.profile?.firstName ?? ""} />;
}

// ——— Ученик ———
async function StudentCabinet({ locale, userId, firstName }: { locale: Locale; userId: string; firstName: string }) {
  const now = new Date();
  const [enrollments, upcoming, myChallenges, attempts, points, streak, badges, notifications] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId }, include: { course: { include: { translations: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.assignment.findMany({
      where: { deletedAt: null, status: "PUBLISHED", dueAt: { gte: now }, course: { enrollments: { some: { userId } } } },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    prisma.challengeEnrollment.findMany({
      where: { userId, challenge: { endAt: { gte: now }, status: "PUBLISHED" } },
      include: { challenge: { include: { translations: true } } },
    }),
    prisma.testAttempt.findMany({
      where: { userId, status: "GRADED" },
      orderBy: { submittedAt: "desc" },
      take: 5,
      include: { test: { include: { translations: true } } },
    }),
    pointsTotal(userId),
    streakDays(userId),
    prisma.userBadge.findMany({ where: { userId }, include: { badge: true } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  const L = (p: string) => `/${locale}${p}`;
  const continueCourse = enrollments.find((e) => e.status === "ACTIVE");

  return (
    <div className="container-app py-8">
      <h1 className="text-2xl font-extrabold">👋 {firstName} — {t(locale, "dash.student.title")}</h1>

      {/* Геймификация */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="⭐" value={points} label={t(locale, "dash.points")} />
        <Stat icon="🏅" value={levelForPoints(points)} label={t(locale, "dash.level")} />
        <Stat icon="🔥" value={streak} label={t(locale, "dash.streak")} />
        <Stat icon="🎖️" value={badges.length} label={t(locale, "dash.badges")} />
      </div>

      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span key={b.badgeId} className="chip bg-white shadow-sm" title={pickPair(locale, b.badge.descKk, b.badge.descRu)}>
              {b.badge.icon} {pickPair(locale, b.badge.nameKk, b.badge.nameRu)}
            </span>
          ))}
        </div>
      )}

      {continueCourse && (
        <Link href={L(`/courses/${continueCourse.course.slug}`)} className="card mt-6 block p-5 transition hover:shadow-lg" style={{ background: "var(--primary)", border: "none" }}>
          <p className="text-sm font-semibold text-white/80">{t(locale, "dash.continueLearning")}</p>
          <p className="mt-1 text-xl font-extrabold text-white">{tr(continueCourse.course.translations, locale)?.title}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${continueCourse.progressPct}%` }} />
          </div>
        </Link>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">{t(locale, "dash.myCourses")}</h2>
          {enrollments.length === 0 ? (
            <EmptyState title={t(locale, "common.empty")} />
          ) : (
            <div className="space-y-3">
              {enrollments.map((en) => (
                <Link key={en.id} href={L(`/courses/${en.course.slug}`)} className="card block p-4 transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-800">{tr(en.course.translations, locale)?.title}</p>
                    <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{en.progressPct}%</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar pct={en.progressPct} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">{t(locale, "dash.upcoming")}</h2>
          {upcoming.length === 0 ? (
            <EmptyState title={t(locale, "common.empty")} />
          ) : (
            <ul className="card divide-y divide-slate-100">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3">
                  <Link href={L(`/assignment/${a.id}`)} className="font-medium text-slate-700 hover:underline">
                    📝 {pickPair(locale, a.titleKk, a.titleRu)}
                  </Link>
                  <span className="text-xs font-semibold text-slate-400">{fmtDate(locale, a.dueAt)}</span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-3 mt-6 text-lg font-bold">{t(locale, "dash.activeChallenges")}</h2>
          {myChallenges.length === 0 ? (
            <p className="text-sm text-slate-500">
              <Link className="font-semibold hover:underline" style={{ color: "var(--primary)" }} href={L("/challenges")}>
                {t(locale, "nav.challenges")} →
              </Link>
            </p>
          ) : (
            <ul className="card divide-y divide-slate-100">
              {myChallenges.map((ce) => (
                <li key={ce.id} className="flex items-center justify-between px-4 py-3">
                  <Link href={L(`/challenges/${ce.challenge.slug}`)} className="font-medium text-slate-700 hover:underline">
                    ⚡ {tr(ce.challenge.translations, locale)?.title}
                  </Link>
                  <span className="text-xs font-semibold text-slate-500">
                    {ce.rank ? `#${ce.rank}` : ""} · {Math.round(ce.totalPoints)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">{t(locale, "dash.recentResults")}</h2>
          {attempts.length === 0 ? (
            <EmptyState title={t(locale, "common.empty")} />
          ) : (
            <ul className="card divide-y divide-slate-100">
              {attempts.map((at) => {
                const pct = at.maxScore > 0 ? Math.round(((at.totalScore ?? 0) / at.maxScore) * 100) : 0;
                return (
                  <li key={at.id} className="flex items-center justify-between px-4 py-3">
                    <Link href={L(`/attempt/${at.id}/result`)} className="font-medium text-slate-700 hover:underline">
                      {tr(at.test.translations, locale)?.title}
                    </Link>
                    <span className={`chip ${at.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{pct}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">🔔 {t(locale, "dash.notifications")}</h2>
          {notifications.length === 0 ? (
            <EmptyState title={t(locale, "common.empty")} />
          ) : (
            <ul className="card divide-y divide-slate-100 text-sm">
              {notifications.map((n) => (
                <li key={n.id} className={`px-4 py-3 ${n.readAt ? "text-slate-500" : "font-semibold text-slate-800"}`}>
                  {notifText(locale, n.type, n.payload as Record<string, unknown>)}
                  <span className="ml-2 text-xs font-normal text-slate-400">{fmtDate(locale, n.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ——— Преподаватель ———
async function TeacherCabinet({ locale, userId, admin }: { locale: Locale; userId: string; admin: boolean }) {
  const courseFilter = admin ? {} : { teachers: { some: { userId } } };
  const [courses, pendingSubs, pendingReviews, cohorts] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null, ...courseFilter },
      include: { translations: true, _count: { select: { enrollments: true } } },
    }),
    prisma.assignmentSubmission.findMany({
      where: { status: "SUBMITTED", assignment: { course: { ...courseFilter } } },
      take: 8,
      orderBy: { submittedAt: "asc" },
      include: { assignment: true, student: { include: { profile: true } } },
    }),
    prisma.manualReview.count({ where: { status: "PENDING" } }),
    prisma.cohort.findMany({ where: { archivedAt: null, ...(admin ? {} : { teacherUserId: userId }) }, include: { _count: { select: { members: true } } } }),
  ]);
  const L = (p: string) => `/${locale}${p}`;

  return (
    <div className="container-app py-8">
      <h1 className="text-2xl font-extrabold">{t(locale, "dash.teacher.title")}</h1>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon="📚" value={courses.length} label={t(locale, "dash.myCourses")} />
        <Stat icon="📝" value={pendingSubs.length} label={t(locale, "dash.toReview")} />
        <Stat icon="🖊️" value={pendingReviews} label={t(locale, "test.pendingReview")} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">{t(locale, "dash.toReview")}</h2>
          {pendingSubs.length === 0 && pendingReviews === 0 ? (
            <EmptyState title={t(locale, "common.empty")} />
          ) : (
            <>
              <ul className="card divide-y divide-slate-100">
                {pendingSubs.map((s) => (
                  <li key={s.id} className="px-4 py-3">
                    <Link href={`/admin/review?submission=${s.id}`} className="font-medium text-slate-700 hover:underline">
                      📝 {pickPair(locale, s.assignment.titleKk, s.assignment.titleRu)}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {s.student.profile?.firstName} {s.student.profile?.lastName} · {fmtDate(locale, s.submittedAt, true)}
                    </p>
                  </li>
                ))}
              </ul>
              {pendingReviews > 0 && (
                <Link href="/admin/review" className="btn-primary mt-3">
                  🖊️ {t(locale, "test.pendingReview")}: {pendingReviews}
                </Link>
              )}
            </>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">{t(locale, "dash.myCourses")}</h2>
          <ul className="card divide-y divide-slate-100">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <Link href={L(`/courses/${c.slug}`)} className="font-medium text-slate-700 hover:underline">
                  {tr(c.translations, locale)?.title}
                </Link>
                <span className="text-xs font-semibold text-slate-400">👥 {c._count.enrollments}</span>
              </li>
            ))}
          </ul>

          <h2 className="mb-3 mt-6 text-lg font-bold">{t(locale, "dash.myGroups")}</h2>
          <ul className="card divide-y divide-slate-100">
            {cohorts.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-slate-700">{c.name}</span>
                <span className="text-xs font-semibold text-slate-400">👥 {c._count.members}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

// ——— Родитель ———
async function ParentCabinet({ locale, userId, childParam }: { locale: Locale; userId: string; childParam?: string }) {
  const links = await prisma.studentParent.findMany({
    where: { parentUserId: userId },
    include: { student: { include: { profile: true } } },
  });
  const children = links.map((l) => ({
    id: l.studentUserId,
    name: `${l.student.profile?.firstName ?? ""} ${l.student.profile?.lastName ?? ""}`.trim(),
  }));
  if (children.length === 0)
    return (
      <div className="container-app py-14">
        <h1 className="text-2xl font-extrabold">{t(locale, "dash.parent.title")}</h1>
        <div className="mt-6"><EmptyState title={t(locale, "common.empty")} /></div>
      </div>
    );

  const selected = children.find((c) => c.id === childParam)?.id ?? children[0].id;
  const now = new Date();
  const [enrollments, attempts, upcoming, comments] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId: selected }, include: { course: { include: { translations: true } } } }),
    prisma.testAttempt.findMany({
      where: { userId: selected, status: "GRADED" },
      orderBy: { submittedAt: "desc" },
      take: 6,
      include: { test: { include: { translations: true } } },
    }),
    prisma.assignment.findMany({
      where: { deletedAt: null, status: "PUBLISHED", dueAt: { gte: now }, course: { enrollments: { some: { userId: selected } } } },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    prisma.assignmentSubmission.findMany({
      where: { studentId: selected, feedback: { not: "" } },
      orderBy: { gradedAt: "desc" },
      take: 5,
      include: { assignment: true },
    }),
  ]);
  const L = (p: string) => `/${locale}${p}`;

  return (
    <div className="container-app py-8">
      <h1 className="text-2xl font-extrabold">{t(locale, "dash.parent.title")}</h1>

      {children.length > 1 && (
        <nav aria-label={t(locale, "dash.selectChild")} className="mt-4 flex gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`${L("/dashboard")}?child=${c.id}`}
              aria-current={c.id === selected ? "true" : undefined}
              className={`chip ${c.id === selected ? "text-white" : "bg-slate-100 text-slate-600"}`}
              style={c.id === selected ? { background: "var(--primary)" } : undefined}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">{t(locale, "course.progress")}</h2>
          <div className="space-y-3">
            {enrollments.map((en) => (
              <div key={en.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{tr(en.course.translations, locale)?.title}</p>
                  <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{en.progressPct}%</span>
                </div>
                <div className="mt-2"><ProgressBar pct={en.progressPct} /></div>
              </div>
            ))}
            {enrollments.length === 0 && <EmptyState title={t(locale, "common.empty")} />}
          </div>

          <h2 className="mb-3 mt-6 text-lg font-bold">{t(locale, "dash.upcoming")}</h2>
          <ul className="card divide-y divide-slate-100">
            {upcoming.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium text-slate-700">📝 {pickPair(locale, a.titleKk, a.titleRu)}</span>
                <span className="text-xs font-semibold text-slate-400">{fmtDate(locale, a.dueAt)}</span>
              </li>
            ))}
            {upcoming.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">—</li>}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">{t(locale, "dash.recentResults")}</h2>
          <ul className="card divide-y divide-slate-100">
            {attempts.map((at) => {
              const pct = at.maxScore > 0 ? Math.round(((at.totalScore ?? 0) / at.maxScore) * 100) : 0;
              return (
                <li key={at.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{tr(at.test.translations, locale)?.title}</span>
                  <span className={`chip ${at.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{pct}%</span>
                </li>
              );
            })}
            {attempts.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">—</li>}
          </ul>

          <h2 className="mb-3 mt-6 text-lg font-bold">{t(locale, "dash.teacherComments")}</h2>
          <ul className="card divide-y divide-slate-100 text-sm">
            {comments.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <p className="font-semibold text-slate-700">{pickPair(locale, c.assignment.titleKk, c.assignment.titleRu)} — {c.score}/{c.assignment.maxScore}</p>
                <p className="mt-1 text-slate-600">{c.feedback}</p>
              </li>
            ))}
            {comments.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">—</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <div className="card p-4 text-center">
      <p aria-hidden className="text-2xl">{icon}</p>
      <p className="mt-1 text-2xl font-black" style={{ color: "var(--primary)" }}>{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function notifText(locale: Locale, type: string, payload: Record<string, unknown>): string {
  const map: Record<string, { kk: string; ru: string }> = {
    attempt_graded: { kk: `Тест нәтижесі дайын: ${payload.scorePct}%`, ru: `Результат теста готов: ${payload.scorePct}%` },
    assignment_graded: { kk: `Тапсырма тексерілді: ${payload.score}/${payload.maxScore}`, ru: `Задание проверено: ${payload.score}/${payload.maxScore}` },
    submission_received: { kk: "Жаңа жұмыс тексеруге келді", ru: "Новая работа на проверку" },
    challenge_joined: { kk: "Сіз челленджге тіркелдіңіз", ru: "Вы зарегистрированы на челлендж" },
    payment_paid: { kk: "Төлем қабылданды", ru: "Оплата получена" },
    certificate_issued: { kk: "Сертификат берілді! 🎓", ru: "Выдан сертификат! 🎓" },
  };
  return pickPair(locale, map[type]?.kk ?? type, map[type]?.ru ?? type);
}
