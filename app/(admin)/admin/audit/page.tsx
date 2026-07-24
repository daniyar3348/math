"use client";
import { Suspense } from "react";
import { CrudPage } from "@/components/admin/CrudPage";

function Inner() {
  return (
    <CrudPage
      title="Аудит действий"
      endpoint="/api/admin/audit"
      readonly
      columns={[
        { key: "createdAt", title: "Когда", render: (r) => new Date(r.createdAt).toLocaleString("ru-RU"), sortable: true },
        { key: "action", title: "Действие" },
        { key: "entityType", title: "Сущность" },
        { key: "entityId", title: "ID" },
        { key: "actorId", title: "Кто" },
      ]}
    />
  );
}
export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
