// Session auth helpers for route handlers.
// Sessions are DB rows + httpOnly cookie "sid". No external deps.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db, type Row } from "./db";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const COOKIE = "sid";

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  // Opportunistic GC: expired sessions must not accumulate forever.
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  db()
    .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)")
    .run(token, userId, now, now + SESSION_TTL_MS);
  return token;
}

export function destroySession(token: string) {
  db().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getAuthUser(req: NextRequest): Row | null {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now()) as Row | undefined;
  return row ?? null;
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production", // behind Caddy HTTPS in prod
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
