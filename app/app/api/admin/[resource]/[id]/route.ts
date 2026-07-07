import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, forbidden, badRequest, notFound } from "@/lib/auth";
import { RESOURCES, upsertQuestion, userAction } from "@/lib/admin";

function guard(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user || user.role !== "admin") return null;
  return user;
}

// PUT /api/admin/[resource]/[id] — update
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  if (!guard(req)) return forbidden();
  const { resource, id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("bad_json");

  if (resource === "questions") {
    return upsertQuestion(body, id);
  }

  if (resource === "users") {
    const admin = guard(req)!;
    return userAction(id, body, admin.id);
  }

  const cfg = RESOURCES[resource];
  if (!cfg || cfg.readonly) return notFound();

  const cols = cfg.fields.filter((f) => body[f] !== undefined);
  if (cols.length === 0) return badRequest("empty");
  const result = db()
    .prepare(`UPDATE ${cfg.table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .run(...cols.map((c) => body[c]), id);
  if (result.changes === 0) return notFound();
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/[resource]/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string; id: string }> }
) {
  if (!guard(req)) return forbidden();
  const { resource, id } = await ctx.params;

  const table =
    resource === "questions" ? "questions" : RESOURCES[resource]?.readonly ? null : RESOURCES[resource]?.table;
  if (!table) return notFound();

  const result = db().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (result.changes === 0) return notFound();
  return NextResponse.json({ ok: true });
}
