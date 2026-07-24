"use client";

// Error boundary (§17): дружелюбное сообщение + retry, без утечки деталей.
export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-app py-24 text-center" role="alert">
      <p aria-hidden className="text-6xl">⚠️</p>
      <h1 className="mt-4 text-2xl font-extrabold">Қате шықты / Произошла ошибка</h1>
      <button onClick={reset} className="btn-primary mt-6">
        Қайталау / Повторить
      </button>
    </div>
  );
}
