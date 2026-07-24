// Регистрация на челлендж: окно регистрации, лимит мест, код, оплата.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, err, parseBody } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";

const Body = z.object({ accessCode: z.string().max(64).optional() });

export const POST = handler(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const a = await requireAuth();
  await rateLimit(`challenge:join:${a.userId}`, 20, 60_000);
  const body = await parseBody(req, Body);

  const c = await prisma.challenge.findFirst({ where: { slug, deletedAt: null, status: "PUBLISHED" } });
  if (!c) throw err.notFound();
  const now = new Date();
  if (c.regStartAt && now < c.regStartAt) throw err.conflict("registration_not_open");
  if (c.regEndAt && now > c.regEndAt) throw err.conflict("registration_closed");
  if (now > c.endAt) throw err.conflict("challenge_finished");
  if (c.accessCode && c.accessCode !== (body.accessCode ?? "")) throw err.forbidden();

  if (c.accessType === "PAID") {
    const paid = await prisma.payment.findFirst({
      where: { userId: a.userId, refType: "CHALLENGE", refId: c.id, status: "PAID" },
    });
    if (!paid) throw err.conflict("payment_required");
  }

  if (c.maxParticipants) {
    const count = await prisma.challengeEnrollment.count({ where: { challengeId: c.id } });
    if (count >= c.maxParticipants) throw err.conflict("challenge_full");
  }

  await prisma.challengeEnrollment.upsert({
    where: { challengeId_userId: { challengeId: c.id, userId: a.userId } },
    update: {},
    create: { challengeId: c.id, userId: a.userId },
  });
  await notify(a.userId, "challenge_joined", { challengeId: c.id, slug: c.slug });
  return ok({ joined: true });
});
