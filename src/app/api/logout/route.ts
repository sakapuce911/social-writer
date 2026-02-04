// src/app/api/logout/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "sw_session";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  const isProd = process.env.NODE_ENV === "production";

  // ❌ Invalidation hard du cookie
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 0,
  });

  return res;
}
