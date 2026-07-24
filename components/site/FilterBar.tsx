"use client";

// Панель фильтров каталогов: состояние хранится в URL (§6).
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export function FilterBar({
  locale,
  subjects,
  grades,
  showStatus = true,
}: {
  locale: Locale;
  subjects: { slug: string; name: string }[];
  grades: { number: number; name: string }[];
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <form
      className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={(e) => e.preventDefault()}
      aria-label={t(locale, "common.search")}
    >
      <div className="lg:col-span-2">
        <label className="label" htmlFor="f-q">{t(locale, "common.search")}</label>
        <input
          id="f-q"
          className="input"
          defaultValue={sp.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => set("q", e.target.value)}
        />
      </div>
      {showStatus && (
        <div>
          <label className="label" htmlFor="f-status">{t(locale, "filter.status")}</label>
          <select id="f-status" className="input" value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
            <option value="">{t(locale, "common.all")}</option>
            <option value="planned">{t(locale, "filter.planned")}</option>
            <option value="active">{t(locale, "filter.active")}</option>
            <option value="finished">{t(locale, "filter.finished")}</option>
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="f-price">₸</label>
        <select id="f-price" className="input" value={sp.get("price") ?? ""} onChange={(e) => set("price", e.target.value)}>
          <option value="">{t(locale, "common.all")}</option>
          <option value="free">{t(locale, "filter.freeOnly")}</option>
          <option value="paid">{t(locale, "filter.paidOnly")}</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-subject">{t(locale, "filter.subject")}</label>
        <select id="f-subject" className="input" value={sp.get("subject") ?? ""} onChange={(e) => set("subject", e.target.value)}>
          <option value="">{t(locale, "common.all")}</option>
          {subjects.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-grade">{t(locale, "filter.grade")}</label>
        <select id="f-grade" className="input" value={sp.get("grade") ?? ""} onChange={(e) => set("grade", e.target.value)}>
          <option value="">{t(locale, "common.all")}</option>
          {grades.map((g) => (
            <option key={g.number} value={g.number}>{g.name}</option>
          ))}
        </select>
      </div>
    </form>
  );
}
