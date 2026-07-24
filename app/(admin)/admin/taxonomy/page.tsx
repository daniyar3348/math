"use client";

// Предметы, классы и темы (§12) — вкладки на generic CRUD.
import { Suspense, useEffect, useState } from "react";
import { CrudPage } from "@/components/admin/CrudPage";
import { api, type Row } from "@/components/admin/kit";

function TaxonomyInner() {
  const [tab, setTab] = useState<"subjects" | "gradeLevels" | "topics">("subjects");
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);

  useEffect(() => {
    api<{ rows: Row[] }>("/api/admin/subjects?pageSize=100").then((d) => setSubjects(d.rows)).catch(() => {});
    api<{ rows: Row[] }>("/api/admin/gradeLevels?pageSize=100").then((d) => setGrades(d.rows)).catch(() => {});
  }, [tab]);

  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ["subjects", "Предметы"],
            ["gradeLevels", "Классы"],
            ["topics", "Темы"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === k ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "subjects" && (
        <CrudPage
          title="Предметы"
          endpoint="/api/admin/subjects"
          columns={[
            { key: "slug", title: "Slug" },
            { key: "nameKk", title: "Атауы (KK)" },
            { key: "nameRu", title: "Название (RU)" },
            { key: "sort", title: "Порядок", sortable: true },
          ]}
          fields={[
            { key: "slug", label: "Slug (латиницей)", type: "text", required: true },
            { key: "nameKk", label: "Атауы (KK)", type: "text", required: true },
            { key: "nameRu", label: "Название (RU)", type: "text", required: true },
            { key: "sort", label: "Порядок", type: "number" },
          ]}
        />
      )}
      {tab === "gradeLevels" && (
        <CrudPage
          title="Классы"
          endpoint="/api/admin/gradeLevels"
          columns={[
            { key: "number", title: "Номер", sortable: true },
            { key: "nameKk", title: "Атауы (KK)" },
            { key: "nameRu", title: "Название (RU)" },
          ]}
          fields={[
            { key: "number", label: "Номер класса", type: "number", required: true },
            { key: "nameKk", label: "Атауы (KK)", type: "text", required: true },
            { key: "nameRu", label: "Название (RU)", type: "text", required: true },
          ]}
        />
      )}
      {tab === "topics" && (
        <CrudPage
          title="Темы"
          endpoint="/api/admin/topics"
          columns={[
            { key: "slug", title: "Slug" },
            { key: "nameRu", title: "Название (RU)" },
            { key: "subject", title: "Предмет", render: (r) => r.subject?.nameRu ?? "" },
            { key: "gradeLevel", title: "Класс", render: (r) => r.gradeLevel?.nameRu ?? "—" },
          ]}
          fields={[
            { key: "subjectId", label: "Предмет", type: "select", required: true, options: subjects.map((s) => ({ value: s.id, label: s.nameRu })) },
            { key: "gradeLevelId", label: "Класс", type: "select", options: grades.map((g) => ({ value: g.id, label: g.nameRu })) },
            { key: "slug", label: "Slug", type: "text", required: true },
            { key: "nameKk", label: "Атауы (KK)", type: "text", required: true },
            { key: "nameRu", label: "Название (RU)", type: "text", required: true },
            { key: "sort", label: "Порядок", type: "number" },
          ]}
        />
      )}
    </div>
  );
}

export default function TaxonomyPage() {
  return (
    <Suspense fallback={<div className="skeleton h-40 w-full" />}>
      <TaxonomyInner />
    </Suspense>
  );
}
