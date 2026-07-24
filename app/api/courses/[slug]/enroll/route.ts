// Самозапись на открытый бесплатный курс (платный — через оплату; админ — через админку).
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/ratelimit";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const a = await requireAuth();
  await rateLimit(`enroll:${a.userId}`, 20, 60_000);

  const c = await prisma.course.findFirst({ where: { slug, deletedAt: null, status: "PUBLISHED" } });
  if (!c) throw err.notFound();
  if (!c.selfEnroll) throw err.forbidden();
  if (c.accessType === "PAID") {
    const paid = await prisma.payment.findFirst({
      where: { userId: a.userId, refType: "COURSE", refId: c.id, status: "PAID" },
    });
    if (!paid) throw err.conflict("payment_required");
  }

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: a.userId, courseId: c.id } },
    update: { status: "ACTIVE" },
    create: { userId: a.userId, courseId: c.id, source: "SELF" },
  });
  return ok({ enrolled: true });
});
