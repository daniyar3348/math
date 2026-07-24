// Загрузка файла (multipart). Типы/размер ограничены, владелец фиксируется.
import { handler, ok, err } from "@/lib/http";
import { requireAuth } from "@/lib/auth/guard";
import { saveFile, MAX_FILE_SIZE } from "@/lib/files";
import { rateLimit } from "@/lib/ratelimit";

export const POST = handler(async (req: Request) => {
  const a = await requireAuth();
  await rateLimit(`files:upload:${a.userId}`, 30, 60_000);

  const form = await req.formData().catch(() => {
    throw err.badRequest("bad_form");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw err.badRequest("file_required");
  if (file.size > MAX_FILE_SIZE) throw err.badRequest("file_too_large");

  const bytes = Buffer.from(await file.arrayBuffer());
  const visibility = form.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE";
  const asset = await saveFile({
    ownerId: a.userId,
    name: file.name,
    mime: file.type,
    bytes,
    visibility,
  });
  return ok({ id: asset.id, name: asset.name, size: asset.size, mime: asset.mime });
});
