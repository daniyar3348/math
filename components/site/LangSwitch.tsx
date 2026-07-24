"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

// Переключатель языка: заменяет префикс пути, сохраняет выбор в cookie.
export function LangSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (target: Locale) => {
    if (target === locale) return;
    // событийный обработчик: запись cookie тут корректна
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `bh_locale=${target}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
    const rest = pathname.replace(/^\/(kk|ru)/, "");
    router.push(`/${target}${rest || ""}`);
  };

  return (
    <div role="group" aria-label="Language" className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold">
      {(["kk", "ru"] as const).map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          aria-pressed={l === locale}
          className={`rounded-md px-2.5 py-1.5 uppercase transition ${
            l === locale ? "text-white" : "text-slate-500 hover:text-slate-800"
          }`}
          style={l === locale ? { background: "var(--primary)" } : undefined}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
