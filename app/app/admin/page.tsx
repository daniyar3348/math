"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

interface Summary {
  users: number;
  courses: number;
  challenges: number;
  questions: number;
  attempts: number;
  paidPayments: number;
  revenueKzt: number;
}

export default function AdminHome() {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    api<Summary>("/api/admin/summary").then(setS).catch(() => setS(null));
  }, []);

  if (!s) return <Spinner />;

  const cards = [
    { label: "Учеников", value: s.users, icon: "👥" },
    { label: "Курсов", value: s.courses, icon: "📚" },
    { label: "Челленджей", value: s.challenges, icon: "🎯" },
    { label: "Вопросов", value: s.questions, icon: "❓" },
    { label: "Попыток", value: s.attempts, icon: "📝" },
    { label: "Оплат", value: s.paidPayments, icon: "💳" },
    {
      label: "Выручка",
      value: `${s.revenueKzt.toLocaleString("ru-RU")} ₸`,
      icon: "💰",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900">Обзор</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="text-2xl">{c.icon}</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{c.value}</div>
            <div className="text-sm text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Link href="/admin/courses" className="btn-brand !py-3">
          Управлять курсами →
        </Link>
      </div>
    </div>
  );
}
