// src/app/api/logout/route.ts
import { NextResponse } from "next/server";

const COOKIE_NAME = "sw_session";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return res;
}
