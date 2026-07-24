import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../../globals.css";
import { isLocale, t, type Locale } from "@/lib/i18n";
import { getSettings, darken } from "@/lib/settings";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { OfflineBanner } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : "kk";
  const s = await getSettings();
  return {
    title: { default: `${s.brandName} — ${t(l, "app.tagline")}`, template: `%s — ${s.brandName}` },
    description: t(l, "app.tagline"),
    alternates: {
      canonical: `/${l}`,
      languages: { kk: "/kk", ru: "/ru" },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const s = await getSettings();

  // Цвета бренда — из настроек платформы (меняются в админке без кода)
  const styleVars = {
    "--primary": s.primaryColor,
    "--primary-dark": darken(s.primaryColor),
    "--accent": s.accentColor,
  } as React.CSSProperties;

  return (
    <html lang={locale} className="h-full antialiased" style={styleVars}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="skip-link">
          {t(locale, "common.skipToContent")}
        </a>
        <OfflineBanner text={t(locale, "common.offline")} />
        <Header locale={locale} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
