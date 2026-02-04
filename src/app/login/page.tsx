// src/app/login/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Connexion — SocialWriter",
  description: "Accès réservé à SocialWriter.",
  robots: { index: false, follow: false },
};

function LoadingFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0b10",
        padding: 24,
        color: "rgba(255,255,255,0.86)",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 24,
          padding: 22,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(17,17,24,0.62)",
          boxShadow: "0 28px 70px rgba(0,0,0,0.55)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              fontWeight: 950,
              color: "rgba(255,255,255,0.92)",
              background: "linear-gradient(135deg, rgba(124,92,255,0.95), rgba(98,181,255,0.92))",
              border: "1px solid rgba(255,255,255,0.22)",
              boxShadow: "0 14px 34px rgba(124,92,255,0.25)",
            }}
          >
            SW
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: "-0.2px" }}>Connexion</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.62)" }}>Chargement…</div>
          </div>
        </div>

        {/* skeleton */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={skel(54)} />
          <div style={skel(54)} />
          <div style={skel(48)} />
        </div>

        <style>{css}</style>
      </div>
    </div>
  );
}

function skel(h: number) {
  return {
    height: h,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.10) 35%, rgba(255,255,255,0.06) 70%)",
    backgroundSize: "220% 100%",
    animation: "swSkel 1.2s ease-in-out infinite",
  } as const;
}

const css = `
@keyframes swSkel{
  0%{ background-position: 0% 0%; opacity: .85; }
  50%{ background-position: 100% 0%; opacity: 1; }
  100%{ background-position: 0% 0%; opacity: .85; }
}
`;

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginClient />
    </Suspense>
  );
}
