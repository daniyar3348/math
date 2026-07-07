"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { LogoFull } from "@/components/Logo";
import type { Lang } from "@/lib/types";

function LangSwitch() {
  const { lang, setLang } = useI18n();
  const langs: Lang[] = ["kk", "ru"];
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-md px-2 py-1 uppercase transition ${
            lang === l ? "bg-brand text-white" : "text-slate-500 hover:text-brand"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const { t } = useI18n();
  const { me, loading, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const nav = [
    { href: "/catalog", label: t("catalog") },
    { href: "/challenges", label: t("challenges") },
    { href: "/leaderboard", label: t("leaderboard") },
  ];
  if (me?.user.role === "admin") nav.push({ href: "/admin", label: t("adminPanel") });

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Link href="/">
          <LogoFull />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                pathname.startsWith(n.href)
                  ? "text-brand"
                  : "text-slate-600 hover:text-brand"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch />
          {!loading && me ? (
            <>
              <span className="chip hidden bg-amber-100 text-amber-700 sm:inline-flex">
                ⚡ {me.user.xp} XP
              </span>
              <Link href="/profile" className="btn-ghost !px-3">
                {me.user.name.split(" ")[0]}
              </Link>
              <button
                onClick={onLogout}
                className="btn-outline hidden !px-3 !py-2 sm:inline-flex"
              >
                {t("logout")}
              </button>
            </>
          ) : !loading ? (
            <Link href="/login" className="btn-brand !px-4 !py-2">
              {t("login")}
            </Link>
          ) : null}
        </div>
      </div>

      {/* mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${
              pathname.startsWith(n.href) ? "bg-indigo-50 text-brand" : "text-slate-600"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
