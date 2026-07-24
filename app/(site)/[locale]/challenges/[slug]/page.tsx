// Страница челленджа: описание, задания, участие, рейтинг. SEO + hreflang.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { isLocale, t, fmtDate, fmtTenge, pickPair, type Locale } from "@/lib/i18n";
import { tr } from "@/components/site/cards";
import { ChallengeActions } from "@/components/site/ChallengeActions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const l = isLocale(raw) ? raw : "kk";
  const c = await prisma.challenge.findFirst({ where: { slug, status: "PUBLISHED" }, include: { translations: true } });
  const trn = c ? tr(c.translations, l) : null;
  return {
    title: trn?.title ?? slug,
    description: trn?.description?.slice(0, 160),
    alternates: {
      canonical: `/${l}/challenges/${slug}`,
      languages: { kk: `/kk/challenges/${slug}`, ru: `/ru/challenges/${slug}` },
    },
  };
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const c = await prisma.challenge.findFirst({
    where: { slug, deletedAt: null, status: "PUBLISHED" },
    include: {
      translations: true,
      subject: true,
      gradeLevel: true,
      activities: { orderBy: { sort: "asc" }, include: { test: { include: { translations: true } } } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!c) notFound();

  const now = new Date();
  const state = c.startAt > now ? "planned" : c.endAt < now ? "finished" : "active";
  const trn = tr(c.translations, locale);
  const auth = await getAuth();

  let joined = false;
  let paid = false;
  const attemptsByTest: Record<string, { id: string; status: string }[]> = {};
  if (auth) {
    joined = !!(await prisma.challengeEnrollment.findUnique({
      where: { challengeId_userId: { challengeId: c.id, userId: auth.userId } },
    }));
    if (c.accessType === "PAID") {
      paid = !!(await prisma.payment.findFirst({
        where: { userId: auth.userId, refType: "CHALLENGE", refId: c.id, status: "PAID" },
      }));
    }
    const attempts = await prisma.testAttempt.findMany({
      where: { userId: auth.userId, challengeId: c.id },
      select: { id: true, status: true, testId: true },
    });
    for (const at of attempts) (attemptsByTest[at.testId] ??= []).push({ id: at.id, status: at.status });
  }

  const leaderboard = await prisma.challengeEnrollment.findMany({
    where: { challengeId: c.id },
    orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { totalPoints: "desc" }],
    take: 20,
    include: { user: { include: { profile: true } } },
  });

  const stateChip = {
    planned: { text: t(locale, "challenge.status.planned"), cls: "bg-sky-100 text-sky-700" },
    active: { text: t(locale, "challenge.status.active"), cls: "bg-emerald-100 text-emerald-700" },
    finished: { text: t(locale, "challenge.status.finished"), cls: "bg-slate-200 text-slate-600" },
  }[state];

  return (
    <div className="container-app grid gap-8 py-10 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${stateChip.cls}`}>{stateChip.text}</span>
          {c.subject && (
            <span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
              {pickPair(locale, c.subject.nameKk, c.subject.nameRu)}
            </span>
          )}
          {c.gradeLevel && <span className="chip bg-slate-100 text-slate-600">{pickPair(locale, c.gradeLevel.nameKk, c.gradeLevel.nameRu)}</span>}
          {c.accessType === "FREE" ? (
            <span className="chip bg-emerald-100 text-emerald-700">{t(locale, "common.free")}</span>
          ) : (
            <span className="chip" style={{ background: "var(--accent-soft)", color: "#92400e" }}>
              {fmtTenge(locale, c.priceKzt ?? 0)}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-extrabold">{trn?.title}</h1>
        <p className="mt-3 whitespace-pre-line text-slate-600">{trn?.description}</p>

        {trn?.prizes && (
          <section className="card mt-6 p-5">
            <h2 className="font-bold">🎁 {t(locale, "challenge.prizes")}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{trn.prizes}</p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-3 text-xl font-bold">{t(locale, "challenge.tasks")}</h2>
          <div className="space-y-3">
            {c.activities.map((act, i) => {
              const tt = tr(act.test.translations, locale);
              const myAttempts = attemptsByTest[act.testId] ?? [];
              return (
                <div key={act.id} className="card flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {i + 1}. {tt?.title}
                    </p>
                    <p className="text-xs text-slate-500">×{act.pointsWeight}</p>
                  </div>
                  <ChallengeActions
                    locale={locale}
                    mode="test"
                    challengeSlug={c.slug}
                    testSlug={act.test.slug}
                    joined={joined}
                    state={state}
                    attempts={myAttempts}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold">🏆 {t(locale, "challenge.leaderboard")}</h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-slate-500">{t(locale, "common.empty")}</p>
          ) : (
            <ol className="card divide-y divide-slate-100">
              {leaderboard.map((row, i) => {
                const hidden = row.user.profile?.publicLeaderboardOptOut && row.userId !== auth?.userId;
                const name = hidden
                  ? "•••"
                  : `${row.user.profile?.firstName ?? ""} ${(row.user.profile?.lastName ?? "").slice(0, 1)}.`.trim();
                const me = row.userId === auth?.userId;
                return (
                  <li key={row.id} className={`flex items-center gap-3 px-4 py-2.5 ${me ? "bg-[var(--primary-soft)]" : ""}`}>
                    <span
                      className={`grid h-8 w-8 flex-none place-items-center rounded-full text-sm font-black ${
                        i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-300 text-white" : i === 2 ? "bg-orange-300 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.rank ?? i + 1}
                    </span>
                    <span className="flex-1 font-semibold text-slate-800">{name || "•••"}</span>
                    <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                      {Math.round(row.totalPoints)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <aside>
        <div className="card sticky top-24 space-y-4 p-5">
          <div className="text-sm">
            <p className="font-semibold text-slate-500">{t(locale, "challenge.dates")}</p>
            <p className="font-bold">{fmtDate(locale, c.startAt)} — {fmtDate(locale, c.endAt)}</p>
          </div>
          {c.regEndAt && (
            <div className="text-sm">
              <p className="font-semibold text-slate-500">{t(locale, "challenge.regUntil")}</p>
              <p className="font-bold">{fmtDate(locale, c.regEndAt, true)}</p>
            </div>
          )}
          <div className="text-sm">
            <p className="font-semibold text-slate-500">{t(locale, "challenge.participants")}</p>
            <p className="font-bold">
              {c._count.enrollments}
              {c.maxParticipants ? ` / ${c.maxParticipants}` : ""}
            </p>
          </div>
          <ChallengeActions
            locale={locale}
            mode="join"
            challengeSlug={c.slug}
            challengeId={c.id}
            joined={joined}
            state={state}
            authed={!!auth}
            accessType={c.accessType}
            paid={paid}
            needsCode={!!c.accessCode}
          />
        </div>
      </aside>
    </div>
  );
}
