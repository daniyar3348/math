// Публичный каталог челленджей (§6): фильтры, поиск, пагинация.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseQuery, pageArgs } from "@/lib/http";

const Query = z.object({
  status: z.enum(["all", "planned", "active", "finished"]).default("all"),
  price: z.enum(["all", "free", "paid"]).default("all"),
  grade: z.string().optional(),
  subject: z.string().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const GET = handler(async (req: Request) => {
  const query = parseQuery(req, Query);
  const now = new Date();

  const where: Record<string, unknown> = {
    deletedAt: null,
    status: "PUBLISHED",
    isPublic: true,
  };
  if (query.status === "planned") where.startAt = { gt: now };
  if (query.status === "active") {
    where.startAt = { lte: now };
    where.endAt = { gte: now };
  }
  if (query.status === "finished") where.endAt = { lt: now };
  if (query.price === "free") where.accessType = "FREE";
  if (query.price === "paid") where.accessType = "PAID";
  if (query.grade) where.gradeLevel = { number: Number(query.grade) || 0 };
  if (query.subject) where.subject = { slug: query.subject };
  if (query.q) {
    where.translations = { some: { title: { contains: query.q, mode: "insensitive" } } };
  }

  const { skip, take, page, pageSize } = pageArgs(query.page, query.pageSize);
  const [total, rows] = await Promise.all([
    prisma.challenge.count({ where }),
    prisma.challenge.findMany({
      where,
      include: {
        translations: true,
        subject: true,
        gradeLevel: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ startAt: "desc" }],
      skip,
      take,
    }),
  ]);

  return ok({
    rows: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      coverFileId: c.coverFileId,
      accessType: c.accessType,
      priceKzt: c.priceKzt,
      regStartAt: c.regStartAt,
      regEndAt: c.regEndAt,
      startAt: c.startAt,
      endAt: c.endAt,
      participants: c._count.enrollments,
      maxParticipants: c.maxParticipants,
      state: c.startAt > now ? "planned" : c.endAt < now ? "finished" : "active",
      translations: c.translations,
      subject: c.subject ? { nameKk: c.subject.nameKk, nameRu: c.subject.nameRu, slug: c.subject.slug } : null,
      grade: c.gradeLevel ? { nameKk: c.gradeLevel.nameKk, nameRu: c.gradeLevel.nameRu, number: c.gradeLevel.number } : null,
    })),
    total,
    page,
    pageSize,
  });
});
