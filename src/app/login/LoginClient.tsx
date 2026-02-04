// src/app/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextUrl = useMemo(() => sp.get("next") || "/", [sp]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ micro UX: focus auto
  const userRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    userRef.current?.focus();
  }, []);

  // ✅ animation erreur (shake)
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (!err) return;
    setShake(true);
    const t = window.setTimeout(() => setShake(false), 520);
    return () => window.clearTimeout(t);
  }, [err]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setErr(String(data?.error || "Identifiants incorrects."));
        return;
      }

      router.replace(nextUrl);
      router.refresh();
    } catch {
      setErr("Erreur réseau. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = username.trim().length > 0 && password.trim().length > 0 && !loading;

  return (
    <div style={wrap}>
      {/* ✅ arrière-plan animé */}
      <div style={bgLayer} aria-hidden="true">
        <div style={{ ...blob, ...blobA }} />
        <div style={{ ...blob, ...blobB }} />
        <div style={{ ...blob, ...blobC }} />
        <div style={grain} />
      </div>

      <form onSubmit={onSubmit} style={{ ...card, ...(shake ? cardShake : null) }}>
        {/* ✅ header */}
        <div style={topRow}>
          <div style={logoMark} aria-hidden="true">
            SW
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <div style={title}>Connexion</div>
            <div style={subtitle}>Accès réservé à SocialWriter</div>
          </div>
        </div>

        {/* ✅ micro décor */}
        <div style={sparkles} aria-hidden="true">
          <span style={{ ...spark, ...spark1 }} />
          <span style={{ ...spark, ...spark2 }} />
          <span style={{ ...spark, ...spark3 }} />
        </div>

        {err && (
          <div style={errBox} role="status" aria-live="polite">
            <span style={errDot} aria-hidden="true" />
            <div style={{ lineHeight: 1.2 }}>{err}</div>
          </div>
        )}

        {/* ✅ username */}
        <label style={field}>
          <div style={labelTxt}>Username</div>
          <div className="swFocusShell" style={inputShell}>
            <span style={icon} aria-hidden="true">
              @
            </span>
            <input
              ref={userRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="username"
              style={input}
            />
          </div>
        </label>

        {/* ✅ password */}
        <label style={field}>
          <div style={labelTxt}>Mot de passe</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <div className="swFocusShell" style={inputShell}>
              <span style={icon} aria-hidden="true">
                🔒
              </span>

              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                style={input}
              />
            </div>

            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              style={{
                ...eyeBtn,
                ...(show ? eyeBtnOn : null),
              }}
              aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              title={show ? "Masquer" : "Afficher"}
            >
              <span style={{ transform: show ? "translateY(-0.5px)" : "translateY(0px)" }}>👀</span>
            </button>
          </div>
        </label>

        {/* ✅ submit */}
        <button type="submit" disabled={!canSubmit} style={{ ...submit, ...(canSubmit ? null : submitDisabled) }}>
          {loading ? (
            <span style={btnInner}>
              <span style={dots} aria-hidden="true">
                <span style={{ ...dot, animationDelay: "0ms" }} />
                <span style={{ ...dot, animationDelay: "120ms" }} />
                <span style={{ ...dot, animationDelay: "240ms" }} />
              </span>
              Connexion…
            </span>
          ) : (
            <span style={btnInner}>
              Se connecter
              <span style={btnArrow} aria-hidden="true">
                ↗
              </span>
            </span>
          )}
        </button>

        <div style={hint}>
          Astuce : si tu arrives ici après un logout, c’est normal.
          <span style={{ marginLeft: 6, opacity: 0.75 }}>✨</span>
        </div>

        {/* ✅ styles / keyframes local */}
        <style>{css}</style>
      </form>
    </div>
  );
}

/* =========================
   Inline styles (no deps)
========================= */

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  position: "relative",
  overflow: "hidden",
  background: "#0b0b10",
};

const bgLayer: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

const blob: React.CSSProperties = {
  position: "absolute",
  width: 540,
  height: 540,
  borderRadius: 999,
  filter: "blur(26px)",
  opacity: 0.75,
  animation: "swFloat 9.5s ease-in-out infinite",
};

const blobA: React.CSSProperties = {
  left: "-160px",
  top: "-160px",
  background: "radial-gradient(circle at 30% 30%, rgba(124,92,255,0.85), rgba(124,92,255,0.0) 60%)",
};

const blobB: React.CSSProperties = {
  right: "-180px",
  top: "-120px",
  animationDelay: "900ms",
  background: "radial-gradient(circle at 40% 40%, rgba(255,176,102,0.80), rgba(255,176,102,0.0) 62%)",
};

const blobC: React.CSSProperties = {
  left: "20%",
  bottom: "-220px",
  width: 660,
  height: 660,
  animationDelay: "1600ms",
  background: "radial-gradient(circle at 50% 50%, rgba(255,77,109,0.75), rgba(255,77,109,0.0) 62%)",
};

const grain: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E\")",
  opacity: 0.12,
  mixBlendMode: "overlay",
};

const card: React.CSSProperties = {
  width: "min(520px, 100%)",
  position: "relative",
  borderRadius: 24,
  padding: 22,
  background: "rgba(17,17,24,0.62)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 28px 70px rgba(0,0,0,0.55)",
  backdropFilter: "blur(14px)",
  transform: "translateY(0px)",
  animation: "swEnter 520ms cubic-bezier(.2,.9,.2,1) both",
};

const cardShake: React.CSSProperties = {
  animation: "swShake 520ms ease both",
};

const topRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const logoMark: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  fontWeight: 950,
  letterSpacing: "-0.6px",
  color: "rgba(255,255,255,0.92)",
  background: "linear-gradient(135deg, rgba(124,92,255,0.95), rgba(98,181,255,0.92))",
  boxShadow: "0 14px 34px rgba(124,92,255,0.25)",
  border: "1px solid rgba(255,255,255,0.22)",
};

const title: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 950,
  color: "rgba(255,255,255,0.96)",
  letterSpacing: "-0.4px",
};

const subtitle: React.CSSProperties = {
  color: "rgba(255,255,255,0.62)",
  fontWeight: 800,
  fontSize: 13,
};

const sparkles: React.CSSProperties = {
  position: "absolute",
  right: 14,
  top: 14,
  width: 90,
  height: 60,
  opacity: 0.9,
};

const spark: React.CSSProperties = {
  position: "absolute",
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.85)",
  filter: "blur(0.2px)",
  animation: "swSpark 2.6s ease-in-out infinite",
};

const spark1: React.CSSProperties = { right: 10, top: 6, opacity: 0.7 };
const spark2: React.CSSProperties = { right: 42, top: 22, width: 6, height: 6, opacity: 0.65, animationDelay: "360ms" };
const spark3: React.CSSProperties = { right: 22, top: 40, width: 8, height: 8, opacity: 0.55, animationDelay: "760ms" };

const errBox: React.CSSProperties = {
  marginTop: 6,
  marginBottom: 14,
  padding: "12px 12px",
  borderRadius: 16,
  border: "1px solid rgba(255,77,109,0.35)",
  background: "linear-gradient(180deg, rgba(255,77,109,0.16), rgba(255,77,109,0.08))",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 900,
  display: "flex",
  gap: 10,
  alignItems: "center",
  boxShadow: "0 16px 40px rgba(255,77,109,0.10)",
  animation: "swPulse 520ms ease both",
};

const errDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "rgba(255,77,109,0.95)",
  boxShadow: "0 0 0 6px rgba(255,77,109,0.14)",
};

const field: React.CSSProperties = { display: "grid", gap: 7, marginBottom: 12 };

const labelTxt: React.CSSProperties = {
  fontWeight: 900,
  color: "rgba(255,255,255,0.86)",
  fontSize: 13,
};

const inputShell: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: 10,
  alignItems: "center",
  padding: "12px 12px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  transition: "transform 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease",
};

const icon: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  fontWeight: 950,
  color: "rgba(255,255,255,0.78)",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
};

const input: React.CSSProperties = {
  width: "100%",
  outline: "none",
  border: 0,
  background: "transparent",
  color: "rgba(255,255,255,0.92)",
  fontSize: 14,
  fontWeight: 800,
};

const eyeBtn: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 900,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  transition: "transform 120ms ease, background 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
  willChange: "transform",
};

const eyeBtnOn: React.CSSProperties = {
  background: "rgba(98,181,255,0.12)",
  borderColor: "rgba(98,181,255,0.30)",
  boxShadow: "0 16px 34px rgba(98,181,255,0.12)",
};

const submit: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "linear-gradient(135deg, rgba(124,92,255,0.95), rgba(98,181,255,0.92))",
  color: "rgba(255,255,255,0.96)",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 18px 46px rgba(124,92,255,0.22)",
  transition: "transform 120ms ease, filter 140ms ease, opacity 140ms ease",
  willChange: "transform",
};

const submitDisabled: React.CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.55,
  filter: "grayscale(0.1)",
};

const btnInner: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const btnArrow: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.16)",
};

const dots: React.CSSProperties = { display: "inline-flex", gap: 5, alignItems: "center" };

const dot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.92)",
  animation: "swDot 720ms ease-in-out infinite",
};

const hint: React.CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  color: "rgba(255,255,255,0.62)",
  fontWeight: 800,
};

/* =========================
   CSS keyframes + focus UX
========================= */
const css = `
@keyframes swEnter{
  from{ transform: translateY(10px); opacity: 0; }
  to{ transform: translateY(0px); opacity: 1; }
}
@keyframes swFloat{
  0%,100%{ transform: translate(0px,0px) scale(1); }
  50%{ transform: translate(10px,14px) scale(1.03); }
}
@keyframes swSpark{
  0%,100%{ transform: translateY(0px) scale(1); opacity: .65; }
  50%{ transform: translateY(-2px) scale(1.06); opacity: .95; }
}
@keyframes swDot{
  0%,100%{ transform: translateY(0px); opacity: .55; }
  50%{ transform: translateY(-2px); opacity: 1; }
}
@keyframes swShake{
  0%{ transform: translateX(0px); }
  12%{ transform: translateX(-6px); }
  25%{ transform: translateX(6px); }
  38%{ transform: translateX(-5px); }
  50%{ transform: translateX(5px); }
  62%{ transform: translateX(-3px); }
  74%{ transform: translateX(3px); }
  100%{ transform: translateX(0px); }
}
@keyframes swPulse{
  0%{ transform: scale(.98); opacity: .8; }
  100%{ transform: scale(1); opacity: 1; }
}

/* ✅ Focus glow ROBUSTE: cible .swFocusShell (et pas les styles inline) */
.swFocusShell:focus-within{
  border-color: rgba(98,181,255,0.38) !important;
  background: rgba(98,181,255,0.08) !important;
  box-shadow: 0 0 0 6px rgba(98,181,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08) !important;
  transform: translateY(-0.5px);
}

/* Hover / active micro interactions */
button:hover{ filter: brightness(1.03); }
button:active{ transform: translateY(0px) scale(.99); }
`;
