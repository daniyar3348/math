"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export function StartTestButton(p: {
  locale: Locale;
  slug: string;
  testId: string;
  authed: boolean;
  needsCode: boolean;
  accessType: "FREE" | "PAID";
  paid: boolean;
  hasOpen: boolean;
  attemptsExhausted: boolean;
  openAttemptId?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!p.authed) {
    return (
      <a href={`/${p.locale}/login`} className="btn-primary !px-7 !py-3">
        {t(p.locale, "nav.login")}
      </a>
    );
  }
  if (p.attemptsExhausted && !p.hasOpen) {
    return <p className="text-sm font-semibold text-slate-500">{t(p.locale, "test.attemptsLeft", { n: 0 })}</p>;
  }

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      if (p.accessType === "PAID" && !p.paid) {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refType: "TEST", refId: p.testId }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error);
        router.push(`/${p.locale}/pay/${j.paymentId}`);
        return;
      }
      const res = await fetch(`/api/tests/${p.slug}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/${p.locale}/attempt/${j.attemptId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "forbidden" ? t(p.locale, "test.accessCode") : t(p.locale, "common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {p.needsCode && !p.hasOpen && (
        <div className="max-w-xs">
          <label htmlFor="t-code" className="label">{t(p.locale, "test.accessCode")}</label>
          <input id="t-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
      )}
      <button onClick={start} disabled={busy} className="btn-primary !px-8 !py-3 text-base">
        {p.hasOpen
          ? t(p.locale, "test.continue")
          : p.accessType === "PAID" && !p.paid
          ? t(p.locale, "pay.buy")
          : t(p.locale, "test.start")}
      </button>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
