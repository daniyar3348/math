// UI-kit: состояния Loading/Skeleton/Empty/Error/Forbidden/NotFound (§15),
// пагинация, модалка с focus-trap, offline-баннер.
"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="card space-y-3 p-5">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <span aria-hidden className="text-4xl">🗂️</span>
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorState({ title, onRetry, retryLabel }: { title: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 border-red-200 bg-red-50 p-8 text-center">
      <span aria-hidden className="text-3xl">⚠️</span>
      <p className="font-semibold text-red-700">{title}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-outline">
          {retryLabel ?? "Retry"}
        </button>
      )}
    </div>
  );
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function OfflineBanner({ text }: { text: string }) {
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false);
  if (!offline) return null;
  return (
    <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
      📡 {text}
    </div>
  );
}

/** Доступная модалка: focus-trap, Esc, aria-modal. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = [...focusables()];
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="btn-ghost -mr-2 -mt-1 !px-2">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Пагинация: состояние в URL (?page=). */
export function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const go = (p: number) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("page", String(p));
    router.push(`?${sp.toString()}`, { scroll: true });
  };
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-1">
      <button className="btn-ghost" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
        ←
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
        .map((p, i, arr) => (
          <span key={p} className="flex items-center">
            {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-slate-400">…</span>}
            <button
              onClick={() => go(p)}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-9 rounded-lg px-2 py-1.5 text-sm font-semibold ${
                p === page ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          </span>
        ))}
      <button className="btn-ghost" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page">
        →
      </button>
    </nav>
  );
}

export function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--primary)" }} />
      </div>
    </div>
  );
}
