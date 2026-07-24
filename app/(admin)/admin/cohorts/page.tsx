"use client";
import { Suspense } from "react";
import { CrudPage } from "@/components/admin/CrudPage";

function Inner() {
  return (
    <CrudPage
      title="Группы и классы"
      endpoint="/api/admin/cohorts"
      columns={[
        { key: "name", title: "Название" },
        { key: "gradeLevel", title: "Класс", render: (r) => r.gradeLevel?.nameRu ?? "—" },
        { key: "_count", title: "Учеников", render: (r) => r._count?.members ?? 0 },
      ]}
      fields={[
        { key: "name", label: "Название группы", type: "text", required: true },
        { key: "gradeLevelId", label: "ID класса (из «Предметы и темы»)", type: "text", hint: "Необязательно" },
        { key: "teacherUserId", label: "ID преподавателя", type: "text", hint: "Необязательно; ученики добавляются со страницы «Пользователи»" },
      ]}
    />
  );
}
export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
