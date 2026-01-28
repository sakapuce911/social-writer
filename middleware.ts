// middleware.ts (RACINE du projet)

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * ✅ Garde simple :
 * - Si l'utilisateur n'a pas le cookie "sw_auth", on le redirige vers /login
 * - On laisse passer : /login, /api/login, /api/logout, /_next, assets, favicon, etc.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Autoriser les fichiers statiques et Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/logo-socialwriter") || // tes assets publics (svg/png)
    pathname.startsWith("/icons") ||
    pathname.startsWith("/images")
  ) {
    return NextResponse.next();
  }

  // ✅ Autoriser la page login + les endpoints auth
  if (pathname === "/login" || pathname.startsWith("/api/login") || pathname.startsWith("/api/logout")) {
    return NextResponse.next();
  }

  // ✅ Vérif cookie de session
  const token = req.cookies.get("sw_auth")?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
