// Отдача файла: PUBLIC — всем; PRIVATE — владельцу/персоналу или по подписанному URL.
import { prisma } from "@/lib/db";
import { handler, err } from "@/lib/http";
import { getAuth } from "@/lib/auth/guard";
import { isStaff } from "@/lib/rbac";
import { readFileBytes, verifyFileSig } from "@/lib/files";

export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  const asset = await prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
  if (!asset) throw err.notFound();

  if (asset.visibility !== "PUBLIC") {
    const signed = exp && sig && verifyFileSig(id, exp, sig);
    if (!signed) {
      const a = await getAuth();
      const allowed = a && (a.userId === asset.ownerId || isStaff(a.roles));
      if (!allowed) throw err.forbidden();
    }
  }

  const bytes = await readFileBytes(asset.key).catch(() => {
    throw err.notFound();
  });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(asset.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      "Cache-Control": asset.visibility === "PUBLIC" ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
