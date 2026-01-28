// src/app/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();

  const nextPath = useMemo(() => {
    const n = search.get("next");
    return n && n.startsWith("/") ? n : "/";
  }, [search]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(data?.error || "Connexion impossible"));
      }

      router.replace(nextPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 18,
        background: "linear-gradient(135deg, rgba(124,92,255,0.10), rgba(255,77,109,0.08), rgba(255,176,102,0.10))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 22,
          border: "3px solid rgba(17,17,17,0.12)",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 14px 0 rgba(17,17,17,0.08)",
          padding: 18,
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 22 }}>Connexion</div>
        <div style={{ marginTop: 6, color: "rgba(17,17,17,0.65)", fontWeight: 800 }}>
          Accès réservé • SocialWriter
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900 }}>Utilisateur</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: admin"
              autoComplete="username"
              style={{
                padding: "12px 12px",
                borderRadius: 14,
                border: "3px solid rgba(17,17,17,0.12)",
                outline: "none",
                fontWeight: 800,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900 }}>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                padding: "12px 12px",
                borderRadius: 14,
                border: "3px solid rgba(17,17,17,0.12)",
                outline: "none",
                fontWeight: 800,
              }}
            />
          </label>

          {error && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "3px solid rgba(255,77,109,0.30)",
                background: "rgba(255,77,109,0.10)",
                fontWeight: 900,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            style={{
              padding: "12px 14px",
              borderRadius: 16,
              border: "3px solid rgba(17,17,17,0.12)",
              background: "rgba(124,92,255,0.16)",
              fontWeight: 950,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <div style={{ fontSize: 12, color: "rgba(17,17,17,0.60)", fontWeight: 800 }}>
            Astuce: change le mot de passe dans <code>.env.local</code>.
          </div>
        </form>
      </div>
    </div>
  );
}
