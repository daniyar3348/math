import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { isStaff } from "@/lib/rbac";
import { startAttempt } from "@/lib/engine/attempt";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  accessCode: z.string().max(64).optional(),
  challengeSlug: z.string().max(120).optional(),
  preview: z.boolean().optional(),
});

export const POST = handler(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const a = await requireAuth();
  await rateLimit(`attempt:start:${a.userId}`, 30, 60_000);
  const body = await parseBody(req, Body);

  const test = await prisma.test.findFirst({ where: { slug, deletedAt: null } });
  if (!test) throw err.notFound();

  // предпросмотр — только персоналу; не попадает в аналитику
  const preview = !!body.preview && isStaff(a.roles);

  let challengeId: string | undefined;
  if (body.challengeSlug) {
    const ch = await prisma.challenge.findFirst({
      where: { slug: body.challengeSlug, deletedAt: null, status: "PUBLISHED" },
    });
    if (!ch) throw err.notFound();
    const enrolled = await prisma.challengeEnrollment.findUnique({
      where: { challengeId_userId: { challengeId: ch.id, userId: a.userId } },
    });
    if (!enrolled) throw err.forbidden();
    const now = new Date();
    if (now < ch.startAt || now > ch.endAt) throw err.conflict("challenge_not_active");
    challengeId = ch.id;
  }

  const attempt = await startAttempt({
    testId: test.id,
    userId: a.userId,
    accessCode: body.accessCode,
    challengeId,
    preview,
  });
  return ok({ attemptId: attempt.id });
});
