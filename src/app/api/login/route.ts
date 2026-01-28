// src/app/api/login/route.ts
import { NextResponse } from "next/server";

const COOKIE_NAME = "sw_session";

type User = {
  username: string;
  password: string;
};

function parseUsers(): User[] {
  const raw = process.env.SW_LOGIN_USERS;

  if (!raw) {
    throw new Error("SW_LOGIN_USERS manquant dans les variables d'environnement");
  }

  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [username, password] = pair.split(":");
      return {
        username: username?.trim(),
        password: password?.trim(),
      };
    })
    .filter((u) => u.username && u.password);
}

export async function POST(req: Request) {
  const users = parseUsers();

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "").trim();

  if (!username || !password) {
    return NextResponse.json(
      { ok: false, error: "Champs manquants." },
      { status: 400 }
    );
  }

  const isValid = users.some(
    (u) => u.username === username && u.password === password
  );

  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: "Identifiants incorrects." },
      { status: 401 }
    );
  }

  const token = Buffer.from(`${username}:${Date.now()}`).toString("base64url");
  const res = NextResponse.json({ ok: true });

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
