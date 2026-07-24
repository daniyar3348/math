// FileStorage (§ D-003): disk-провайдер + подписанные URL (HMAC, срок действия).
// S3/MinIO подключается реализацией того же интерфейса через env FILE_STORAGE=s3.

import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { err } from "./http";

const SECRET = () => process.env.APP_SECRET ?? "dev-secret-change-me";
const DIR = () => path.join(process.cwd(), process.env.UPLOADS_DIR ?? "uploads");

export const ALLOWED_MIME: Record<string, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  doc: ["application/pdf"],
  audio: ["audio/mpeg", "audio/ogg", "audio/wav"],
  video: ["video/mp4", "video/webm"],
  archiveless: [], // произвольные типы запрещены
};
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function mimeAllowed(mime: string): boolean {
  return Object.values(ALLOWED_MIME).some((list) => list.includes(mime));
}

export async function saveFile(params: {
  ownerId: string | null;
  name: string;
  mime: string;
  bytes: Buffer;
  visibility?: "PUBLIC" | "PRIVATE";
}) {
  if (!mimeAllowed(params.mime)) throw err.badRequest("file_type_not_allowed");
  if (params.bytes.length > MAX_FILE_SIZE) throw err.badRequest("file_too_large");
  const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;
  const full = path.join(DIR(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, params.bytes);
  return prisma.fileAsset.create({
    data: {
      ownerId: params.ownerId,
      key,
      name: params.name.slice(0, 200),
      mime: params.mime,
      size: params.bytes.length,
      visibility: params.visibility ?? "PRIVATE",
    },
  });
}

export async function readFileBytes(key: string): Promise<Buffer> {
  return readFile(path.join(DIR(), key));
}

export async function deleteFileBytes(key: string): Promise<void> {
  await unlink(path.join(DIR(), key)).catch(() => {});
}

export function signFileUrl(fileId: string, ttlSec = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac("sha256", SECRET()).update(`${fileId}.${exp}`).digest("hex").slice(0, 32);
  return `/api/files/${fileId}?exp=${exp}&sig=${sig}`;
}

export function verifyFileSig(fileId: string, exp: string, sig: string): boolean {
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  const expect = createHmac("sha256", SECRET()).update(`${fileId}.${exp}`).digest("hex").slice(0, 32);
  return expect === sig;
}
