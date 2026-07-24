// Edge middleware: локальная маршрутизация /kk|/ru, security headers,
// Origin-проверка мутаций (CSRF-защита в дополнение к SameSite-cookies).
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/kk", "/ru"];
const PASSTHROUGH = ["/admin", "/api", "/_next", "/favicon", "/icon", "/uploads", "/verify"];

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      // Next.js runtime использует inline-скрипты; сторонние источники запрещены
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF: мутации API принимаем только со своего origin (если Origin прислан)
  if (pathname.startsWith("/api") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      const self = req.nextUrl.origin;
      if (origin !== self) {
        return securityHeaders(NextResponse.json({ error: "bad_origin" }, { status: 403 }));
      }
    }
  }

  const isPassthrough = PASSTHROUGH.some((p) => pathname.startsWith(p));
  const hasLocale = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isPassthrough && !hasLocale) {
    const cookieLocale = req.cookies.get("bh_locale")?.value;
    const locale = cookieLocale === "ru" ? "ru" : "kk";
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return securityHeaders(NextResponse.redirect(url));
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
