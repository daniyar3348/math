"use client";

// Фабрика CRUD-страниц: таблица + модальная форма по конфигу полей.
import { useState } from "react";
import { Modal } from "@/components/ui";
import { AdminTable, api, Field, type Column, type Row } from "./kit";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "checkbox" | "select" | "datetime";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
}

export function CrudPage(props: {
  title: string;
  endpoint: string;
  columns: Column[];
  fields?: FieldDef[];
  readonly?: boolean;
  toolbar?: React.ReactNode;
  statusFilter?: string[];
  extra?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const startCreate = () => {
    setEditing(null);
    setForm(Object.fromEntries((props.fields ?? []).map((f) => [f.key, f.type === "checkbox" ? false : ""])));
    setError("");
    setOpen(true);
  };
  const startEdit = (row: Row) => {
    setEditing(row);
    setForm(
      Object.fromEntries(
        (props.fields ?? []).map((f) => [
          f.key,
          f.type === "datetime" && row[f.key] ? new Date(row[f.key]).toISOString().slice(0, 16) : row[f.key] ?? (f.type === "checkbox" ? false : ""),
        ])
      )
    );
    setError("");
    setOpen(true);
  };

  const save = async () => {
    setError("");
    try {
      const payload: Row = {};
      for (const f of props.fields ?? []) {
        let v = form[f.key];
        if (f.type === "number") v = v === "" || v == null ? null : Number(v);
        if (f.type === "datetime") v = v ? new Date(v).toISOString() : null;
        if (v === "" && !f.required) v = f.type === "text" || f.type === "textarea" ? "" : v;
        payload[f.key] = v;
      }
      if (editing) await api(`${props.endpoint}/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api(props.endpoint, { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{props.title}</h1>
      </div>
      <AdminTable
        endpoint={props.endpoint}
        columns={props.columns}
        title={props.title}
        statusFilter={props.statusFilter}
        extra={props.extra}
        reloadKey={reloadKey}
        onEdit={props.readonly || !props.fields ? undefined : startEdit}
        onDelete={
          props.readonly
            ? undefined
            : async (row) => {
                await api(`${props.endpoint}/${row.id}`, { method: "DELETE" });
              }
        }
        toolbar={
          <>
            {props.toolbar}
            {!props.readonly && props.fields && (
              <button className="btn-primary !py-2" onClick={startCreate}>+ Создать</button>
            )}
          </>
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Редактирование" : "Создание"}>
        <div className="space-y-3">
          {(props.fields ?? []).map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {f.type === "textarea" ? (
                <textarea className="input resize-y" rows={4} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : f.type === "checkbox" ? (
                <input type="checkbox" className="mt-2 h-5 w-5" checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
              ) : f.type === "select" ? (
                <select className="input" value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </Field>
          ))}
          {error && <p role="alert" className="text-sm text-red-600">Ошибка: {error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-outline" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={save}>Сохранить</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
