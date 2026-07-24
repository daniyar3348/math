"use client";

// Клиентские действия челленджа: участие (с кодом/оплатой) и запуск тестов.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
  mode: "join" | "test";
  challengeSlug: string;
  challengeId?: string;
  testSlug?: string;
  joined: boolean;
  state: "planned" | "active" | "finished";
  attempts?: { id: string; status: string }[];
  authed?: boolean;
  accessType?: "FREE" | "PAID";
  paid?: boolean;
  needsCode?: boolean;
}

export function ChallengeActions(p: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (p.mode === "test") {
    const open = p.attempts?.find((a) => a.status === "IN_PROGRESS");
    const done = p.attempts?.some((a) => a.status !== "IN_PROGRESS");
    if (!p.joined || p.state !== "active") {
      return <span className="text-xs text-slate-400">—</span>;
    }
    const start = async () => {
      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/tests/${p.testSlug}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeSlug: p.challengeSlug }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error);
        router.push(`/${p.locale}/attempt/${j.attemptId}`);
      } catch {
        setError(t(p.locale, "common.error"));
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="text-right">
        <button onClick={start} disabled={busy} className="btn-primary !py-2">
          {open ? t(p.locale, "test.continue") : done ? t(p.locale, "test.start") : t(p.locale, "test.start")}
        </button>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  // join
  if (!p.authed) {
    return (
      <a href={`/${p.locale}/login`} className="btn-primary w-full">
        {t(p.locale, "nav.login")}
      </a>
    );
  }
  if (p.joined) {
    return <p className="chip w-full justify-center bg-emerald-100 py-2 text-emerald-700">✓ {t(p.locale, "challenge.joined")}</p>;
  }
  if (p.state === "finished") {
    return <p className="text-center text-sm text-slate-500">{t(p.locale, "challenge.status.finished")}</p>;
  }

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      if (p.accessType === "PAID" && !p.paid) {
        // создаём платёж и уходим на mock-оплату
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refType: "CHALLENGE", refId: p.challengeId }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error);
        router.push(`/${p.locale}/pay/${j.paymentId}`);
        return;
      }
      const res = await fetch(`/api/challenges/${p.challengeSlug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "forbidden" ? t(p.locale, "challenge.enterCode") : t(p.locale, "common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {p.needsCode && (
        <div>
          <label className="label" htmlFor="ch-code">{t(p.locale, "challenge.enterCode")}</label>
          <input id="ch-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
      )}
      <button onClick={join} disabled={busy} className="btn-accent w-full !py-3">
        {p.accessType === "PAID" && !p.paid ? t(p.locale, "pay.buy") : t(p.locale, "challenge.join")}
      </button>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
