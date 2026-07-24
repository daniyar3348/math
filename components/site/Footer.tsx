import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { t, pickPair, type Locale } from "@/lib/i18n";

export async function Footer({ locale }: { locale: Locale }) {
  const s = await getSettings();
  const L = (p: string) => `/${locale}${p}`;
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-app grid gap-6 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold">{s.brandName}</p>
          <p className="mt-1 text-sm text-slate-500">{t(locale, "app.tagline")}</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-bold text-slate-700">{t(locale, "landing.contacts")}</p>
          {s.contacts.phone && <p className="text-slate-600">{s.contacts.phone}</p>}
          {s.contacts.email && <p className="text-slate-600">{s.contacts.email}</p>}
          {s.contacts.address && (
            <p className="text-slate-600">{pickPair(locale, s.contacts.address.kk ?? "", s.contacts.address.ru ?? "")}</p>
          )}
        </div>
        <div className="text-sm">
          <p className="mb-2 font-bold text-slate-700">•</p>
          <p><Link className="text-slate-600 hover:underline" href={L("/privacy")}>{t(locale, "footer.privacy")}</Link></p>
          <p><Link className="text-slate-600 hover:underline" href={L("/terms")}>{t(locale, "footer.terms")}</Link></p>
        </div>
      </div>
    </footer>
  );
}
