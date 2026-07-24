"use client";

// Пользователи: список, создание, роли, блокировка, сброс пароля,
// привязка родителя, добавление в группу (§12).
import { Suspense, useState } from "react";
import { AdminTable, api, Field, type Row } from "@/components/admin/kit";
import { Modal } from "@/components/ui";

function Inner() {
  const [manage, setManage] = useState<Row | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // manage form
  const [roles, setRoles] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [parentId, setParentId] = useState("");
  const [cohortId, setCohortId] = useState("");

  // create form
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cRoles, setCRoles] = useState<string[]>(["TEACHER"]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!manage) return;
    setMsg("");
    try {
      await api("/api/admin/users/actions", {
        method: "POST",
        body: JSON.stringify({ targetId: manage.id, action, ...extra }),
      });
      setMsg("✅ Готово");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Ошибка"}`);
    }
  };

  const create = async () => {
    setMsg("");
    try {
      await api("/api/admin/users/create", {
        method: "POST",
        body: JSON.stringify({
          email: cEmail || undefined,
          phone: cPhone || undefined,
          password: cPassword || undefined,
          firstName: cFirst,
          lastName: cLast,
          roles: cRoles,
        }),
      });
      setCreateOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : "Ошибка"}`);
    }
  };

  const toggle = (arr: string[], set: (v: string[]) => void, r: string) =>
    set(arr.includes(r) ? arr.filter((x) => x !== r) : [...arr, r]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Пользователи</h1>
      <AdminTable
        endpoint="/api/admin/users"
        title="Пользователи"
        reloadKey={reloadKey}
        columns={[
          { key: "profile", title: "Имя", render: (r) => `${r.profile?.firstName ?? ""} ${r.profile?.lastName ?? ""}` },
          { key: "email", title: "Email", sortable: true },
          { key: "phone", title: "Телефон" },
          { key: "memberships", title: "Роли", render: (r) => (r.memberships as Row[])?.map((m) => m.role?.name).join(", ") },
          {
            key: "status",
            title: "Статус",
            render: (r) => <span className={`chip ${r.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{r.status}</span>,
          },
          { key: "lastLoginAt", title: "Вход", render: (r) => (r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString("ru-RU") : "—") },
          {
            key: "id",
            title: "",
            render: (r) => (
              <button
                className="btn-outline !px-3 !py-1.5 text-xs"
                onClick={() => {
                  setManage(r);
                  setRoles(((r.memberships as Row[]) ?? []).map((m) => m.role?.name));
                  setMsg("");
                }}
              >
                Управлять
              </button>
            ),
          },
        ]}
        toolbar={<button className="btn-primary !py-2" onClick={() => { setCreateOpen(true); setMsg(""); }}>+ Пользователь</button>}
      />

      {/* Управление */}
      <Modal open={!!manage} onClose={() => setManage(null)} title={`Управление: ${manage?.profile?.firstName ?? ""} ${manage?.profile?.lastName ?? ""}`}>
        {msg && <p className="mb-3 text-sm font-semibold">{msg}</p>}
        <div className="space-y-4 text-sm">
          <div>
            <p className="label">Роли</p>
            <div className="flex flex-wrap gap-2">
              {["ADMIN", "TEACHER", "STUDENT", "PARENT"].map((r) => (
                <label key={r} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(roles, setRoles, r)} />
                  {r}
                </label>
              ))}
              <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => act("set_roles", { roles })}>Сохранить роли</button>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Новый пароль (мин. 8)"><input className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
            <button className="btn-outline" onClick={() => act("reset_password", { password: newPassword })}>Сбросить</button>
          </div>
          <div className="flex items-end gap-2">
            <Field label="ID родителя (привязать к ученику)"><input className="input" value={parentId} onChange={(e) => setParentId(e.target.value)} /></Field>
            <button className="btn-outline" onClick={() => act("link_parent", { parentUserId: parentId })}>Привязать</button>
          </div>
          <div className="flex items-end gap-2">
            <Field label="ID группы"><input className="input" value={cohortId} onChange={(e) => setCohortId(e.target.value)} /></Field>
            <button className="btn-outline" onClick={() => act("add_to_cohort", { cohortId })}>В группу</button>
          </div>
          <div className="flex gap-2 border-t border-slate-100 pt-3">
            {manage?.status === "ACTIVE" ? (
              <button className="btn-outline !border-red-300 !text-red-600" onClick={() => act("block")}>Заблокировать</button>
            ) : (
              <button className="btn-outline" onClick={() => act("unblock")}>Разблокировать</button>
            )}
          </div>
        </div>
      </Modal>

      {/* Создание */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новый пользователь">
        {msg && <p className="mb-3 text-sm font-semibold">{msg}</p>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Имя"><input className="input" value={cFirst} onChange={(e) => setCFirst(e.target.value)} /></Field>
            <Field label="Фамилия"><input className="input" value={cLast} onChange={(e) => setCLast(e.target.value)} /></Field>
          </div>
          <Field label="Email (для сотрудников/родителей)"><input className="input" value={cEmail} onChange={(e) => setCEmail(e.target.value)} /></Field>
          <Field label="Пароль (мин. 8, если указан email)"><input className="input" value={cPassword} onChange={(e) => setCPassword(e.target.value)} /></Field>
          <Field label="Телефон (+7…, для учеников)"><input className="input" value={cPhone} onChange={(e) => setCPhone(e.target.value)} /></Field>
          <div>
            <p className="label">Роли</p>
            <div className="flex flex-wrap gap-2">
              {["ADMIN", "TEACHER", "STUDENT", "PARENT"].map((r) => (
                <label key={r} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={cRoles.includes(r)} onChange={() => toggle(cRoles, setCRoles, r)} />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-outline" onClick={() => setCreateOpen(false)}>Отмена</button>
            <button className="btn-primary" onClick={create}>Создать</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-40 w-full" />}><Inner /></Suspense>;
}
