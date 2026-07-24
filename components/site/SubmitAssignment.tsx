"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export function SubmitAssignmentForm(p: {
  locale: Locale;
  assignmentId: string;
  allowText: boolean;
  allowFile: boolean;
  resubmit: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let fileAssetId: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/files", { method: "POST", body: fd });
        const uj = await up.json();
        if (!up.ok) throw new Error(uj.error);
        fileAssetId = uj.id;
      }
      const res = await fetch(`/api/assignments/${p.assignmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fileAssetId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setText("");
      setFile(null);
      router.refresh();
    } catch {
      setError(t(p.locale, "common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mt-6 space-y-4 p-5">
      <h2 className="font-bold">{p.resubmit ? t(p.locale, "assignment.resubmit") : t(p.locale, "assignment.submit")}</h2>
      {p.allowText && (
        <div>
          <label htmlFor="sub-text" className="label">{t(p.locale, "assignment.yourAnswer")}</label>
          <textarea
            id="sub-text"
            rows={6}
            className="input resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      )}
      {p.allowFile && (
        <div>
          <label htmlFor="sub-file" className="label">{t(p.locale, "assignment.attachFile")}</label>
          <input
            id="sub-file"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={busy || (!text && !file)} className="btn-primary">
        {t(p.locale, "assignment.submit")}
      </button>
    </form>
  );
}
