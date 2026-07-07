"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { LeaderboardRow } from "@/lib/types";
import { Spinner } from "@/components/ui";

export default function LeaderboardPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [region, setRegion] = useState<string>("all");

  useEffect(() => {
    api<{ leaderboard: LeaderboardRow[] }>("/api/leaderboard")
      .then((d) => setRows(d.leaderboard))
      .catch(() => setRows([]));
  }, []);

  const regions = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.region).filter(Boolean))),
    [rows]
  );

  if (rows === null) return <Spinner />;
  const list = region === "all" ? rows : rows.filter((r) => r.region === region);

  return (
    <div className="container-app max-w-2xl py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">🏆 {t("leaderboard")}</h1>
      <p className="mt-2 text-slate-500">{t("f2d")}</p>

      <div className="mt-5">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="input max-w-56">
          <option value="all">{t("allRegions")}</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="card mt-5 divide-y divide-slate-100">
        {list.map((r, i) => (
          <div
            key={`${r.name}-${i}`}
            className={`flex items-center gap-4 px-4 py-3 ${r.me ? "bg-indigo-50" : ""}`}
          >
            <span
              className={`grid h-8 w-8 flex-none place-items-center rounded-full text-sm font-bold ${
                i === 0
                  ? "bg-amber-400 text-white"
                  : i === 1
                  ? "bg-slate-300 text-white"
                  : i === 2
                  ? "bg-orange-300 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {i + 1}
            </span>
            <div className="flex-1">
              <div className="font-semibold text-slate-800">
                {r.name}{" "}
                {r.me && <span className="text-xs text-brand">({t("profile")})</span>}
              </div>
              <div className="text-xs text-slate-400">{r.region}</div>
            </div>
            <span className="chip bg-amber-100 text-amber-700">⚡ {r.xp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
