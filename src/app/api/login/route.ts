// src/app/api/login/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username ?? "");
    const password = String(body?.password ?? "");

    const u = process.env.SW_LOGIN_USER ?? "";
    const p = process.env.SW_LOGIN_PASS ?? "";

    if (!u || !p) {
      return NextResponse.json(
        { error: "Configuration manquante: SW_LOGIN_USER / SW_LOGIN_PASS" },
        { status: 500 }
      );
    }

    if (username !== u || password !== p) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });

    // Cookie httpOnly (sécurisé)
    res.cookies.set("sw_auth", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
}
