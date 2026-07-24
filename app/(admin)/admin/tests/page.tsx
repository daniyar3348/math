"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { AdminTable, api, I18nBadge, StatusChip, StatusButtons, type Row } from "@/components/admin/kit";

function Inner() {
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Тесты</h1>
        <Link href="/admin/tests/new" className="btn-primary !py-2">+ Создать тест</Link>
      </div>
      <AdminTable
        endpoint="/api/admin/tests"
        title="Тесты"
        reloadKey={reloadKey}
        statusFilter={["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]}
        columns={[
          {
            key: "translations",
            title: "Название",
            render: (r) => (
              <Link className="font-semibold hover:underline" href={`/admin/tests/${r.id}`}>
                {(r.translations as Row[])?.find((t) => t.locale === "ru")?.title || r.slug}
              </Link>
            ),
          },
          { key: "mode", title: "Режим" },
          { key: "subject", title: "Предмет", render: (r) => r.subject?.nameRu ?? "" },
          {
            key: "sections",
            title: "Вопросов",
            render: (r) => (r.sections as Row[])?.reduce((s, sec) => s + ((sec.questions as Row[])?.length ?? 0) + (sec.randomCount ?? 0), 0),
          },
          { key: "_count", title: "Попыток", render: (r) => r._count?.attempts ?? 0 },
          {
            key: "i18n",
            title: "Перевод",
            render: (r) => {
              const has = (l: string) => !!(r.translations as Row[])?.find((t) => t.locale === l && t.title?.trim());
              return <I18nBadge kk={has("kk")} ru={has("ru")} />;
            },
          },
          { key: "status", title: "Статус", render: (r) => <StatusChip status={r.status} /> },
          {
            key: "id",
            title: "",
            render: (r) => (
              <div className="flex items-center gap-1">
                <a className="btn-ghost !px-2 !py-1 text-xs" title="Предпросмотр глазами ученика" href={`/ru/tests/${r.slug}`} target="_blank">👁</a>
                <StatusButtons entity="test" id={r.id} status={r.status} onDone={() => setReloadKey((k) => k + 1)} />
              </div>
            ),
          },
        ]}
        onDelete={async (row) => {
          await api(`/api/admin/tests/${row.id}`, { method: "DELETE" });
        }}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
