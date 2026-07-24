// Dashboard (§12): метрики, график за 30 дней, быстрые действия.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";

export default async function AdminDashboard() {
  await requireStaff();
  // Server Component: рендер одноразовый на запрос, «нечистота» безопасна
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const day = 24 * 3600_000;
  const since30 = new Date(now - 30 * day);

  const [students, newStudents, activeCourses, activeChallenges, gradedAttempts, avgAgg, pendingReviews, pendingSubs, enrollTotal, enrollCompleted, attemptsRaw, regsRaw] =
    await Promise.all([
      prisma.membership.count({ where: { role: { name: "STUDENT" } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 }, memberships: { some: { role: { name: "STUDENT" } } } } }),
      prisma.course.count({ where: { status: "PUBLISHED", deletedAt: null } }),
      prisma.challenge.count({ where: { status: "PUBLISHED", deletedAt: null, endAt: { gte: new Date() } } }),
      prisma.testAttempt.count({ where: { status: "GRADED" } }),
      prisma.testAttempt.aggregate({ where: { status: "GRADED", maxScore: { gt: 0 } }, _avg: { totalScore: true, maxScore: true } }),
      prisma.manualReview.count({ where: { status: "PENDING" } }),
      prisma.assignmentSubmission.count({ where: { status: "SUBMITTED" } }),
      prisma.enrollment.count(),
      prisma.enrollment.count({ where: { status: "COMPLETED" } }),
      prisma.testAttempt.findMany({ where: { submittedAt: { gte: since30 } }, select: { submittedAt: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
    ]);

  const avgPct = avgAgg._avg.totalScore && avgAgg._avg.maxScore ? Math.round((avgAgg._avg.totalScore / avgAgg._avg.maxScore) * 100) : 0;
  const completionPct = enrollTotal > 0 ? Math.round((enrollCompleted / enrollTotal) * 100) : 0;

  const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(d);
  const days: { label: string; attempts: number; regs: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = fmtDay(new Date(now - i * day));
    days.push({
      label: key.slice(5),
      attempts: attemptsRaw.filter((a) => a.submittedAt && fmtDay(a.submittedAt) === key).length,
      regs: regsRaw.filter((r) => fmtDay(r.createdAt) === key).length,
    });
  }
  const maxVal = Math.max(1, ...days.map((d) => Math.max(d.attempts, d.regs)));

  const cards = [
    { icon: "👥", label: "Активные ученики", value: students },
    { icon: "🆕", label: "Новые за 30 дней", value: newStudents },
    { icon: "📚", label: "Активные курсы", value: activeCourses },
    { icon: "⚡", label: "Активные челленджи", value: activeChallenges },
    { icon: "📝", label: "Завершено тестов", value: gradedAttempts },
    { icon: "📈", label: "Средний результат", value: `${avgPct}%` },
    { icon: "🎓", label: "Завершение курсов", value: `${completionPct}%` },
    { icon: "🖊️", label: "На ручную проверку", value: pendingReviews + pendingSubs },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/questions?new=1" className="btn-primary !py-2">+ Вопрос</Link>
          <Link href="/admin/tests/new" className="btn-primary !py-2">+ Тест</Link>
          <Link href="/admin/courses?new=1" className="btn-outline !py-2">+ Курс</Link>
          <Link href="/admin/challenges?new=1" className="btn-outline !py-2">+ Челлендж</Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p aria-hidden className="text-xl">{c.icon}</p>
            <p className="mt-1 text-2xl font-black" style={{ color: "var(--primary)" }}>{c.value}</p>
            <p className="text-xs font-semibold text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-bold">Активность за 30 дней</h2>
        <div className="mt-3 flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--primary)" }} /> попытки тестов</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--accent)" }} /> регистрации</span>
        </div>
        <svg viewBox="0 0 600 140" className="mt-2 w-full" role="img" aria-label="График активности за 30 дней">
          {days.map((d, i) => {
            const x = i * 20;
            const ah = (d.attempts / maxVal) * 110;
            const rh = (d.regs / maxVal) * 110;
            return (
              <g key={i}>
                <rect x={x + 2} y={120 - ah} width={7} height={Math.max(ah, d.attempts > 0 ? 3 : 1)} rx={1.5} fill="var(--primary)">
                  <title>{`${d.label}: попыток ${d.attempts}`}</title>
                </rect>
                <rect x={x + 10} y={120 - rh} width={7} height={Math.max(rh, d.regs > 0 ? 3 : 1)} rx={1.5} fill="var(--accent)">
                  <title>{`${d.label}: регистраций ${d.regs}`}</title>
                </rect>
                {i % 5 === 0 && (
                  <text x={x + 9} y={134} fontSize={7} fill="#94a3b8" textAnchor="middle">{d.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/review" className="card flex items-center justify-between p-5 transition hover:shadow-md">
          <span className="font-bold">🖊️ Очередь проверки</span>
          <span className="chip" style={{ background: "var(--accent-soft)", color: "#92400e" }}>{pendingReviews + pendingSubs}</span>
        </Link>
        <Link href="/admin/audit" className="card flex items-center justify-between p-5 transition hover:shadow-md">
          <span className="font-bold">🕵️ Аудит действий</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
