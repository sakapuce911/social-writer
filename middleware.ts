// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "sw_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Autoriser accès libre
  const PUBLIC_PATHS = [
    "/login",
    "/api/login",
    "/api/logout",
    "/_next",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ];

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // ✅ Cookie session
  const token = req.cookies.get(COOKIE_NAME)?.value;

  // Pas connecté → redirige vers login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
