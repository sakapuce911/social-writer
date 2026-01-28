// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "sw_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Laisser passer la page login + APIs auth
  if (pathname.startsWith("/login")) return NextResponse.next();
  if (pathname.startsWith("/api/login")) return NextResponse.next();
  if (pathname.startsWith("/api/logout")) return NextResponse.next();

  // ✅ Laisser passer Next internals + fichiers statiques
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname === "/favicon.ico") return NextResponse.next();
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/)) return NextResponse.next();

  // ✅ Vérifie cookie de session
  const session = req.cookies.get(COOKIE_NAME)?.value;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
