"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { post, ApiError } from "@/lib/api";
import { REGIONS } from "@/lib/types";

export default function RegisterPage() {
  const { t, terr } = useI18n();
  const { refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState(REGIONS[0]);
  const [grade, setGrade] = useState<number>(6);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await post("/api/auth/register", { name, email, password, region, grade });
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? terr(err.message) : terr("generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-app max-w-md py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-extrabold text-slate-900">{t("registerTitle")}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600">{t("yourName")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="input mt-1"
              placeholder="Нұржан"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600">{t("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-600">{t("region")}</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="input mt-1"
              >
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600">{t("grade")}</label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="input mt-1"
              >
                {[4, 5, 6, 7, 8].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
          <button type="submit" disabled={busy} className="btn-brand w-full !py-3">
            {busy ? t("processing") : `${t("createAccount")} →`}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            {t("login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
