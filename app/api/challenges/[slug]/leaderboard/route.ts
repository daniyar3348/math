// Рейтинг челленджа. Приватность несовершеннолетних: opt-out скрывает имя.
import { prisma } from "@/lib/db";
import { handler, ok, err } from "@/lib/http";
import { getAuth } from "@/lib/auth/guard";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const c = await prisma.challenge.findFirst({
    where: { slug, deletedAt: null, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!c) throw err.notFound();

  const a = await getAuth();
  const rows = await prisma.challengeEnrollment.findMany({
    where: { challengeId: c.id },
    orderBy: [{ rank: { sort: "asc", nulls: "last" } }, { totalPoints: "desc" }],
    take: 100,
    include: { user: { include: { profile: true } } },
  });

  return ok({
    leaderboard: rows.map((r) => {
      const hidden = r.user.profile?.publicLeaderboardOptOut && r.userId !== a?.userId;
      const name = hidden
        ? "•••"
        : `${r.user.profile?.firstName ?? ""} ${(r.user.profile?.lastName ?? "").slice(0, 1)}`.trim();
      return {
        rank: r.rank,
        name: name || "•••",
        points: r.totalPoints,
        me: r.userId === a?.userId,
        finishedAt: r.finishedAt,
      };
    }),
  });
});
