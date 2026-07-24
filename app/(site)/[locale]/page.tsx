// Лендинг (§6): hero, направления, преимущества, форматы, популярные курсы,
// активные челленджи, «как работает», отзывы, FAQ, контакты, CTA.
// Тексты блоков переопределяются из админки (SiteSettings.landing).
import Link from "next/link";
import { prisma } from "@/lib/db";
import { t, pickPair, type Locale } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { CourseCard, ChallengeCard, tr, pair } from "@/components/site/cards";

export const revalidate = 60; // кэш публичной страницы (§17)

interface LandingBlock {
  heroKk?: string; heroRu?: string; heroSubKk?: string; heroSubRu?: string;
  faq?: { qKk: string; qRu: string; aKk: string; aRu: string }[];
}

const DEFAULT_FAQ = [
  {
    qKk: "Платформа тегін бе?", qRu: "Платформа бесплатная?",
    aKk: "Көптеген курстар мен челлендждер тегін. Ақылы материалдар бағасымен белгіленген.",
    aRu: "Многие курсы и челленджи бесплатны. Платные материалы отмечены ценой.",
  },
  {
    qKk: "Қалай тіркелемін?", qRu: "Как зарегистрироваться?",
    aKk: "Оқушылар телефон нөмірі арқылы SMS-кодпен кіреді — бөлек тіркелудің қажеті жоқ.",
    aRu: "Ученики входят по номеру телефона с SMS-кодом — отдельная регистрация не нужна.",
  },
  {
    qKk: "Ата-ана баланың үлгерімін көре ала ма?", qRu: "Родитель видит успеваемость ребёнка?",
    aKk: "Иә, ата-ана кабинетінде прогресс, бағалар мен дедлайндар көрінеді.",
    aRu: "Да, в кабинете родителя видны прогресс, оценки и дедлайны.",
  },
];

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const s = await getSettings();
  const landing = (s.landing ?? {}) as LandingBlock;
  const now = new Date();

  const [courses, challenges, reviews] = await Promise.all([
    prisma.course.findMany({
      where: { deletedAt: null, status: "PUBLISHED" },
      include: { translations: true, subject: true, gradeLevel: true, teachers: true, _count: { select: { enrollments: true } } },
      orderBy: { publishedAt: "desc" },
      take: 3,
    }),
    prisma.challenge.findMany({
      where: { deletedAt: null, status: "PUBLISHED", isPublic: true, endAt: { gte: now } },
      include: { translations: true, subject: true, gradeLevel: true, _count: { select: { enrollments: true } } },
      orderBy: { startAt: "asc" },
      take: 3,
    }),
    prisma.review.findMany({ where: { published: true }, orderBy: { sort: "asc" }, take: 3 }),
  ]);

  const hero = pickPair(locale, landing.heroKk ?? "", landing.heroRu ?? "") ||
    (locale === "kk" ? "Мектеп пәндерін қызықты меңгер" : "Осваивай школьные предметы с интересом");
  const heroSub = pickPair(locale, landing.heroSubKk ?? "", landing.heroSubRu ?? "") ||
    (locale === "kk"
      ? "Курстар, диагностикалық тесттер және челлендждер — бір платформада. Мұғалімдер тексереді, ата-аналар прогресті көреді."
      : "Курсы, диагностические тесты и челленджи — на одной платформе. Учителя проверяют, родители видят прогресс.");

  const L = (p: string) => `/${locale}${p}`;
  const faq = landing.faq?.length ? landing.faq : DEFAULT_FAQ;

  const directions = [
    { icon: "🧮", kk: "Математика", ru: "Математика" },
    { icon: "🗣️", kk: "Қазақ тілі", ru: "Казахский язык" },
    { icon: "🔬", kk: "Жаратылыстану", ru: "Естествознание" },
    { icon: "🌍", kk: "Тарих және қоғам", ru: "История и общество" },
  ];
  const advantages = [
    { icon: "🎯", kk: "Диагностика күшті және әлсіз жақтарды көрсетеді", ru: "Диагностика показывает сильные и слабые стороны" },
    { icon: "🏆", kk: "Челлендждер мен ұпайлар оқуға ынталандырады", ru: "Челленджи и баллы мотивируют учиться" },
    { icon: "👩‍🏫", kk: "Ашық жауаптарды мұғалім тексереді", ru: "Развёрнутые ответы проверяет учитель" },
    { icon: "👪", kk: "Ата-ана прогресті нақты уақытта көреді", ru: "Родители видят прогресс в реальном времени" },
  ];
  const formats = [
    { icon: "📚", kk: "Курстар: модульдер мен сабақтар", ru: "Курсы: модули и уроки" },
    { icon: "📝", kk: "Тесттер: 10 сұрақ түрі, авто-тексеру", ru: "Тесты: 10 типов вопросов, автопроверка" },
    { icon: "⚡", kk: "Челлендждер: рейтинг және жүлделер", ru: "Челленджи: рейтинг и призы" },
  ];
  const how = [
    { n: "1", kk: "Телефон арқылы кір", ru: "Войди по телефону" },
    { n: "2", kk: "Диагностикадан өт", ru: "Пройди диагностику" },
    { n: "3", kk: "Курс пен челлендж таңда", ru: "Выбери курс и челлендж" },
    { n: "4", kk: "Ұпай жинап, прогресті бақыла", ru: "Собирай баллы и следи за прогрессом" },
  ];

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ background: `radial-gradient(60rem 30rem at 70% -10%, var(--primary), transparent)` }}
        />
        <div className="container-app grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="chip" style={{ background: "var(--accent-soft)", color: "#92400e" }}>
              {s.brandName}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">{hero}</h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">{heroSub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={L("/login")} className="btn-primary !px-7 !py-3 text-base">
                {t(locale, "landing.cta.start")}
              </Link>
              <Link href={L("/courses")} className="btn-outline !px-7 !py-3 text-base">
                {t(locale, "landing.cta.catalog")}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4" aria-hidden>
            {[
              { big: "10", kk: "сұрақ түрі", ru: "типов вопросов" },
              { big: "2", kk: "тіл: қазақша және орысша", ru: "языка: казахский и русский" },
              { big: "∞", kk: "тегін диагностика", ru: "бесплатная диагностика" },
              { big: "24/7", kk: "қолжетімділік", ru: "доступ" },
            ].map((x, i) => (
              <div key={i} className="card p-5 text-center">
                <p className="text-3xl font-black" style={{ color: "var(--primary)" }}>{x.big}</p>
                <p className="mt-1 text-sm text-slate-500">{pair(locale, x.kk, x.ru)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Направления */}
      <section className="container-app py-8">
        <h2 className="mb-5 text-2xl font-extrabold">{t(locale, "landing.directions")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {directions.map((d, i) => (
            <div key={i} className="card flex items-center gap-3 p-5">
              <span aria-hidden className="text-3xl">{d.icon}</span>
              <p className="font-bold text-slate-800">{pair(locale, d.kk, d.ru)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Преимущества */}
      <section className="container-app py-8">
        <h2 className="mb-5 text-2xl font-extrabold">{t(locale, "landing.advantages")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {advantages.map((a, i) => (
            <div key={i} className="card flex items-start gap-3 p-5">
              <span aria-hidden className="text-2xl">{a.icon}</span>
              <p className="font-semibold text-slate-700">{pair(locale, a.kk, a.ru)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Форматы */}
      <section className="container-app py-8">
        <h2 className="mb-5 text-2xl font-extrabold">{t(locale, "landing.formats")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {formats.map((f, i) => (
            <div key={i} className="card p-6 text-center">
              <span aria-hidden className="text-4xl">{f.icon}</span>
              <p className="mt-3 font-semibold text-slate-700">{pair(locale, f.kk, f.ru)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Популярные курсы */}
      <section className="container-app py-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">{t(locale, "landing.popularCourses")}</h2>
          <Link href={L("/courses")} className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            {t(locale, "common.all")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const trn = tr(c.translations, locale);
            return (
              <CourseCard
                key={c.id}
                locale={locale}
                c={{
                  slug: c.slug,
                  title: trn?.title ?? c.slug,
                  description: trn?.description ?? "",
                  subject: pair(locale, c.subject.nameKk, c.subject.nameRu),
                  grade: c.gradeLevel ? pair(locale, c.gradeLevel.nameKk, c.gradeLevel.nameRu) : null,
                  accessType: c.accessType,
                  priceKzt: c.priceKzt,
                  students: c._count.enrollments,
                  teachers: [],
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Активные челленджи */}
      <section className="container-app py-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">{t(locale, "landing.activeChallenges")}</h2>
          <Link href={L("/challenges")} className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            {t(locale, "common.all")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => {
            const trn = tr(c.translations, locale);
            return (
              <ChallengeCard
                key={c.id}
                locale={locale}
                c={{
                  slug: c.slug,
                  title: trn?.title ?? c.slug,
                  description: trn?.description ?? "",
                  subject: c.subject ? pair(locale, c.subject.nameKk, c.subject.nameRu) : null,
                  grade: c.gradeLevel ? pair(locale, c.gradeLevel.nameKk, c.gradeLevel.nameRu) : null,
                  accessType: c.accessType,
                  priceKzt: c.priceKzt,
                  startAt: c.startAt,
                  endAt: c.endAt,
                  participants: c._count.enrollments,
                  state: c.startAt > now ? "planned" : c.endAt < now ? "finished" : "active",
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Как работает */}
      <section className="container-app py-8">
        <h2 className="mb-5 text-2xl font-extrabold">{t(locale, "landing.how.title")}</h2>
        <ol className="grid gap-4 sm:grid-cols-4">
          {how.map((h) => (
            <li key={h.n} className="card p-5">
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-white"
                style={{ background: "var(--primary)" }}
                aria-hidden
              >
                {h.n}
              </span>
              <p className="mt-3 font-semibold text-slate-700">{pair(locale, h.kk, h.ru)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Отзывы */}
      {reviews.length > 0 && (
        <section className="container-app py-8">
          <h2 className="mb-5 text-2xl font-extrabold">{t(locale, "landing.reviews")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id} className="card p-5">
                <p aria-label={`${r.rating}/5`} className="text-amber-500">{"★".repeat(r.rating)}</p>
                <blockquote className="mt-2 text-sm text-slate-700">{pair(locale, r.textKk, r.textRu)}</blockquote>
                <figcaption className="mt-3 text-xs font-semibold text-slate-500">{r.authorName}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="container-app py-8">
        <h2 className="mb-5 text-2xl font-extrabold">{t(locale, "landing.faq")}</h2>
        <div className="space-y-3">
          {faq.map((f, i) => (
            <details key={i} className="card group p-5">
              <summary className="cursor-pointer list-none font-bold text-slate-800">
                {pair(locale, f.qKk, f.qRu)}
              </summary>
              <p className="mt-2 text-sm text-slate-600">{pair(locale, f.aKk, f.aRu)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-app py-12">
        <div className="card p-8 text-center" style={{ background: "var(--primary)", border: "none" }}>
          <h2 className="text-2xl font-extrabold text-white">
            {pair(locale, "Бүгін бастаңыз — тегін!", "Начните сегодня — бесплатно!")}
          </h2>
          <Link href={L("/login")} className="btn-accent mt-5 !px-8 !py-3 text-base">
            {t(locale, "landing.cta.start")}
          </Link>
        </div>
      </section>
    </div>
  );
}
