// Mock-оплата (§13): страница подтверждения платежа в dev-режиме.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth/guard";
import { isLocale, t, fmtTenge, type Locale } from "@/lib/i18n";
import { MockPayButton } from "@/components/site/MockPayButton";

export default async function PayPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const auth = await getAuth();
  if (!auth) redirect(`/${locale}/login`);

  const p = await prisma.payment.findFirst({ where: { id, userId: auth.userId } });
  if (!p) notFound();

  return (
    <div className="container-app max-w-md py-14">
      <div className="card p-6 text-center">
        <p aria-hidden className="text-5xl">💳</p>
        <h1 className="mt-3 text-xl font-extrabold">{t(locale, "pay.price")}: {fmtTenge(locale, p.amountKzt)}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {p.status === "PAID" ? t(locale, "pay.success") : "Mock-провайдер (демо, деньги не списываются)"}
        </p>
        {p.status === "PENDING" && <MockPayButton locale={locale} paymentId={p.id} />}
        {p.status === "PAID" && (
          <a href={`/${locale}/dashboard`} className="btn-primary mt-5 w-full">
            {t(locale, "nav.dashboard")}
          </a>
        )}
      </div>
    </div>
  );
}
