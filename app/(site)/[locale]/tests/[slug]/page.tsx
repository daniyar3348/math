// Карточка теста: описание/инструкция, попытки, старт (код доступа/оплата).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { isLocale, t, fmtTenge, pickPair, type Locale } from "@/lib/i18n";
import { tr } from "@/components/site/cards";
import { StartTestButton } from "@/components/site/StartTestButton";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const l = isLocale(raw) ? raw : "kk";
  const test = await prisma.test.findFirst({ where: { slug, status: "PUBLISHED" }, include: { translations: true } });
  const trn = test ? tr(test.translations, l) : null;
  return {
    title: trn?.seoTitle || trn?.title || slug,
    description: (trn?.seoDescription || trn?.description || "").slice(0, 160),
    alternates: { canonical: `/${l}/tests/${slug}`, languages: { kk: `/kk/tests/${slug}`, ru: `/ru/tests/${slug}` } },
  };
}

export default async function TestPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const test = await prisma.test.findFirst({
    where: { slug, deletedAt: null, status: "PUBLISHED" },
    include: {
      translations: true,
      subject: true,
      gradeLevel: true,
      sections: { include: { questions: true } },
    },
  });
  if (!test) notFound();

  const trn = tr(test.translations, locale);
  const auth = await getAuth();
  let attempts: { id: string; status: string }[] = [];
  let paid = false;
  if (auth) {
    attempts = await prisma.testAttempt.findMany({
      where: { testId: test.id, userId: auth.userId },
      select: { id: true, status: true },
      orderBy: { attemptNo: "asc" },
    });
    if (test.accessType === "PAID") {
      paid = !!(await prisma.payment.findFirst({
        where: { userId: auth.userId, refType: "TEST", refId: test.id, status: "PAID" },
      }));
    }
  }
  const questionCount = test.sections.reduce((s, sec) => s + sec.questions.length + (sec.randomCount ?? 0), 0);
  const open = attempts.find((a) => a.status === "IN_PROGRESS");
  const attemptsLeft = test.attemptsAllowed - attempts.length + (open ? 1 : 0);

  return (
    <div className="container-app max-w-2xl py-10">
      <div className="flex flex-wrap gap-2">
        <span className="chip" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          {pickPair(locale, test.subject.nameKk, test.subject.nameRu)}
        </span>
        {test.gradeLevel && <span className="chip bg-slate-100 text-slate-600">{pickPair(locale, test.gradeLevel.nameKk, test.gradeLevel.nameRu)}</span>}
        {test.mode === "DIAGNOSTIC" && <span className="chip bg-sky-100 text-sky-700">📊 Diagnostic</span>}
        {test.accessType === "PAID" && (
          <span className="chip" style={{ background: "var(--accent-soft)", color: "#92400e" }}>{fmtTenge(locale, test.priceKzt ?? 0)}</span>
        )}
      </div>
      <h1 className="mt-3 text-3xl font-extrabold">{trn?.title}</h1>
      <p className="mt-3 text-slate-600">{trn?.description}</p>

      <div className="card mt-6 grid grid-cols-2 gap-4 p-5 text-center sm:grid-cols-4">
        <div>
          <p className="text-xl font-black" style={{ color: "var(--primary)" }}>{questionCount}</p>
          <p className="text-xs text-slate-500">{t(locale, "test.question")}</p>
        </div>
        <div>
          <p className="text-xl font-black" style={{ color: "var(--primary)" }}>
            {test.timeLimitSec ? `${Math.round(test.timeLimitSec / 60)}′` : "∞"}
          </p>
          <p className="text-xs text-slate-500">{t(locale, "test.timeLimit")}</p>
        </div>
        <div>
          <p className="text-xl font-black" style={{ color: "var(--primary)" }}>{test.passPct}%</p>
          <p className="text-xs text-slate-500">{t(locale, "test.passScore")}</p>
        </div>
        <div>
          <p className="text-xl font-black" style={{ color: "var(--primary)" }}>{Math.max(0, attemptsLeft)}</p>
          <p className="text-xs text-slate-500">{t(locale, "test.attemptsLeft", { n: "" }).replace(":", "").trim()}</p>
        </div>
      </div>

      {trn?.instructions && (
        <section className="card mt-5 p-5">
          <h2 className="font-bold">📋 {t(locale, "test.instructions")}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{trn.instructions}</p>
        </section>
      )}

      <div className="mt-6">
        <StartTestButton
          locale={locale}
          slug={test.slug}
          testId={test.id}
          authed={!!auth}
          needsCode={!!test.accessCode}
          accessType={test.accessType}
          paid={paid}
          hasOpen={!!open}
          attemptsExhausted={attemptsLeft <= 0}
          openAttemptId={open?.id}
        />
      </div>
    </div>
  );
}
