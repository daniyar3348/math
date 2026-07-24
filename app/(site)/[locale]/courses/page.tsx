// Каталог курсов: фильтры в URL, SSR, пагинация.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isLocale, t, pickPair, type Locale } from "@/lib/i18n";
import { CourseCard, tr } from "@/components/site/cards";
import { Pagination, EmptyState } from "@/components/ui";
import { FilterBar } from "@/components/site/FilterBar";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "kk";
  return {
    title: t(l, "catalog.courses.title"),
    alternates: { canonical: `/${l}/courses`, languages: { kk: "/kk/courses", ru: "/ru/courses" } },
  };
}

export default async function CoursesPage({
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

  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 12;
  const where: Record<string, unknown> = { deletedAt: null, status: "PUBLISHED" };
  if (sp.price === "free") where.accessType = "FREE";
  if (sp.price === "paid") where.accessType = "PAID";
  if (sp.grade) where.gradeLevel = { number: Number(sp.grade) || 0 };
  if (sp.subject) where.subject = { slug: sp.subject };
  if (sp.q) where.translations = { some: { title: { contains: sp.q, mode: "insensitive" } } };

  const [total, rows, subjects, grades] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      include: { translations: true, subject: true, gradeLevel: true, _count: { select: { enrollments: true } } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subject.findMany({ where: { archivedAt: null }, orderBy: { sort: "asc" } }),
    prisma.gradeLevel.findMany({ orderBy: { number: "asc" } }),
  ]);

  return (
    <div className="container-app py-10">
      <h1 className="text-3xl font-extrabold">{t(locale, "catalog.courses.title")}</h1>

      <FilterBar
        locale={locale}
        subjects={subjects.map((s) => ({ slug: s.slug, name: pickPair(locale, s.nameKk, s.nameRu) }))}
        grades={grades.map((g) => ({ number: g.number, name: pickPair(locale, g.nameKk, g.nameRu) }))}
        showStatus={false}
      />

      {rows.length === 0 ? (
        <EmptyState title={t(locale, "common.empty")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const trn = tr(c.translations, locale);
            return (
              <CourseCard
                key={c.id}
                locale={locale}
                c={{
                  slug: c.slug,
                  title: trn?.title ?? c.slug,
                  description: trn?.description ?? "",
                  subject: pickPair(locale, c.subject.nameKk, c.subject.nameRu),
                  grade: c.gradeLevel ? pickPair(locale, c.gradeLevel.nameKk, c.gradeLevel.nameRu) : null,
                  accessType: c.accessType,
                  priceKzt: c.priceKzt,
                  students: c._count.enrollments,
                  teachers: [],
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
