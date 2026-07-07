"use client";

// Analytics: daily activity charts (pure SVG, no libs), course performance,
// and per-question difficulty from answer_events.

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { AdminSection } from "@/components/admin";

interface DayPoint {
  day: string;
  n: number;
}
interface CourseStat {
  id: string;
  title_ru: string;
  cover: string;
  price_kzt: number;
  enrollments: number;
  attempts: number;
  revenue: number;
}
interface DifficultyRow {
  questionId: string;
  prompt: string;
  challengeId: string;
  challengeTitle: string;
  answers: number;
  correctPct: number | null;
}
interface Analytics {
  registrationsByDay: DayPoint[];
  attemptsByDay: DayPoint[];
  revenueByDay: DayPoint[];
  courseStats: CourseStat[];
  difficulty: DifficultyRow[];
}

function BarChart({ points, color, unit }: { points: DayPoint[]; color: string; unit?: string }) {
  const max = Math.max(...points.map((p) => p.n), 1);
  const total = points.reduce((s, p) => s + p.n, 0);
  const W = 600;
  const H = 120;
  const gap = 2;
  const bw = W / points.length - gap;
  return (
    <div>
      <div className="mb-1 text-right text-xs font-semibold text-slate-400">
        Σ 30 дней: {total.toLocaleString("ru-RU")}
        {unit ?? ""}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full">
        {points.map((p, i) => {
          const h = Math.max((p.n / max) * H, p.n > 0 ? 3 : 1);
          return (
            <g key={p.day}>
              <rect
                x={i * (bw + gap)}
                y={H - h}
                width={bw}
                height={h}
                rx={2}
                fill={p.n > 0 ? color : "#e2e8f0"}
              >
                <title>{`${p.day}: ${p.n}${unit ?? ""}`}</title>
              </rect>
              {(i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)) && (
                <text
                  x={i * (bw + gap) + bw / 2}
                  y={H + 13}
                  fontSize="9"
                  fill="#94a3b8"
                  textAnchor="middle"
                >
                  {p.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function difficultyBadge(pct: number | null, answers: number) {
  if (pct === null || answers === 0)
    return <span className="chip bg-slate-100 text-slate-400">нет данных</span>;
  if (pct < 40) return <span className="chip bg-red-100 text-red-600">сложный · {pct}%</span>;
  if (pct > 85)
    return <span className="chip bg-sky-100 text-sky-600">лёгкий · {pct}%</span>;
  return <span className="chip bg-emerald-100 text-emerald-700">ок · {pct}%</span>;
}

export default function AdminAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [challengeFilter, setChallengeFilter] = useState("all");

  useEffect(() => {
    api<Analytics>("/api/admin/analytics").then(setData).catch(() => setData(null));
  }, []);

  const challenges = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, string>();
    data.difficulty.forEach((d) => seen.set(d.challengeId, d.challengeTitle));
    return [...seen.entries()];
  }, [data]);

  if (!data) return <Spinner />;

  const diffRows =
    challengeFilter === "all"
      ? data.difficulty
      : data.difficulty.filter((d) => d.challengeId === challengeFilter);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Аналитика</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminSection title="👥 Регистрации / день">
          <BarChart points={data.registrationsByDay} color="#4f46e5" />
        </AdminSection>
        <AdminSection title="📝 Попытки / день">
          <BarChart points={data.attemptsByDay} color="#f59e0b" />
        </AdminSection>
        <AdminSection title="💰 Выручка / день">
          <BarChart points={data.revenueByDay} color="#10b981" unit=" ₸" />
        </AdminSection>
      </div>

      <AdminSection title="📚 Курсы: продажи и активность">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="py-2 pr-4">Курс</th>
                <th className="py-2 pr-4">Доступов</th>
                <th className="py-2 pr-4">Попыток</th>
                <th className="py-2 pr-4">Выручка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.courseStats.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 pr-4 font-semibold text-slate-800">
                    {c.cover} {c.title_ru}
                    {c.price_kzt === 0 && (
                      <span className="ml-2 text-xs font-normal text-emerald-600">бесплатный</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">{c.enrollments}</td>
                  <td className="py-2.5 pr-4">{c.attempts}</td>
                  <td className="py-2.5 pr-4 font-semibold text-emerald-600">
                    {c.revenue.toLocaleString("ru-RU")} ₸
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminSection
        title="❓ Сложность вопросов (% правильных ответов)"
        action={
          <select
            value={challengeFilter}
            onChange={(e) => setChallengeFilter(e.target.value)}
            className="input max-w-64 !py-1.5 text-xs"
          >
            <option value="all">Все челленджи</option>
            {challenges.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        }
      >
        <p className="mb-3 text-xs text-slate-400">
          🔴 &lt;40% — слишком сложный или ошибка в ответе · 🔵 &gt;85% — слишком лёгкий
        </p>
        <div className="divide-y divide-slate-50">
          {diffRows.map((d) => (
            <div key={d.questionId} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{d.prompt}</p>
                <p className="text-xs text-slate-400">
                  {d.challengeTitle} · ответов: {d.answers}
                </p>
              </div>
              {difficultyBadge(d.correctPct, d.answers)}
            </div>
          ))}
          {diffRows.length === 0 && (
            <p className="py-3 text-sm text-slate-400">Нет вопросов.</p>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
