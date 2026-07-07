"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

interface PaymentRow {
  id: string;
  user_name: string;
  user_email: string;
  course_title: string;
  amount_kzt: number;
  status: string;
  provider: string;
  provider_txn_id: string | null;
  created_at: number;
  paid_at: number | null;
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-600",
};

export default function AdminPayments() {
  const [rows, setRows] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    api<{ rows: PaymentRow[] }>("/api/admin/payments").then((d) => setRows(d.rows));
  }, []);

  if (!rows) return <Spinner />;
  const revenue = rows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amount_kzt, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Платежи ({rows.length})</h1>
        <span className="chip bg-emerald-100 text-emerald-700">
          💰 {revenue.toLocaleString("ru-RU")} ₸
        </span>
      </div>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3">Ученик</th>
              <th className="px-4 py-3">Курс</th>
              <th className="px-4 py-3">Сумма</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Провайдер</th>
              <th className="px-4 py-3">Дата</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-slate-800">{p.user_name}</div>
                  <div className="text-xs text-slate-400">{p.user_email}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{p.course_title}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-800">
                  {p.amount_kzt.toLocaleString("ru-RU")} ₸
                </td>
                <td className="px-4 py-2.5">
                  <span className={`chip ${STATUS_STYLE[p.status] ?? "bg-slate-100"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {p.provider}
                  {p.provider_txn_id && (
                    <span className="block text-xs text-slate-400">{p.provider_txn_id}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {new Date(p.created_at).toLocaleString("ru-RU")}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Платежей пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
