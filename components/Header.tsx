"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
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
  const pathname = usePathname();
  const nav = [
    { href: "/decks", label: t("decks") },
    { href: "/progress", label: t("progress") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                pathname.startsWith(n.href) ? "text-brand" : "text-slate-600 hover:text-brand"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <span className="ml-1">
            <LangSwitch />
          </span>
        </div>
      </div>
    </header>
  );
}
