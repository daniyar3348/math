import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} — қазақ сөздері / казахские слова`,
  description: BRAND.tagline.ru,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="kk" className="h-full antialiased">
      <body className="min-h-full">
        <I18nProvider>
          <Header />
          <main>{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
