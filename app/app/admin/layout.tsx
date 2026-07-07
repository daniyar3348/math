"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { Spinner } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Обзор", exact: true },
  { href: "/admin/analytics", label: "Аналитика" },
  { href: "/admin/courses", label: "Курсы" },
  { href: "/admin/users", label: "Ученики" },
  { href: "/admin/payments", label: "Платежи" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useSession();
  const pathname = usePathname();

  if (loading) return <Spinner />;
  if (!me || me.user.role !== "admin") {
    return (
      <div className="container-app py-20 text-center">
        <div className="text-5xl">🛡️</div>
        <p className="mt-4 text-slate-500">Доступ только для администратора.</p>
        <Link href="/login" className="btn-brand mt-4 !py-3">
          Войти
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <div className="mb-6 flex items-center gap-2 overflow-x-auto">
        <span className="chip bg-violet-100 text-violet-700">Админ-панель</span>
        {NAV.map((n) => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                active ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
