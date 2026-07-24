"use client";
import { Suspense } from "react";
import { CrudPage } from "@/components/admin/CrudPage";

function Inner() {
  return (
    <CrudPage
      title="Файлы"
      endpoint="/api/admin/files"
      readonly
      columns={[
        { key: "name", title: "Имя" },
        { key: "mime", title: "Тип" },
        { key: "size", title: "Размер", render: (r) => `${Math.round(Number(r.size) / 1024)} КБ`, sortable: true },
        { key: "visibility", title: "Доступ" },
        { key: "createdAt", title: "Загружен", render: (r) => new Date(r.createdAt).toLocaleString("ru-RU"), sortable: true },
        { key: "id", title: "Ссылка", render: (r) => <a className="underline" href={`/api/files/${r.id}`} target="_blank">открыть</a> },
      ]}
    />
  );
}
export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
