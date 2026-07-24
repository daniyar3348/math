"use client";

// Вход: ученик — телефон+OTP (dev-код показывается только в dev),
// сотрудник/родитель — email+пароль (+TOTP при включённой 2FA).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

type Tab = "student" | "staff";

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // student
  const [phone, setPhone] = useState("+7");
  const [sent, setSent] = useState(false);
  const [newUser, setNewUser] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // staff
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);

  const errText = (code: string) => {
    if (code === "rate_limited") return t(locale, "auth.err.rate");
    if (code === "otp_invalid") return t(locale, "auth.err.otp");
    if (code === "forbidden") return t(locale, "auth.err.blocked");
    return t(locale, "auth.err.invalid");
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setSent(true);
      setNewUser(j.newUser);
      if (j.devCode) setDevCode(j.devCode);
    } catch (e) {
      setError(errText(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, firstName: firstName || undefined, lastName: lastName || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch (e) {
      setError(errText(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const staffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(totp ? { totp } : {}) }),
      });
      const j = await res.json();
      if (res.status === 401 && j.totpRequired) {
        setNeedTotp(true);
        return;
      }
      if (!res.ok) throw new Error(j.error);
      const roles: string[] = j.roles ?? [];
      router.push(roles.includes("ADMIN") || roles.includes("SUPER_ADMIN") ? "/admin" : `/${locale}/dashboard`);
      router.refresh();
    } catch (e) {
      setError(errText(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mt-6 p-6">
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(["student", "staff"] as Tab[]).map((tb) => (
          <button
            key={tb}
            role="tab"
            aria-selected={tab === tb}
            onClick={() => {
              setTab(tb);
              setError("");
            }}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              tab === tb ? "bg-white shadow-sm" : "text-slate-600"
            }`}
          >
            {t(locale, tb === "student" ? "auth.studentTab" : "auth.staffTab")}
          </button>
        ))}
      </div>

      {tab === "student" ? (
        !sent ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label htmlFor="phone" className="label">{t(locale, "auth.phone")}</label>
              <input
                id="phone"
                className="input"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 12))}
                placeholder="+77001234567"
                autoComplete="tel"
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={busy || !/^\+7\d{10}$/.test(phone)} className="btn-primary w-full !py-3">
              {t(locale, "auth.sendCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-slate-500">{t(locale, "auth.otpHint")}</p>
            {devCode && (
              <p className="rounded-lg p-3 text-sm font-semibold" style={{ background: "var(--accent-soft)" }}>
                {t(locale, "auth.devOtpNote")}: <code className="font-mono text-base">{devCode}</code>
              </p>
            )}
            <div>
              <label htmlFor="otp" className="label">{t(locale, "auth.otpCode")}</label>
              <input
                id="otp"
                className="input text-center font-mono text-lg tracking-widest"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                autoFocus
              />
            </div>
            {newUser && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fn" className="label">Аты / Имя</label>
                  <input id="fn" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="ln" className="label">Тегі / Фамилия</label>
                  <input id="ln" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={busy || code.length !== 6 || (newUser && !firstName)} className="btn-primary w-full !py-3">
              {t(locale, "auth.verify")}
            </button>
          </form>
        )
      ) : (
        <form onSubmit={staffLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">{t(locale, "auth.email")}</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label htmlFor="pass" className="label">{t(locale, "auth.password")}</label>
            <input id="pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {needTotp && (
            <div>
              <label htmlFor="totp" className="label">{t(locale, "auth.totp")}</label>
              <input
                id="totp"
                className="input text-center font-mono text-lg tracking-widest"
                inputMode="numeric"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full !py-3">
            {t(locale, "auth.signIn")}
          </button>
        </form>
      )}
    </div>
  );
}
