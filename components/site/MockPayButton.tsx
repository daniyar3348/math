"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export function MockPayButton({ locale, paymentId }: { locale: Locale; paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/payments/${paymentId}/mock-confirm`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(t(locale, "pay.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5">
      <button onClick={pay} disabled={busy} className="btn-accent w-full !py-3">
        {busy ? t(locale, "pay.processing") : t(locale, "pay.buy")}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
