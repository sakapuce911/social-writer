// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "sw_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Login page accessible
  if (pathname.startsWith("/login")) return NextResponse.next();

  // ✅ Next internals + static
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname === "/favicon.ico") return NextResponse.next();
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/)) return NextResponse.next();

  // ✅ Vérifie cookie de session (pour les pages seulement)
  const session = req.cookies.get(COOKIE_NAME)?.value;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// ✅ IMPORTANT : on exclut /api du middleware matcher
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
