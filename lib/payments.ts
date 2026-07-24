// Платежи (§13): интерфейс PaymentProvider + MockPaymentProvider.
// Реальный провайдер подключается реализацией интерфейса (ключи только из env).
// Webhook идемпотентен; выдача доступа (fulfillment) выполняется ровно один раз.

import { createHmac } from "node:crypto";
import { prisma } from "./db";
import { err } from "./http";
import { notify } from "./notify";
import type { PayRef } from "@/lib/generated/prisma/enums";

export interface CheckoutResult {
  paymentId: string;
  /** Куда отправить пользователя для оплаты (mock: внутренняя страница). */
  redirectUrl: string;
}

export interface PaymentProvider {
  name: string;
  createCheckout(paymentId: string, amountKzt: number): Promise<{ redirectUrl: string }>;
  verifyWebhook(body: Record<string, unknown>): boolean;
}

const secret = () => process.env.APP_SECRET ?? "dev-secret-change-me";

export function webhookSignature(paymentId: string, status: string): string {
  return createHmac("sha256", secret()).update(`${paymentId}:${status}`).digest("hex");
}

class MockPaymentProvider implements PaymentProvider {
  name = "mock";
  async createCheckout(paymentId: string) {
    return { redirectUrl: `/pay/${paymentId}` };
  }
  verifyWebhook(body: Record<string, unknown>): boolean {
    const { paymentId, status, signature } = body as Record<string, string>;
    if (!paymentId || !status || !signature) return false;
    return signature === webhookSignature(paymentId, status);
  }
}

export function paymentProvider(): PaymentProvider {
  const kind = process.env.PAYMENT_PROVIDER ?? "mock";
  if (kind !== "mock" && process.env.NODE_ENV === "production") {
    throw new Error(`PaymentProvider "${kind}" не реализован — подключите реализацию интерфейса`);
  }
  return new MockPaymentProvider();
}

export async function createPayment(params: {
  orgId: string;
  userId: string;
  refType: PayRef;
  refId: string;
}): Promise<CheckoutResult> {
  const { amount, valid } = await priceFor(params.refType, params.refId);
  if (!valid) throw err.notFound();
  if (amount <= 0) throw err.badRequest("not_paid_item");

  const existing = await prisma.payment.findFirst({
    where: { userId: params.userId, refType: params.refType, refId: params.refId, status: "PAID" },
  });
  if (existing) throw err.conflict("already_paid");

  const payment = await prisma.payment.create({
    data: {
      organizationId: params.orgId,
      userId: params.userId,
      refType: params.refType,
      refId: params.refId,
      amountKzt: amount,
      provider: paymentProvider().name,
    },
  });
  const { redirectUrl } = await paymentProvider().createCheckout(payment.id, amount);
  return { paymentId: payment.id, redirectUrl };
}

/** Цена всегда берётся из БД — суммы от клиента не принимаются. */
async function priceFor(refType: PayRef, refId: string): Promise<{ amount: number; valid: boolean }> {
  if (refType === "COURSE") {
    const c = await prisma.course.findFirst({ where: { id: refId, deletedAt: null, status: "PUBLISHED" } });
    return { amount: c?.priceKzt ?? 0, valid: !!c };
  }
  if (refType === "CHALLENGE") {
    const c = await prisma.challenge.findFirst({ where: { id: refId, deletedAt: null, status: "PUBLISHED" } });
    return { amount: c?.priceKzt ?? 0, valid: !!c };
  }
  const t = await prisma.test.findFirst({ where: { id: refId, deletedAt: null, status: "PUBLISHED" } });
  return { amount: t?.priceKzt ?? 0, valid: !!t };
}

/**
 * Идемпотентная обработка статуса (webhook или ручное подтверждение админом).
 * Fulfillment выполняется только при переходе PENDING→PAID.
 */
export async function applyPaymentStatus(paymentId: string, status: "PAID" | "FAILED" | "REFUNDED", providerTxnId = "") {
  const transitioned = await prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status, providerTxnId, ...(status === "PAID" ? { paidAt: new Date() } : {}) },
  });
  if (transitioned.count === 0) {
    // REFUNDED допускаем из PAID
    if (status === "REFUNDED") {
      await prisma.payment.updateMany({ where: { id: paymentId, status: "PAID" }, data: { status } });
    }
    return { applied: false };
  }
  if (status === "PAID") await fulfill(paymentId);
  return { applied: true };
}

async function fulfill(paymentId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.refType === "COURSE") {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: p.userId, courseId: p.refId } },
      update: { status: "ACTIVE" },
      create: { userId: p.userId, courseId: p.refId, source: "PAYMENT" },
    });
  }
  // CHALLENGE/TEST: доступ проверяется наличием Payment(PAID) — отдельной записи не требуется
  await notify(p.userId, "payment_paid", { refType: p.refType, refId: p.refId, amountKzt: p.amountKzt });
}
