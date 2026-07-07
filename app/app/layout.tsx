import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DemoBanner } from "@/components/DemoBanner";
import { BRAND } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: `${BRAND.name} — БИЛ, НИШ, КТЛ математика`,
  description: BRAND.tagline.ru,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kk" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <SessionProvider>
            <DemoBanner />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
