// src/app/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextUrl = useMemo(() => sp.get("next") || "/", [sp]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ focus auto
  const userRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    userRef.current?.focus();
  }, []);

  // ✅ shake erreur
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
    <div style={page}>
      <div className="swOuter" style={{ ...outerCard, ...(shake ? outerShake : null) }}>
        {/* LEFT (LinkedIn-like value panel) */}
        <aside className="swLeft" style={leftPanel} aria-hidden="true">
          <div style={leftInner}>
            {/* subtle layers */}
            <div style={dotsLayer} />
            <div style={glow1} />
            <div style={glow2} />

            {/* clouds (very subtle) */}
            <div style={cloudA} />
            <div style={cloudB} />

            <div style={leftCenter}>
              {/* Value card: fake LinkedIn post preview (translucent) */}
              <div style={liCard}>
                <div style={liTop}>
                  <div style={liAvatar} />
                  <div style={liMeta}>
                    <div style={liNameRow}>
                      <div style={liName}>Vous</div>
                      <div style={liDot} />
                      <div style={liTime}>Maintenant</div>
                    </div>
                    <div style={liSub}>Créateur • SocialWriter</div>
                  </div>

                  <div style={scorePill} title="Exemple de score">
                    <span style={scoreDot} />
                    Score 86/100
                  </div>
                </div>

                <div style={liBody}>
                  <div style={{ ...liLine, width: "86%" }} />
                  <div style={{ ...liLine, width: "92%" }} />
                  <div style={{ ...liLine, width: "74%" }} />
                  <div style={{ height: 10 }} />
                  <div style={liListRow}>
                    <span style={liBullet}>✓</span>
                    <div style={{ ...liLine, width: "62%" }} />
                  </div>
                  <div style={liListRow}>
                    <span style={liBullet}>✓</span>
                    <div style={{ ...liLine, width: "58%" }} />
                  </div>
                  <div style={liListRow}>
                    <span style={liBullet}>✓</span>
                    <div style={{ ...liLine, width: "54%" }} />
                  </div>
                </div>

                <div style={liFooter}>
                  <div style={liChip}>#hook</div>
                  <div style={liChip}>#audit</div>
                  <div style={liChip}>#hashtags</div>
                </div>
              </div>

              {/* 3 bullets (proof of value) */}
              <div style={valueGrid}>
                <div style={valueItem}>
                  <div style={valueIcon}>⚡</div>
                  <div style={valueText}>
                    <div style={valueTitle}>Hook 150–180</div>
                    <div style={valueSub}>Stop scrolling, mais humain.</div>
                  </div>
                </div>

                <div style={valueItem}>
                  <div style={valueIcon}>📈</div>
                  <div style={valueText}>
                    <div style={valueTitle}>Audit temps réel</div>
                    <div style={valueSub}>Lisibilité • question • score.</div>
                  </div>
                </div>

                <div style={valueItem}>
                  <div style={valueIcon}>🏷️</div>
                  <div style={valueText}>
                    <div style={valueTitle}>Hashtags propres</div>
                    <div style={valueSub}>3–5, niche, normalisés.</div>
                  </div>
                </div>
              </div>

              {/* existing caption (more integrated) */}
              <div style={leftCaption}>
                <div style={leftCaptionTitle}>Écris. Ajuste. Publie.</div>
                <div style={leftCaptionSub}>Un login simple, une expérience premium.</div>
              </div>
            </div>

            <div style={leftFooter}>
              <span style={leftFooterDot} />
              <span>© {new Date().getFullYear()} SocialWriter</span>
            </div>
          </div>
        </aside>

        {/* RIGHT (form) */}
        <main style={rightPanel}>
          <div style={rightInner}>
            <div style={brandTop}>
              {/* ✅ apple-touch-icon.png + LinkedIn badge */}
              <div style={logoBadge} aria-hidden="true">
                <Image
                  src="/apple-touch-icon.png"
                  alt="SocialWriter"
                  width={22}
                  height={22}
                  style={logoImg}
                  priority
                />
              </div>

              <div style={{ display: "grid", lineHeight: 1.05 }}>
                <div style={brandName}>SocialWriter</div>
                <div style={brandSmall}>Sign in</div>
              </div>
            </div>

            {err && (
              <div style={errBox} role="status" aria-live="polite">
                <span style={errDot} aria-hidden="true" />
                <div style={{ lineHeight: 1.25 }}>{err}</div>
              </div>
            )}

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 18, marginTop: 14 }}>
              {/* LOGIN */}
              <div style={lineField}>
                <div style={lineLabel}>LOGIN</div>
                <input
                  ref={userRef}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="meghan.tormund@gmail.com"
                  style={lineInput}
                  aria-label="Email"
                />
                <div style={lineRule} />
              </div>

              {/* PASSWORD */}
              <div style={lineField}>
                <div style={lineLabel}>PASSWORD</div>

                <div style={lineRow}>
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••••••••••"
                    style={{ ...lineInput, paddingRight: 44 }}
                    aria-label="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    style={eyeBtn}
                    aria-label={show ? "Hide password" : "Show password"}
                    title={show ? "Hide" : "Show"}
                  >
                    {show ? "🙈" : "👁️"}
                  </button>
                </div>

                <div style={lineRule} />
              </div>

              {/* Remember only */}
              <div style={rowSimple}>
                <label style={rememberRow}>
                  <input
                    type="checkbox"
                    style={checkbox}
                    onChange={() => {
                      /* UI only */
                    }}
                  />
                  <span style={rememberTxt}>Remember me</span>
                </label>
              </div>

              {/* CTA only */}
              <div style={ctaOnlyRow}>
                <button type="submit" disabled={!canSubmit} style={{ ...ctaBtn, ...(canSubmit ? null : ctaDisabled) }}>
                  <span style={ctaInner}>
                    {loading ? (
                      <>
                        <span style={dots} aria-hidden="true">
                          <span style={{ ...dot, animationDelay: "0ms" }} />
                          <span style={{ ...dot, animationDelay: "120ms" }} />
                          <span style={{ ...dot, animationDelay: "240ms" }} />
                        </span>
                        Sign in
                      </>
                    ) : (
                      <>
                        Sign in <span aria-hidden="true">→</span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </main>

        <style>{css}</style>
      </div>
    </div>
  );
}

/* =========================
   Styles — LinkedIn-like left panel “proof of value”
========================= */

const LINKEDIN_BLUE = "#0A66C2";

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#EAF1F7",
  display: "grid",
  placeItems: "center",
  padding: 22,
};

const outerCard: React.CSSProperties = {
  width: "min(1100px, 100%)",
  minHeight: 620,
  background: "#fff",
  borderRadius: 22,
  overflow: "hidden",
  display: "grid",
  gridTemplateColumns: "1.05fr 1fr",
  boxShadow: "0 22px 70px rgba(2,6,23,0.18)",
  border: "1px solid rgba(15,23,42,0.08)",
};

const outerShake: React.CSSProperties = {
  animation: "swShake 520ms ease both",
};

/* Left panel */
const leftPanel: React.CSSProperties = {
  background: LINKEDIN_BLUE,
  position: "relative",
};

const leftInner: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  padding: 26,
  display: "grid",
  gridTemplateRows: "1fr auto",
  overflow: "hidden",
};

const dotsLayer: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  opacity: 0.14,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
  pointerEvents: "none",
  mixBlendMode: "overlay",
};

const glow1: React.CSSProperties = {
  position: "absolute",
  width: 520,
  height: 520,
  left: -220,
  top: -260,
  borderRadius: 999,
  background: "radial-gradient(circle at 40% 40%, rgba(255,255,255,0.22), rgba(255,255,255,0) 65%)",
  filter: "blur(6px)",
  opacity: 0.9,
  pointerEvents: "none",
};

const glow2: React.CSSProperties = {
  position: "absolute",
  width: 700,
  height: 700,
  right: -360,
  bottom: -420,
  borderRadius: 999,
  background: "radial-gradient(circle at 40% 40%, rgba(0,0,0,0.16), rgba(0,0,0,0) 64%)",
  filter: "blur(10px)",
  opacity: 0.9,
  pointerEvents: "none",
};

const cloudA: React.CSSProperties = {
  position: "absolute",
  top: 56,
  left: 44,
  width: 110,
  height: 34,
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
};

const cloudB: React.CSSProperties = {
  position: "absolute",
  top: 92,
  right: 72,
  width: 140,
  height: 42,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
};

const leftCenter: React.CSSProperties = {
  alignSelf: "center",
  justifySelf: "center",
  width: "min(520px, 100%)",
  display: "grid",
  justifyItems: "center",
  gap: 18,
  paddingTop: 10,
};

/* Fake LinkedIn post card */
const liCard: React.CSSProperties = {
  width: "min(440px, 100%)",
  borderRadius: 18,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "0 18px 44px rgba(2,6,23,0.18)",
  overflow: "hidden",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

const liTop: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  gap: 12,
  alignItems: "center",
  padding: "14px 14px 10px",
};

const liAvatar: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  background: "rgba(255,255,255,0.35)",
  boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.20)",
};

const liMeta: React.CSSProperties = {
  display: "grid",
  gap: 3,
};

const liNameRow: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const liName: React.CSSProperties = {
  fontWeight: 950,
  color: "rgba(255,255,255,0.95)",
  fontSize: 13,
  letterSpacing: "-0.2px",
};

const liDot: React.CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: 999,
  background: "rgba(255,255,255,0.55)",
};

const liTime: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,0.70)",
};

const liSub: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 750,
  color: "rgba(255,255,255,0.70)",
};

const scorePill: React.CSSProperties = {
  height: 28,
  padding: "0 10px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 950,
  color: "rgba(255,255,255,0.95)",
  background: "rgba(0,0,0,0.14)",
  border: "1px solid rgba(255,255,255,0.16)",
};

const scoreDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "rgba(120,255,180,0.95)",
  boxShadow: "0 0 0 6px rgba(120,255,180,0.16)",
};

const liBody: React.CSSProperties = {
  padding: "0 14px 12px",
  display: "grid",
  gap: 8,
};

const liLine: React.CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.20)",
};

const liListRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "18px 1fr",
  alignItems: "center",
  gap: 8,
};

const liBullet: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.16)",
  color: "rgba(255,255,255,0.90)",
  fontSize: 12,
  fontWeight: 950,
};

const liFooter: React.CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "0 14px 14px",
  flexWrap: "wrap",
};

const liChip: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 850,
  color: "rgba(255,255,255,0.90)",
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.14)",
};

/* Value list */
const valueGrid: React.CSSProperties = {
  width: "min(440px, 100%)",
  display: "grid",
  gap: 10,
};

const valueItem: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px 1fr",
  gap: 10,
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.12)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};

const valueIcon: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "rgba(0,0,0,0.12)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "rgba(255,255,255,0.95)",
  fontSize: 16,
};

const valueText: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const valueTitle: React.CSSProperties = {
  fontWeight: 950,
  color: "rgba(255,255,255,0.95)",
  letterSpacing: "-0.2px",
  fontSize: 13,
};

const valueSub: React.CSSProperties = {
  fontWeight: 750,
  color: "rgba(255,255,255,0.72)",
  fontSize: 12,
};

/* Slogan */
const leftCaption: React.CSSProperties = {
  textAlign: "center",
  color: "rgba(255,255,255,0.92)",
  marginTop: 6,
};

const leftCaptionTitle: React.CSSProperties = {
  fontWeight: 950,
  letterSpacing: "-0.3px",
  fontSize: 18,
};

const leftCaptionSub: React.CSSProperties = {
  marginTop: 6,
  fontWeight: 750,
  fontSize: 12,
  color: "rgba(255,255,255,0.75)",
};

/* Footer */
const leftFooter: React.CSSProperties = {
  justifySelf: "start",
  alignSelf: "end",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  color: "rgba(255,255,255,0.70)",
  fontSize: 12,
  fontWeight: 750,
};

const leftFooterDot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  background: "rgba(255,255,255,0.70)",
  boxShadow: "0 0 0 6px rgba(255,255,255,0.10)",
};

/* Right panel */
const rightPanel: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: "34px 44px",
};

const rightInner: React.CSSProperties = {
  width: "min(420px, 100%)",
  display: "grid",
};

const brandTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 6,
};

const logoBadge: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  background: LINKEDIN_BLUE,
  display: "grid",
  placeItems: "center",
  boxShadow: "0 14px 34px rgba(10,102,194,0.24)",
};

const logoImg: React.CSSProperties = {
  filter: "brightness(0) invert(1)",
};

const brandName: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 950,
  color: "#0B1220",
};

const brandSmall: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  fontWeight: 750,
  color: "rgba(15,23,42,0.55)",
};

const errBox: React.CSSProperties = {
  marginTop: 12,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(220,38,38,0.20)",
  background: "rgba(220,38,38,0.06)",
  color: "rgba(127,29,29,0.95)",
  fontWeight: 850,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const errDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "rgba(220,38,38,0.85)",
  boxShadow: "0 0 0 6px rgba(220,38,38,0.12)",
};

const lineField: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gap: 8,
};

const lineLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 850,
  color: "rgba(15,23,42,0.40)",
  letterSpacing: "0.14em",
};

const lineRow: React.CSSProperties = {
  position: "relative",
};

const lineInput: React.CSSProperties = {
  width: "100%",
  outline: "none",
  border: 0,
  background: "transparent",
  color: "#0F172A",
  fontSize: 13,
  fontWeight: 800,
  padding: "10px 0",
};

const eyeBtn: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "50%",
  transform: "translateY(-50%)",
  width: 36,
  height: 30,
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.10)",
  background: "rgba(2,6,23,0.02)",
  cursor: "pointer",
  color: "rgba(15,23,42,0.65)",
};

const lineRule: React.CSSProperties = {
  height: 1,
  background: "rgba(15,23,42,0.14)",
};

const rowSimple: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  marginTop: 2,
};

const rememberRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

const checkbox: React.CSSProperties = {
  width: 14,
  height: 14,
  accentColor: LINKEDIN_BLUE,
};

const rememberTxt: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 750,
  color: "rgba(15,23,42,0.72)",
};

const ctaOnlyRow: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 6,
};

const ctaBtn: React.CSSProperties = {
  border: 0,
  cursor: "pointer",
  background: LINKEDIN_BLUE,
  color: "#fff",
  fontWeight: 950,
  borderRadius: 999,
  padding: "12px 18px",
  minWidth: 132,
  boxShadow: "0 14px 34px rgba(10,102,194,0.22)",
  transition: "transform 120ms ease, filter 140ms ease, opacity 140ms ease",
};

const ctaDisabled: React.CSSProperties = {
  cursor: "not-allowed",
  opacity: 0.55,
  filter: "grayscale(0.1)",
};

const ctaInner: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};

const dots: React.CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
};

const dot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.92)",
  animation: "swDot 720ms ease-in-out infinite",
};

const css = `
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
button:hover{ filter: brightness(1.02); }
button:active{ transform: translateY(0px) scale(.99); }

/* mobile: left panel hidden */
@media (max-width: 900px){
  .swOuter{
    grid-template-columns: 1fr !important;
    min-height: auto !important;
  }
  .swLeft{ display:none !important; }
}
`;