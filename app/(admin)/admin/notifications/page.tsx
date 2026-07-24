"use client";
import { Suspense } from "react";
import { CrudPage } from "@/components/admin/CrudPage";

function Inner() {
  return (
    <CrudPage
      title="Уведомления (журнал)"
      endpoint="/api/admin/notifications"
      readonly
      columns={[
        { key: "type", title: "Тип" },
        { key: "userId", title: "Пользователь" },
        { key: "readAt", title: "Прочитано", render: (r) => (r.readAt ? "✓" : "—") },
        { key: "createdAt", title: "Когда", render: (r) => new Date(r.createdAt).toLocaleString("ru-RU"), sortable: true },
      ]}
    />
  );
}
export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
