"use client";

// Платежи: история + ручная выдача доступа (payments.grant).
import { Suspense, useState } from "react";
import { AdminTable, api } from "@/components/admin/kit";

function Inner() {
  const [reloadKey, setReloadKey] = useState(0);
  const grant = async (id: string) => {
    if (!confirm("Подтвердить платёж вручную и выдать доступ?")) return;
    await api(`/api/admin/payments/${id}/grant`, { method: "POST" });
    setReloadKey((k) => k + 1);
  };
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Платежи</h1>
      <AdminTable
        endpoint="/api/admin/payments"
        title="Платежи"
        reloadKey={reloadKey}
        columns={[
          { key: "createdAt", title: "Дата", render: (r) => new Date(r.createdAt).toLocaleString("ru-RU"), sortable: true },
          { key: "user", title: "Пользователь", render: (r) => `${r.user?.profile?.firstName ?? ""} ${r.user?.profile?.lastName ?? ""}` },
          { key: "refType", title: "За что", render: (r) => `${r.refType} ${String(r.refId).slice(0, 10)}…` },
          { key: "amountKzt", title: "Сумма", render: (r) => `${Number(r.amountKzt).toLocaleString("ru-RU")} ₸`, sortable: true },
          {
            key: "status",
            title: "Статус",
            render: (r) => (
              <span className={`chip ${r.status === "PAID" ? "bg-emerald-100 text-emerald-700" : r.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                {r.status}
              </span>
            ),
          },
          {
            key: "id",
            title: "",
            render: (r) =>
              r.status === "PENDING" ? (
                <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => grant(r.id)}>
                  Выдать доступ
                </button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
