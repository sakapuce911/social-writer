// src/app/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextUrl = useMemo(() => sp.get("next") || "/", [sp]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ important : cookie doit être stocké
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setErr(String(data?.error || "Identifiants incorrects."));
        return;
      }

      // ✅ redirection après cookie OK
      router.replace(nextUrl);
      router.refresh();
    } catch {
      setErr("Erreur réseau. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "radial-gradient(circle at 20% 10%, rgba(124,92,255,0.18), transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,176,102,0.18), transparent 50%), radial-gradient(circle at 50% 80%, rgba(255,77,109,0.14), transparent 50%), #fff" }}>
      <form onSubmit={onSubmit} style={{ width: "min(520px, 100%)", background: "rgba(255,255,255,0.85)", border: "3px solid rgba(17,17,17,0.12)", borderRadius: 22, padding: 22, boxShadow: "0 18px 0 rgba(17,17,17,0.08)", backdropFilter: "blur(10px)" }}>
        <div style={{ fontSize: 28, fontWeight: 950, marginBottom: 4 }}>Connexion</div>
        <div style={{ color: "rgba(17,17,17,0.55)", fontWeight: 800, marginBottom: 16 }}>Accès réservé à SocialWriter</div>

        {err && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 14, border: "3px solid rgba(255,77,109,0.30)", background: "rgba(255,77,109,0.12)", fontWeight: 900 }}>
            {err}
          </div>
        )}

        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <div style={{ fontWeight: 900 }}>Username</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
            autoComplete="username"
            style={{ padding: 12, borderRadius: 14, border: "2px solid rgba(17,17,17,0.18)" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
          <div style={{ fontWeight: 900 }}>Mot de passe</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              autoComplete="current-password"
              style={{ padding: 12, borderRadius: 14, border: "2px solid rgba(17,17,17,0.18)" }}
            />
            <button type="button" onClick={() => setShow((v) => !v)} style={{ width: 44, borderRadius: 14, border: "2px solid rgba(17,17,17,0.18)", background: "rgba(255,255,255,0.9)", fontWeight: 900 }}>
              👀
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 12, borderRadius: 14, border: "2px solid rgba(124,92,255,0.35)", background: "rgba(124,92,255,0.18)", fontWeight: 950 }}
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(17,17,17,0.55)", fontWeight: 800 }}>
          Astuce : si tu arrives ici après un logout, c’est normal.
        </div>
      </form>
    </div>
  );
}
