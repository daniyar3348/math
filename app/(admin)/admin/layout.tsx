// Админ-панель (§12): отдельный root-layout, доступ — только персоналу.
// Серверная проверка прав; язык интерфейса админки — русский (ТЗ-практика),
// контент везде вводится на двух языках.
import type { Metadata } from "next";
import Link from "next/link";
import "../../globals.css";
import { getAuth } from "@/lib/auth/guard";
import { isStaff, isAdmin } from "@/lib/rbac";
import { getSettings, darken } from "@/lib/settings";

export const metadata: Metadata = { title: "Админ-панель — BilimHub" };

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/admin", label: "📊 Dashboard" },
  { href: "/admin/review", label: "🖊️ Проверка работ" },
  { href: "/admin/questions", label: "❓ Банк вопросов", adminOnly: true },
  { href: "/admin/tests", label: "📝 Тесты", adminOnly: true },
  { href: "/admin/challenges", label: "⚡ Челленджи", adminOnly: true },
  { href: "/admin/courses", label: "📚 Курсы", adminOnly: true },
  { href: "/admin/users", label: "👥 Пользователи", adminOnly: true },
  { href: "/admin/cohorts", label: "🏫 Группы", adminOnly: true },
  { href: "/admin/taxonomy", label: "🗂️ Предметы и темы", adminOnly: true },
  { href: "/admin/enrollments", label: "🎓 Записи на курсы", adminOnly: true },
  { href: "/admin/points", label: "⭐ Баллы", adminOnly: true },
  { href: "/admin/payments", label: "💳 Платежи", adminOnly: true },
  { href: "/admin/reviews", label: "💬 Отзывы", adminOnly: true },
  { href: "/admin/files", label: "📁 Файлы", adminOnly: true },
  { href: "/admin/notifications", label: "🔔 Уведомления", adminOnly: true },
  { href: "/admin/audit", label: "🕵️ Аудит", adminOnly: true },
  { href: "/admin/settings", label: "⚙️ Настройки", adminOnly: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  const s = await getSettings();
  const styleVars = {
    "--primary": s.primaryColor,
    "--primary-dark": darken(s.primaryColor),
    "--accent": s.accentColor,
  } as React.CSSProperties;

  if (!auth || !isStaff(auth.roles)) {
    return (
      <html lang="ru" style={styleVars}>
        <body>
          <div className="container-app py-24 text-center">
            <p aria-hidden className="text-5xl">🛡️</p>
            <h1 className="mt-4 text-2xl font-extrabold">Доступ только для персонала</h1>
            <Link href="/ru/login" className="btn-primary mt-6">Войти</Link>
          </div>
        </body>
      </html>
    );
  }

  const admin = isAdmin(auth.roles);
  const nav = NAV.filter((n) => !n.adminOnly || admin);

  return (
    <html lang="ru" className="h-full antialiased" style={styleVars}>
      <body className="flex min-h-screen bg-slate-50">
        <aside className="hidden w-60 flex-none border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
            <Link href="/admin" className="flex items-center gap-2 px-2 font-extrabold">
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: "var(--primary)" }}>
                {s.brandName.slice(0, 1)}
              </span>
              {s.brandName}
            </Link>
            <nav aria-label="Admin" className="mt-5 space-y-0.5">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 border-t border-slate-100 pt-4">
              <Link href="/kk" className="block px-3 text-sm text-slate-400 hover:underline">← На сайт</Link>
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          {/* мобильная шапка */}
          <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <details>
              <summary className="cursor-pointer font-bold">☰ {s.brandName} · Админ</summary>
              <nav className="mt-2 grid grid-cols-2 gap-1">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className="rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                    {n.label}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
