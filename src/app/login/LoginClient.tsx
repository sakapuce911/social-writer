// src/app/login/LoginClient.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const sp = useSearchParams();

  const initialError = useMemo(() => {
    const v = sp.get("error");
    if (!v) return "";
    if (v === "auth") return "Identifiants incorrects.";
    if (v === "session") return "Session expirée. Merci de te reconnecter.";
    return decodeURIComponent(v);
  }, [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(String(data?.error || "Connexion impossible."));
        return;
      }

      // ✅ connecté -> retour sur home
      window.location.href = "/";
    } catch {
      setError("Erreur réseau. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 18,
        background:
          "radial-gradient(900px 480px at 20% 10%, rgba(124,92,255,0.18), transparent 60%), radial-gradient(900px 480px at 90% 20%, rgba(255,77,109,0.14), transparent 55%), radial-gradient(900px 480px at 50% 90%, rgba(255,176,102,0.16), transparent 60%), rgba(246,241,234,1)",
      }}
    >
      <div
        style={{
          width: "min(480px, 100%)",
          borderRadius: 22,
          border: "3px solid rgba(17,17,17,0.12)",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 18px 0 rgba(17,17,17,0.08)",
          padding: 18,
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
          <div style={{ fontWeight: 950, fontSize: 22 }}>Connexion</div>
          <div style={{ color: "rgba(17,17,17,0.65)", fontWeight: 800 }}>
            Accès réservé à SocialWriter
          </div>
        </div>

        {error && (
          <div
            style={{
              borderRadius: 14,
              border: "3px solid rgba(255,77,109,0.25)",
              background: "rgba(255,77,109,0.10)",
              padding: 12,
              fontWeight: 900,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900 }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
              placeholder="ex: mirana@email.com"
              style={{
                width: "100%",
                borderRadius: 14,
                border: "3px solid rgba(17,17,17,0.12)",
                padding: "12px 12px",
                fontWeight: 850,
                outline: "none",
                background: "rgba(255,255,255,0.92)",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900 }}>Mot de passe</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                style={{
                  width: "100%",
                  borderRadius: 14,
                  border: "3px solid rgba(17,17,17,0.12)",
                  padding: "12px 12px",
                  fontWeight: 850,
                  outline: "none",
                  background: "rgba(255,255,255,0.92)",
                }}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                style={{
                  borderRadius: 14,
                  border: "3px solid rgba(17,17,17,0.12)",
                  padding: "10px 12px",
                  fontWeight: 950,
                  background: "rgba(255,255,255,0.9)",
                  cursor: "pointer",
                }}
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {show ? "🙈" : "👀"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              borderRadius: 16,
              border: "3px solid rgba(17,17,17,0.12)",
              padding: "12px 14px",
              fontWeight: 950,
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(17,17,17,0.06)" : "rgba(124,92,255,0.18)",
            }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>
            Astuce : si tu arrives ici après un logout, c’est normal.
          </div>
        </form>
      </div>
    </div>
  );
}
