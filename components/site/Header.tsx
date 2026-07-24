// Шапка (server component): бренд из настроек, навигация, состояние входа.
import Link from "next/link";
import { getAuth } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { t, type Locale } from "@/lib/i18n";
import { isStaff, isAdmin } from "@/lib/rbac";
import { LangSwitch } from "./LangSwitch";
import { LogoutButton } from "./UserNav";

export async function Header({ locale }: { locale: Locale }) {
  const [auth, settings] = await Promise.all([getAuth(), getSettings()]);
  const L = (p: string) => `/${locale}${p}`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-3">
        <Link href={L("")} className="flex items-center gap-2 text-lg font-extrabold" aria-label={settings.brandName}>
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-xl text-base font-black text-white"
            style={{ background: "var(--primary)" }}
          >
            {settings.brandName.slice(0, 1)}
          </span>
          <span>{settings.brandName}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <Link href={L("/courses")} className="btn-ghost">{t(locale, "nav.courses")}</Link>
          <Link href={L("/challenges")} className="btn-ghost">{t(locale, "nav.challenges")}</Link>
          {auth && <Link href={L("/dashboard")} className="btn-ghost">{t(locale, "nav.dashboard")}</Link>}
          {auth && isStaff(auth.roles) && isAdmin(auth.roles) && (
            <Link href="/admin" className="btn-ghost">{t(locale, "nav.admin")}</Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LangSwitch locale={locale} />
          {auth ? (
            <>
              <Link href={L("/dashboard")} className="btn-ghost hidden sm:inline-flex">
                {auth.profile?.firstName ?? t(locale, "nav.profile")}
              </Link>
              <LogoutButton locale={locale} label={t(locale, "nav.logout")} />
            </>
          ) : (
            <Link href={L("/login")} className="btn-primary !px-4 !py-2">
              {t(locale, "nav.login")}
            </Link>
          )}
        </div>
      </div>

      {/* мобильная навигация */}
      <nav aria-label="Mobile" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
        <Link href={L("/courses")} className="btn-ghost whitespace-nowrap">{t(locale, "nav.courses")}</Link>
        <Link href={L("/challenges")} className="btn-ghost whitespace-nowrap">{t(locale, "nav.challenges")}</Link>
        {auth && <Link href={L("/dashboard")} className="btn-ghost whitespace-nowrap">{t(locale, "nav.dashboard")}</Link>}
      </nav>
    </header>
  );
}
