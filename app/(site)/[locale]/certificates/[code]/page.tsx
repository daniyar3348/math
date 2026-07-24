// Сертификат: печатаемая страница + публичная проверка по коду (D-009).
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isLocale, t, fmtDate, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { tr } from "@/components/site/cards";

export default async function CertificatePage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale: raw, code } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const s = await getSettings();

  const cert = await prisma.certificateAward.findUnique({
    where: { code },
    include: {
      user: { include: { profile: true } },
      enrollment: { include: { course: { include: { translations: true } } } },
    },
  });

  if (!cert) {
    return (
      <div className="container-app max-w-xl py-16 text-center">
        <p aria-hidden className="text-5xl">❌</p>
        <h1 className="mt-3 text-2xl font-extrabold">{t(locale, "cert.invalid")}</h1>
      </div>
    );
  }

  const student = `${cert.user.profile?.firstName ?? ""} ${cert.user.profile?.lastName ?? ""}`.trim();
  const courseTitle = tr(cert.enrollment.course.translations, locale)?.title ?? "";

  return (
    <div className="container-app max-w-2xl py-12">
      <div className="card border-4 p-10 text-center" style={{ borderColor: "var(--primary)" }}>
        <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--primary)" }}>
          {s.brandName}
        </p>
        <h1 className="mt-4 text-3xl font-black">{t(locale, "cert.verifyTitle")}</h1>
        <p className="chip mx-auto mt-3 bg-emerald-100 text-emerald-700">✓ {t(locale, "cert.valid")}</p>
        <div className="mx-auto my-6 h-px w-32" style={{ background: "var(--accent)" }} />
        <p className="text-sm text-slate-500">{t(locale, "cert.issuedTo")}</p>
        <p className="mt-1 text-2xl font-extrabold">{student}</p>
        <p className="mt-4 text-sm text-slate-500">{t(locale, "cert.course")}</p>
        <p className="mt-1 text-lg font-bold">{courseTitle}</p>
        <p className="mt-4 text-sm text-slate-500">
          {t(locale, "cert.date")}: {fmtDate(locale, cert.issuedAt)}
        </p>
        <p className="mt-6 font-mono text-xs text-slate-400">{cert.code}</p>
      </div>
    </div>
  );
}
