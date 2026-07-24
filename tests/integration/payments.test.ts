// Платежи (§13/§18): цена из БД, идемпотентный webhook, fulfillment один раз,
// REFUNDED только из PAID.
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { createPayment, applyPaymentStatus, webhookSignature } from "@/lib/payments";
import { resetDb, makeOrg, makeStudent, makeTaxonomy } from "../helpers/fixtures";

let orgId: string;
let userId: string;
let courseId: string;

beforeAll(async () => {
  await resetDb();
  const org = await makeOrg();
  orgId = org.id;
  const student = await makeStudent(orgId);
  userId = student.id;
  const tax = await makeTaxonomy(orgId);
  const course = await prisma.course.create({
    data: {
      organizationId: orgId, slug: "paid-course", subjectId: tax.subject.id,
      accessType: "PAID", priceKzt: 4900, status: "PUBLISHED",
      translations: { create: [
        { locale: "kk", title: "Ақылы курс" },
        { locale: "ru", title: "Платный курс" },
      ] },
    },
  });
  courseId = course.id;
});

describe("createPayment", () => {
  it("создаёт PENDING-платёж с ценой из БД", async () => {
    const { paymentId, redirectUrl } = await createPayment({ orgId, userId, refType: "COURSE", refId: courseId });
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(p.status).toBe("PENDING");
    expect(p.amountKzt).toBe(4900);
    expect(redirectUrl).toContain(paymentId);
  });

  it("отклоняет оплату неопубликованного/несуществующего товара", async () => {
    await expect(createPayment({ orgId, userId, refType: "COURSE", refId: "nope" }))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe("applyPaymentStatus (webhook)", () => {
  it("PENDING→PAID выполняет fulfillment: enrollment появляется", async () => {
    const p = await prisma.payment.findFirstOrThrow({ where: { userId, refId: courseId } });
    const res = await applyPaymentStatus(p.id, "PAID", "txn-1");
    expect(res.applied).toBe(true);
    const enr = await prisma.enrollment.findMany({ where: { userId, courseId } });
    expect(enr).toHaveLength(1);
  });

  it("повторный webhook — no-op (идемпотентность)", async () => {
    const p = await prisma.payment.findFirstOrThrow({ where: { userId, refId: courseId } });
    const res = await applyPaymentStatus(p.id, "PAID", "txn-1-retry");
    expect(res.applied).toBe(false);
    const enr = await prisma.enrollment.findMany({ where: { userId, courseId } });
    expect(enr).toHaveLength(1);
    const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(fresh.providerTxnId).toBe("txn-1"); // не перезаписан ретраем
  });

  it("после оплаты повторный createPayment даёт already_paid", async () => {
    await expect(createPayment({ orgId, userId, refType: "COURSE", refId: courseId }))
      .rejects.toMatchObject({ status: 409, message: "already_paid" });
  });

  it("REFUNDED допускается из PAID", async () => {
    const p = await prisma.payment.findFirstOrThrow({ where: { userId, refId: courseId } });
    await applyPaymentStatus(p.id, "REFUNDED");
    const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(fresh.status).toBe("REFUNDED");
  });
});

describe("webhookSignature", () => {
  it("детерминирована и чувствительна к статусу", () => {
    expect(webhookSignature("p1", "PAID")).toBe(webhookSignature("p1", "PAID"));
    expect(webhookSignature("p1", "PAID")).not.toBe(webhookSignature("p1", "FAILED"));
  });
});
