// Публичная проверка сертификата по коду.
import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/http";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const cert = await prisma.certificateAward.findUnique({
    where: { code },
    include: {
      user: { include: { profile: true } },
      enrollment: { include: { course: { include: { translations: true } } } },
    },
  });
  if (!cert) return ok({ valid: false });
  return ok({
    valid: true,
    issuedAt: cert.issuedAt,
    student: `${cert.user.profile?.firstName ?? ""} ${cert.user.profile?.lastName ?? ""}`.trim(),
    course: cert.enrollment.course.translations,
  });
});
