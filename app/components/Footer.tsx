"use client";

import { useI18n } from "@/lib/i18n";
import { LogoFull } from "@/components/Logo";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-app flex flex-col items-center justify-between gap-3 py-8 text-sm text-slate-500 sm:flex-row">
        <LogoFull size={24} />
        <p className="text-center sm:text-right">{t("footer")}</p>
      </div>
    </footer>
  );
}
