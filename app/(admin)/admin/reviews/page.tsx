"use client";
import { Suspense } from "react";
import { CrudPage } from "@/components/admin/CrudPage";

function Inner() {
  return (
    <CrudPage
      title="Отзывы (лендинг)"
      endpoint="/api/admin/reviews"
      columns={[
        { key: "authorName", title: "Автор" },
        { key: "textRu", title: "Текст (RU)", render: (r) => String(r.textRu).slice(0, 80) },
        { key: "rating", title: "★", sortable: true },
        { key: "published", title: "Опубликован", render: (r) => (r.published ? "✅" : "—") },
      ]}
      fields={[
        { key: "authorName", label: "Автор", type: "text", required: true },
        { key: "textKk", label: "Пікір (KK)", type: "textarea", required: true },
        { key: "textRu", label: "Текст (RU)", type: "textarea", required: true },
        { key: "rating", label: "Оценка 1–5", type: "number" },
        { key: "published", label: "Показывать на лендинге", type: "checkbox" },
        { key: "sort", label: "Порядок", type: "number" },
      ]}
    />
  );
}
export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
