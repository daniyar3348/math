import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const COOKIE = "did";

// Reads the device id; creates one if absent (fallback for API-first calls).
// Returns the id plus a flag so the caller can set the cookie on the response.
export function getDevice(req: NextRequest): { id: string; isNew: boolean } {
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) return { id: existing, isNew: false };
  return { id: randomUUID(), isNew: true };
}

export function attachDevice(res: NextResponse, id: string, isNew: boolean) {
  if (isNew) {
    res.cookies.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  }
  return res;
}
