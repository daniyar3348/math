"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { api, post, ApiError } from "@/lib/api";
import type { ApiAttempt, ApiCourse } from "@/lib/types";
import { CourseCard, Spinner } from "@/components/ui";

function SecurityCard() {
  const { t, terr } = useI18n();
  const { me, refresh } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  // 2FA state (admin only)
  const [totpSetup, setTotpSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpMsg, setTotpMsg] = useState("");

  if (!me) return null;
  // В демо-сборке (GitHub Pages) серверные функции безопасности скрыты.
  if (process.env.NEXT_PUBLIC_DEMO === "1") return null;

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    try {
      await post("/api/me/password", { current, next });
      setPwMsg(t("saved"));
      setCurrent("");
      setNext("");
    } catch (err) {
      setPwMsg(err instanceof ApiError ? terr(err.message) : terr("generic"));
    }
  };

  const totpAction = async (action: "setup" | "confirm" | "disable") => {
    setTotpMsg("");
    try {
      const res = await post<{ secret?: string; uri?: string }>("/api/me/totp", {
        action,
        code: totpCode || undefined,
      });
      if (action === "setup") {
        setTotpSetup({ secret: res.secret!, uri: res.uri! });
      } else {
        setTotpSetup(null);
        setTotpCode("");
        setTotpMsg(t("saved"));
        refresh();
      }
    } catch (err) {
      setTotpMsg(err instanceof ApiError ? terr(err.message) : terr("generic"));
    }
  };

  return (
    <>
      <h2 className="mt-8 text-lg font-bold text-slate-800">🔐 {t("security")}</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {/* Password change */}
        <form onSubmit={changePw} className="card space-y-3 p-5">
          <h3 className="font-semibold text-slate-800">{t("changePassword")}</h3>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="input"
            placeholder={t("currentPassword")}
          />
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="input"
            placeholder={t("newPassword")}
          />
          {pwMsg && <p className="text-sm font-medium text-slate-600">{pwMsg}</p>}
          <button type="submit" className="btn-outline !py-2">
            {t("changePassword")}
          </button>
        </form>

        {/* TOTP 2FA — только для админов */}
        {me.user.role === "admin" && (
          <div className="card space-y-3 p-5">
            <h3 className="font-semibold text-slate-800">
              2FA (TOTP){" "}
              {me.user.totpEnabled ? (
                <span className="chip bg-emerald-100 text-emerald-700">включена</span>
              ) : (
                <span className="chip bg-slate-100 text-slate-500">выключена</span>
              )}
            </h3>
            {totpSetup && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-slate-600">
                  Добавь в Google Authenticator (ввести ключ вручную):
                </p>
                <code className="mt-1 block break-all rounded bg-white p-2 font-mono text-xs">
                  {totpSetup.secret}
                </code>
              </div>
            )}
            {(totpSetup || me.user.totpEnabled) && (
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                className="input text-center font-mono tracking-widest"
                placeholder="000000"
              />
            )}
            {totpMsg && <p className="text-sm font-medium text-slate-600">{totpMsg}</p>}
            <div className="flex gap-2">
              {!me.user.totpEnabled && !totpSetup && (
                <button onClick={() => totpAction("setup")} className="btn-brand !py-2">
                  Включить 2FA
                </button>
              )}
              {totpSetup && (
                <button onClick={() => totpAction("confirm")} className="btn-brand !py-2">
                  Подтвердить код
                </button>
              )}
              {me.user.totpEnabled && (
                <button onClick={() => totpAction("disable")} className="btn-outline !py-2">
                  Выключить (нужен код)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const MEDALS = [
  { icon: "🥉", xp: 50 },
  { icon: "🥈", xp: 150 },
  { icon: "🥇", xp: 300 },
  { icon: "💎", xp: 500 },
];

export default function ProfilePage() {
  const { t, tr, lang } = useI18n();
  const { me, loading } = useSession();
  const [courses, setCourses] = useState<ApiCourse[] | null>(null);
  const [attempts, setAttempts] = useState<ApiAttempt[] | null>(null);

  useEffect(() => {
    if (!me) return;
    api<{ courses: ApiCourse[] }>("/api/courses")
      .then((d) => setCourses(d.courses))
      .catch(() => setCourses([]));
    api<{ attempts: ApiAttempt[] }>("/api/attempts")
      .then((d) => setAttempts(d.attempts))
      .catch(() => setAttempts([]));
  }, [me]);

  if (loading) return <Spinner />;
  if (!me) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-slate-500">{t("needLogin")}</p>
        <Link href="/login" className="btn-brand mt-4 !py-3">
          {t("login")}
        </Link>
      </div>
    );
  }
  if (courses === null || attempts === null) return <Spinner />;

  const owned = courses.filter(
    (c) => me.enrolledCourseIds.includes(c.id) || c.priceKzt === 0
  );
  const doneCount = Object.keys(me.bestScores).length;

  return (
    <div className="container-app py-10">
      <div className="card flex flex-col items-center gap-4 p-6 sm:flex-row">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-3xl font-bold text-white">
          {me.user.name.charAt(0).toUpperCase()}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-extrabold text-slate-900">{me.user.name}</h1>
          <p className="text-slate-500">
            📍 {me.user.region}
            {me.user.grade ? ` · ${me.user.grade} ${t("grade").toLowerCase()}` : ""}
          </p>
        </div>
        <div className="grid grow grid-cols-3 gap-3 sm:max-w-xs">
          <Stat label={t("totalXp")} value={me.user.xp} accent="text-amber-500" />
          <Stat label={t("completed")} value={doneCount} accent="text-brand" />
          <Stat label={t("myCourses")} value={owned.length} accent="text-emerald-500" />
        </div>
      </div>

      <SecurityCard />

      <h2 className="mt-8 text-lg font-bold text-slate-800">{t("medals")}</h2>
      <div className="mt-3 flex gap-3">
        {MEDALS.map((m) => {
          const earned = me.user.xp >= m.xp;
          return (
            <div
              key={m.xp}
              className={`card flex flex-1 flex-col items-center p-4 ${
                earned ? "" : "opacity-40 grayscale"
              }`}
            >
              <span className="text-3xl">{m.icon}</span>
              <span className="mt-1 text-xs font-semibold text-slate-500">{m.xp} XP</span>
            </div>
          );
        })}
      </div>

      {attempts.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-bold text-slate-800">{t("myAttempts")}</h2>
          <div className="card mt-3 divide-y divide-slate-100">
            {attempts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/challenge/${a.challengeId}`}
                    className="font-semibold text-slate-800 hover:text-brand"
                  >
                    {tr(a.challengeTitle)}
                  </Link>
                  <div className="text-xs text-slate-400">
                    {new Date(a.finishedAt).toLocaleString(lang === "kk" ? "kk-KZ" : "ru-RU")}
                  </div>
                </div>
                <span
                  className={`chip ${
                    a.scorePct >= 60
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {a.scorePct}%
                </span>
                <span className="chip bg-amber-100 text-amber-700">+{a.xpEarned} XP</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-lg font-bold text-slate-800">{t("myCourses")}</h2>
      {owned.length === 0 ? (
        <p className="mt-3 text-slate-400">{t("noPurchases")}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {owned.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className={`text-2xl font-extrabold ${accent}`}>{value}</div>
      <div className="text-[11px] font-medium leading-tight text-slate-400">{label}</div>
    </div>
  );
}
