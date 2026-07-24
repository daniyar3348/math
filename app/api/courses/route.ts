// Публичный каталог курсов: фильтры, поиск, пагинация.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, pageArgs } from "@/lib/http";

const Query = z.object({
  price: z.enum(["all", "free", "paid"]).default("all"),
  grade: z.string().optional(),
  subject: z.string().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const GET = handler(async (req: Request) => {
  const query = parseQuery(req, Query);
  const where: Record<string, unknown> = { deletedAt: null, status: "PUBLISHED" };
  if (query.price === "free") where.accessType = "FREE";
  if (query.price === "paid") where.accessType = "PAID";
  if (query.grade) where.gradeLevel = { number: Number(query.grade) || 0 };
  if (query.subject) where.subject = { slug: query.subject };
  if (query.q) where.translations = { some: { title: { contains: query.q, mode: "insensitive" } } };

  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);
  const [total, rows] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      include: {
        translations: true,
        subject: true,
        gradeLevel: true,
        teachers: true,
        _count: { select: { enrollments: true, modules: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip,
      take,
    }),
  ]);

  const teacherIds = [...new Set(rows.flatMap((c) => c.teachers.map((t) => t.userId)))];
  const teacherProfiles = await prisma.profile.findMany({ where: { userId: { in: teacherIds } } });
  const nameOf = (id: string) => {
    const p = teacherProfiles.find((x) => x.userId === id);
    return p ? `${p.firstName} ${p.lastName}`.trim() : "";
  };

  return ok({
    rows: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      coverFileId: c.coverFileId,
      accessType: c.accessType,
      priceKzt: c.priceKzt,
      level: c.level,
      translations: c.translations,
      subject: { nameKk: c.subject.nameKk, nameRu: c.subject.nameRu, slug: c.subject.slug },
      grade: c.gradeLevel ? { nameKk: c.gradeLevel.nameKk, nameRu: c.gradeLevel.nameRu, number: c.gradeLevel.number } : null,
      students: c._count.enrollments,
      modules: c._count.modules,
      teachers: c.teachers.map((t) => nameOf(t.userId)).filter(Boolean),
    })),
    total,
    page,
    pageSize,
  });
});
