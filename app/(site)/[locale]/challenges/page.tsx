// Каталог челленджей (§6): фильтры все/запланированные/активные/завершённые/
// бесплатные/платные/класс/предмет/поиск — всё в URL.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isLocale, t, pickPair, type Locale } from "@/lib/i18n";
import { ChallengeCard, tr } from "@/components/site/cards";
import { Pagination, EmptyState } from "@/components/ui";
import { FilterBar } from "@/components/site/FilterBar";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "kk";
  return {
    title: t(l, "catalog.challenges.title"),
    alternates: { canonical: `/${l}/challenges`, languages: { kk: "/kk/challenges", ru: "/ru/challenges" } },
  };
}

export default async function ChallengesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const sp = await searchParams;
  const now = new Date();

  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 12;
  const where: Record<string, unknown> = { deletedAt: null, status: "PUBLISHED", isPublic: true };
  if (sp.status === "planned") where.startAt = { gt: now };
  if (sp.status === "active") Object.assign(where, { startAt: { lte: now }, endAt: { gte: now } });
  if (sp.status === "finished") where.endAt = { lt: now };
  if (sp.price === "free") where.accessType = "FREE";
  if (sp.price === "paid") where.accessType = "PAID";
  if (sp.grade) where.gradeLevel = { number: Number(sp.grade) || 0 };
  if (sp.subject) where.subject = { slug: sp.subject };
  if (sp.q) where.translations = { some: { title: { contains: sp.q, mode: "insensitive" } } };

  const [total, rows, subjects, grades] = await Promise.all([
    prisma.challenge.count({ where }),
    prisma.challenge.findMany({
      where,
      include: { translations: true, subject: true, gradeLevel: true, _count: { select: { enrollments: true } } },
      orderBy: { startAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subject.findMany({ where: { archivedAt: null }, orderBy: { sort: "asc" } }),
    prisma.gradeLevel.findMany({ orderBy: { number: "asc" } }),
  ]);

  return (
    <div className="container-app py-10">
      <h1 className="text-3xl font-extrabold">{t(locale, "catalog.challenges.title")}</h1>

      <FilterBar
        locale={locale}
        subjects={subjects.map((s) => ({ slug: s.slug, name: pickPair(locale, s.nameKk, s.nameRu) }))}
        grades={grades.map((g) => ({ number: g.number, name: pickPair(locale, g.nameKk, g.nameRu) }))}
      />

      {rows.length === 0 ? (
        <EmptyState title={t(locale, "common.empty")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const trn = tr(c.translations, locale);
            return (
              <ChallengeCard
                key={c.id}
                locale={locale}
                c={{
                  slug: c.slug,
                  title: trn?.title ?? c.slug,
                  description: trn?.description ?? "",
                  subject: c.subject ? pickPair(locale, c.subject.nameKk, c.subject.nameRu) : null,
                  grade: c.gradeLevel ? pickPair(locale, c.gradeLevel.nameKk, c.gradeLevel.nameRu) : null,
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
      )}
      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
