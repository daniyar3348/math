// Уведомления: in-app (таблица Notification). Тексты рендерятся в локали
// получателя на клиенте по type+payload (никакого смешивания языков).
import { prisma } from "./db";

export async function notify(userId: string, type: string, payload: Record<string, unknown> = {}) {
  await prisma.notification.create({ data: { userId, type, payload: payload as object } });
}

export async function notifyMany(userIds: string[], type: string, payload: Record<string, unknown> = {}) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, payload: payload as object })),
  });
}
