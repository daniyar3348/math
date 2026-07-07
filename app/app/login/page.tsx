"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { post, ApiError } from "@/lib/api";

export default function LoginPage() {
  const { t, terr } = useI18n();
  const { refresh } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await post<{ ok: boolean; role: string }>("/api/auth/login", {
        email,
        password,
        ...(needTotp && totp ? { totp } : {}),
      });
      await refresh();
      router.push(res.role === "admin" ? "/admin" : "/");
    } catch (err) {
      if (err instanceof ApiError && err.message === "totp_required") {
        setNeedTotp(true); // аккаунт с 2FA — показываем поле кода
      } else {
        setError(err instanceof ApiError ? terr(err.message) : terr("generic"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-app max-w-md py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-extrabold text-slate-900">{t("loginTitle")}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600">{t("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              className="input mt-1"
              placeholder="you@mail.kz"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600">{t("password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
              placeholder="••••••"
            />
          </div>
          {needTotp && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
              <label className="text-sm font-semibold text-slate-600">
                🔐 {t("totpPrompt")}
              </label>
              <input
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoFocus
                className="input mt-1 text-center font-mono text-lg tracking-widest"
                placeholder="000000"
              />
            </div>
          )}
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
          <button type="submit" disabled={busy} className="btn-brand w-full !py-3">
            {busy ? t("processing") : `${t("enter")} →`}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-semibold text-brand hover:underline">
            {t("register")}
          </Link>
        </p>
      </div>
    </div>
  );
}
