// src/app/api/login/route.ts
import { NextResponse } from "next/server";

const COOKIE_NAME = "sw_session";

export async function POST(req: Request) {
  const USERNAME = process.env.ADMIN_USERNAME || "admin";
  const PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "").trim();

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Champs manquants." }, { status: 400 });
  }

  if (username !== USERNAME || password !== PASSWORD) {
    return NextResponse.json({ ok: false, error: "Identifiants incorrects." }, { status: 401 });
  }

  // ✅ Génère un token simple (suffisant pour login admin)
  const token = Buffer.from(`${username}:${Date.now()}`).toString("base64url");

  const res = NextResponse.json({ ok: true });

  // ✅ IMPORTANT : secure = true seulement en prod (sinon localhost ne garde pas le cookie)
  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  });

  return res;
}
