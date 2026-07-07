"use client";

// Users management: role, password reset, XP adjustment, manual course
// grant/revoke (e.g. after a manual Kaspi transfer).

import { useEffect, useState, useCallback } from "react";
import { api, put } from "@/lib/api";
import { AdminSection, DangerBtn } from "@/components/admin";
import { Spinner } from "@/components/ui";

interface UserRow {
  id: string;
  name: string;
  email: string;
  region: string;
  grade: number | null;
  role: string;
  xp: number;
  created_at: number;
  enrolled: string | null; // comma-separated course ids
}
interface CourseRow {
  id: string;
  title_ru: string;
  cover: string;
  price_kzt: number;
}

export default function AdminUsers() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [xpDelta, setXpDelta] = useState("");
  const [grantCourse, setGrantCourse] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<{ rows: UserRow[] }>("/api/admin/users").then((d) => {
      setRows(d.rows);
      setSelected((prev) => d.rows.find((r) => r.id === prev?.id) ?? prev);
    });
    api<{ rows: CourseRow[] }>("/api/admin/courses").then((d) => setCourses(d.rows));
  }, []);
  useEffect(load, [load]);

  if (!rows) return <Spinner />;

  const act = async (userId: string, body: Record<string, unknown>, okMsg: string) => {
    setMsg("");
    try {
      await put(`/api/admin/users/${userId}`, body);
      setMsg(`✅ ${okMsg}`);
      load();
    } catch (e) {
      setMsg(`⚠️ Ошибка: ${e instanceof Error ? e.message : "unknown"}`);
    }
  };

  const enrolledIds = (u: UserRow) => (u.enrolled ? u.enrolled.split(",") : []);
  const courseTitle = (id: string) =>
    courses.find((c) => c.id === id)?.title_ru ?? id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Ученики ({rows.length})</h1>

      {selected && (
        <AdminSection
          title={`Управление: ${selected.name}`}
          action={
            <button className="btn-ghost !py-1.5" onClick={() => { setSelected(null); setMsg(""); }}>
              ✕
            </button>
          }
        >
          {msg && <p className="mb-3 text-sm font-medium">{msg}</p>}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Role + password */}
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-500">Роль</span>
                <select
                  value={selected.role}
                  onChange={(e) =>
                    act(selected.id, { action: "role", role: e.target.value }, "Роль обновлена")
                  }
                  className="input mt-1"
                >
                  <option value="student">student</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500">Новый пароль</span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input"
                    placeholder="мин. 6 символов"
                  />
                  <button
                    className="btn-outline flex-none !py-2"
                    onClick={() => {
                      act(selected.id, { action: "password", password: newPassword }, "Пароль сброшен (сессии ученика завершены)");
                      setNewPassword("");
                    }}
                  >
                    Сбросить
                  </button>
                </div>
              </div>
              <button
                className="btn-ghost !py-1.5 text-xs"
                onClick={() =>
                  act(selected.id, { action: "clear_totp" }, "2FA сброшена")
                }
                title="Аварийный сброс, если потерян телефон с аутентификатором"
              >
                🔐 Сбросить 2FA
              </button>
            </div>

            {/* XP */}
            <div>
              <span className="text-xs font-semibold text-slate-500">
                XP (сейчас: ⚡ {selected.xp})
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  value={xpDelta}
                  onChange={(e) => setXpDelta(e.target.value)}
                  className="input"
                  placeholder="+50 или -20"
                />
                <button
                  className="btn-outline flex-none !py-2"
                  onClick={() => {
                    act(selected.id, { action: "xp", delta: Number(xpDelta) }, "XP обновлён");
                    setXpDelta("");
                  }}
                >
                  Начислить
                </button>
              </div>
            </div>

            {/* Courses */}
            <div>
              <span className="text-xs font-semibold text-slate-500">
                Доступ к курсам (ручная выдача)
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {enrolledIds(selected).map((cid) => (
                  <span key={cid} className="chip bg-emerald-100 text-emerald-700">
                    {courseTitle(cid)}
                    <button
                      onClick={() =>
                        act(selected.id, { action: "revoke", courseId: cid }, "Доступ отозван")
                      }
                      className="ml-1 font-bold hover:text-red-500"
                      title="Отозвать"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {enrolledIds(selected).length === 0 && (
                  <span className="text-xs text-slate-400">нет выданных курсов</span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <select
                  value={grantCourse}
                  onChange={(e) => setGrantCourse(e.target.value)}
                  className="input"
                >
                  <option value="">— выбери курс —</option>
                  {courses
                    .filter((c) => !enrolledIds(selected).includes(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cover} {c.title_ru}
                        {c.price_kzt > 0 ? ` (${c.price_kzt.toLocaleString("ru-RU")} ₸)` : " (бесплатный)"}
                      </option>
                    ))}
                </select>
                <button
                  className="btn-brand flex-none !py-2"
                  disabled={!grantCourse}
                  onClick={() => {
                    act(selected.id, { action: "grant", courseId: grantCourse }, "Курс выдан");
                    setGrantCourse("");
                  }}
                >
                  Выдать
                </button>
              </div>
            </div>
          </div>
        </AdminSection>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3">Имя</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Регион</th>
              <th className="px-4 py-3">Класс</th>
              <th className="px-4 py-3">XP</th>
              <th className="px-4 py-3">Курсы</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((u) => (
              <tr key={u.id} className={selected?.id === u.id ? "bg-indigo-50/50" : ""}>
                <td className="px-4 py-2.5 font-semibold text-slate-800">{u.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                <td className="px-4 py-2.5 text-slate-500">{u.region}</td>
                <td className="px-4 py-2.5 text-slate-500">{u.grade ?? "—"}</td>
                <td className="px-4 py-2.5 font-semibold text-amber-600">⚡ {u.xp}</td>
                <td className="px-4 py-2.5 text-slate-500">{enrolledIds(u).length}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`chip ${
                      u.role === "admin"
                        ? "bg-violet-100 text-violet-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => { setSelected(u); setMsg(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="btn-outline !px-3 !py-1.5 text-xs"
                  >
                    Управлять
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
