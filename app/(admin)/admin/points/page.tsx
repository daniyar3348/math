"use client";

// Баллы: история транзакций + ручная корректировка с обязательным комментарием.
import { Suspense, useState } from "react";
import { AdminTable, api, Field } from "@/components/admin/kit";

function Inner() {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const adjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/admin/points", {
        method: "POST",
        body: JSON.stringify({ userId, amount: Number(amount), comment }),
      });
      setMsg("✅ Начислено");
      setUserId(""); setAmount(""); setComment("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Ошибка"}`);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Баллы и достижения</h1>

      <form onSubmit={adjust} className="card mb-6 grid gap-3 p-5 sm:grid-cols-4">
        <Field label="ID пользователя"><input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} required /></Field>
        <Field label="Сумма (+/−)"><input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label="Комментарий (обязателен)"><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} minLength={5} required /></Field>
        <div className="flex items-end">
          <button className="btn-primary w-full">Скорректировать</button>
        </div>
        {msg && <p className="sm:col-span-4 text-sm font-semibold">{msg}</p>}
      </form>

      <AdminTable
        endpoint="/api/admin/points"
        title="История баллов"
        reloadKey={reloadKey}
        columns={[
          { key: "createdAt", title: "Когда", render: (r) => new Date(r.createdAt).toLocaleString("ru-RU"), sortable: true },
          { key: "user", title: "Пользователь", render: (r) => `${r.user?.profile?.firstName ?? ""} ${r.user?.profile?.lastName ?? ""}` },
          { key: "amount", title: "Баллы", render: (r) => <span className={Number(r.amount) >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>{Number(r.amount) > 0 ? "+" : ""}{r.amount}</span> },
          { key: "reason", title: "Причина" },
          { key: "comment", title: "Комментарий" },
        ]}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
