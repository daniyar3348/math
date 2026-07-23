import { NextRequest, NextResponse } from "next/server";

// Assigns an anonymous device id (cookie "did") so progress persists per
// device without requiring login. Runs on page navigations.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get("did")?.value) {
    res.cookies.set("did", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
    });
  }
  return res;
}

export const config = {
  // all pages except static assets / api (api sets its own fallback)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
