"use client";

import { useI18n } from "@/lib/i18n";

// Показывается только в демо-сборке для GitHub Pages.
export function DemoBanner() {
  const { lang } = useI18n();
  if (process.env.NEXT_PUBLIC_DEMO !== "1") return null;
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-800">
      {lang === "kk"
        ? "🧪 Демо-нұсқа: деректер тек осыл браузерде сақталады, төлем жалған. Демо-кіру: demo@esep.kz / demo123"
        : "🧪 Демо-версия: данные хранятся только в вашем браузере, оплата фиктивная. Демо-вход: demo@esep.kz / demo123"}
    </div>
  );
}
