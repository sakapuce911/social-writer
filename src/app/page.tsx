// src/app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { seoAudit, applySeoRewrite, type SeoAudit } from "@/lib/seoAudit";
import { generateLocalPost, type Lang, type Network, type Objective } from "@/lib/localGenerator";

function normalizeFromLLM(raw: string): { caption: string; cta: string; hashtags: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { caption: "", cta: "", hashtags: "" };

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const caption = String(obj.caption ?? "").trim();
      const cta = String(obj.cta ?? "").trim();
      const hashtags = Array.isArray(obj.hashtags) ? obj.hashtags.join(" ").trim() : String(obj.hashtags ?? "").trim();
      return { caption, cta, hashtags };
    } catch {}
  }

  const lines = trimmed.split("\n");
  let section: "caption" | "cta" | "hashtags" | null = null;
  const out = { caption: [] as string[], cta: [] as string[], hashtags: [] as string[] };

  const isCaption = (s: string) => /^caption\s*:?\s*$/i.test(s);
  const isCTA = (s: string) => /^(cta|appel à l'action|call to action)\s*:?\s*$/i.test(s);
  const isHashtags = (s: string) => /^(hashtags|hash-tags)\s*:?\s*$/i.test(s);

  for (const l of lines) {
    const t = l.trim();

    if (/^caption\s*:/i.test(t)) {
      section = "caption";
      out.caption.push(t.replace(/^caption\s*:\s*/i, "").trim());
      continue;
    }
    if (/^(cta|appel à l'action|call to action)\s*:/i.test(t)) {
      section = "cta";
      out.cta.push(t.replace(/^(cta|appel à l'action|call to action)\s*:\s*/i, "").trim());
      continue;
    }
    if (/^hashtags\s*:/i.test(t)) {
      section = "hashtags";
      out.hashtags.push(t.replace(/^hashtags\s*:\s*/i, "").trim());
      continue;
    }

    if (isCaption(t)) {
      section = "caption";
      continue;
    }
    if (isCTA(t)) {
      section = "cta";
      continue;
    }
    if (isHashtags(t)) {
      section = "hashtags";
      continue;
    }

    if (!section) out.caption.push(l);
    else out[section].push(l);
  }

  const caption = out.caption.join("\n").trim();
  const cta = out.cta.join("\n").trim();
  const hashtagsRaw = out.hashtags.join(" ").replace(/\s+/g, " ").trim();
  return { caption, cta, hashtags: hashtagsRaw };
}

/** ✅ Gros SVG hero inline (aucun fichier à ajouter) */
function HeroCartoonSVG() {
  return (
    <svg viewBox="0 0 980 720" width="100%" height="100%" role="img" aria-label="Illustration SocialWriter">
      <defs>
        <linearGradient id="swBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(124,92,255,0.18)" />
          <stop offset="0.55" stopColor="rgba(255,77,109,0.14)" />
          <stop offset="1" stopColor="rgba(255,176,102,0.16)" />
        </linearGradient>

        <linearGradient id="swCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.92)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.72)" />
        </linearGradient>

        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="rgba(17,17,17,0.18)" />
        </filter>

        <filter id="hardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="0" floodColor="rgba(17,17,17,0.10)" />
        </filter>
      </defs>

      <rect x="0" y="0" width="980" height="720" rx="34" fill="url(#swBg)" />

      <g filter="url(#hardShadow)">
        <rect x="90" y="80" width="800" height="540" rx="36" fill="url(#swCard)" stroke="rgba(17,17,17,0.20)" strokeWidth="6" />
      </g>

      <g>
        <rect x="130" y="120" width="720" height="64" rx="22" fill="rgba(255,255,255,0.80)" stroke="rgba(17,17,17,0.14)" strokeWidth="4" />
        <circle cx="170" cy="152" r="10" fill="rgba(255,77,109,0.80)" />
        <circle cx="205" cy="152" r="10" fill="rgba(255,176,102,0.85)" />
        <circle cx="240" cy="152" r="10" fill="rgba(124,92,255,0.75)" />

        <g transform="translate(610 132)">
          <rect x="0" y="0" width="220" height="40" rx="999" fill="rgba(255,255,255,0.88)" stroke="rgba(17,17,17,0.12)" strokeWidth="4" />
          <text x="110" y="26" textAnchor="middle" fontSize="16" fontWeight="900" fill="rgba(17,17,17,0.78)">
            Fun mode ON ✨
          </text>
        </g>
      </g>

      <g filter="url(#softShadow)">
        <g transform="translate(150 220)">
          <rect x="0" y="0" width="260" height="150" rx="26" fill="rgba(255,255,255,0.92)" stroke="rgba(17,17,17,0.14)" strokeWidth="4" />
          <text x="22" y="44" fontSize="18" fontWeight="950" fill="rgba(17,17,17,0.86)">
            Hook
          </text>
          <text x="22" y="78" fontSize="16" fontWeight="800" fill="rgba(17,17,17,0.70)">
            “3 erreurs qui ruinent
          </text>
          <text x="22" y="102" fontSize="16" fontWeight="800" fill="rgba(17,17,17,0.70)">
            ta productivité…”
          </text>
          <circle cx="225" cy="44" r="18" fill="rgba(255,77,109,0.18)" stroke="rgba(17,17,17,0.12)" strokeWidth="3" />
          <text x="225" y="50" textAnchor="middle" fontSize="16" fontWeight="950" fill="rgba(17,17,17,0.8)">
            !
          </text>
        </g>

        <g transform="translate(430 250)">
          <rect x="0" y="0" width="380" height="130" rx="26" fill="rgba(255,255,255,0.92)" stroke="rgba(17,17,17,0.14)" strokeWidth="4" />
          <text x="22" y="48" fontSize="18" fontWeight="950" fill="rgba(17,17,17,0.86)">
            CTA
          </text>
          <text x="22" y="82" fontSize="16" fontWeight="800" fill="rgba(17,17,17,0.70)">
            Tu veux le template ? Écris “GO” 👇
          </text>
          <rect x="285" y="36" width="70" height="60" rx="18" fill="rgba(255,176,102,0.20)" stroke="rgba(17,17,17,0.12)" strokeWidth="3" />
          <text x="320" y="74" textAnchor="middle" fontSize="22" fontWeight="950">
            👇
          </text>
        </g>

        <g transform="translate(240 410)">
          <rect x="0" y="0" width="560" height="150" rx="26" fill="rgba(255,255,255,0.92)" stroke="rgba(17,17,17,0.14)" strokeWidth="4" />
          <text x="22" y="48" fontSize="18" fontWeight="950" fill="rgba(17,17,17,0.86)">
            Hashtags
          </text>
          <text x="22" y="86" fontSize="16" fontWeight="800" fill="rgba(17,17,17,0.70)">
            #productivité #habitudes #worksmart #team
          </text>

          <g transform="translate(430 34)">
            <rect x="0" y="0" width="110" height="48" rx="999" fill="rgba(124,92,255,0.16)" stroke="rgba(17,17,17,0.12)" strokeWidth="3" />
            <text x="55" y="31" textAnchor="middle" fontSize="16" fontWeight="950" fill="rgba(17,17,17,0.82)">
              copier
            </text>
          </g>
        </g>
      </g>
    </svg>
  );
}

function scoreBadge(score: number) {
  if (score >= 85) return { label: "Excellent", bg: "rgba(143,227,214,0.22)", bd: "rgba(143,227,214,0.35)" };
  if (score >= 70) return { label: "Bon", bg: "rgba(255,216,106,0.22)", bd: "rgba(255,216,106,0.35)" };
  if (score >= 50) return { label: "Moyen", bg: "rgba(255,176,102,0.20)", bd: "rgba(255,176,102,0.32)" };
  return { label: "À améliorer", bg: "rgba(255,77,109,0.16)", bd: "rgba(255,77,109,0.28)" };
}

export default function Page() {
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState<Lang>("fr");
  const [objective, setObjective] = useState<Objective>("attirer");

  // ✅ LinkedIn only (plus de sélecteur)
  const network: Network = "linkedin";

  // ⚠️ "loading" = uniquement pour IA (Gemini)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ caption: string; cta: string; hashtags: string } | null>(null);

  const [seo, setSeo] = useState<SeoAudit | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // ✅ IA quota local (affichage transparent, jamais bloquant)
  const QUOTA_DAILY = 20;
  const quotaKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `sw_ai_enhance_${y}-${m}-${d}`;
  }, []);
  const [aiCount, setAiCount] = useState(0);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const canGenerate = useMemo(() => subject.trim().length > 0, [subject]);
  const subjectCount = subject.trim().length;

  useEffect(() => {
    const onHashChange = () => setMenuOpen(false);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(quotaKey) ?? "0");
      setAiCount(Number.isFinite(v) ? v : 0);
    } catch {
      setAiCount(0);
    }
  }, [quotaKey]);

  function incAiCount() {
    try {
      const next = aiCount + 1;
      setAiCount(next);
      localStorage.setItem(quotaKey, String(next));
    } catch {}
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }

  async function copy(text: string) {
    const value = (text ?? "").toString();
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copié ✅");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("Copié ✅");
      } catch {
        showToast("Impossible de copier");
      }
    }
  }

  // ✅ Génération LOCAL (sans API) — utilise src/lib/localGenerator.ts (Caméléon)
  function generateLocal() {
    setError(null);
    setSeo(null);

    const parsed = generateLocalPost({
      subject,
      language,
      objective,
      network, // linkedin
    });

    setResult(parsed);

    const audit = seoAudit({
      subject,
      caption: parsed.caption,
      network, // linkedin
      language,
    });
    setSeo(audit);

    setTimeout(() => {
      const el = document.getElementById("resultBlock");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    showToast("Généré en local ✅");
  }

  // ✅ Améliorer avec IA (Gemini via /api/generate)
  async function improveWithAI() {
    setError(null);
    setSeo(null);

    // garde-fou UX : si quota atteint, on ne bloque pas, on informe
    if (aiCount >= QUOTA_DAILY) {
      showToast("Quota IA atteint — mode local illimité ✅");
      setError("Quota IA atteint (20/jour). Utilise “Générer (local)” et réessaie demain.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, language, objective, network }), // linkedin
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = String(data?.error || "Erreur génération");
        // si quota/429, on n'incrémente pas et on reste clean
        if (res.status === 429 || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("resource_exhausted")) {
          setError("Quota IA atteint (Gemini). Utilise “Générer (local)” ou réessaie demain.");
          showToast("Quota IA atteint — local illimité ✅");
          return;
        }
        throw new Error(msg);
      }

      const raw = String(data.output ?? "").trim();
      const parsed = normalizeFromLLM(raw);

      if (!parsed.hashtags) {
        const maybeTags = raw.match(/#[\p{L}\p{N}_]+/gu) ?? [];
        parsed.hashtags = Array.from(new Set(maybeTags)).join(" ");
      }

      setResult(parsed);

      const audit = seoAudit({
        subject,
        caption: parsed.caption,
        network, // linkedin
        language,
      });
      setSeo(audit);

      setTimeout(() => {
        const el = document.getElementById("resultBlock");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);

      incAiCount();
      showToast("Amélioré avec IA ✨");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Une erreur est survenue. Mode local toujours disponible ✅");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Optimiser SEO (réécrit la caption selon suggestions) — reste en local
  function optimizeSeo() {
    if (!result) return;

    const { rewritten } = applySeoRewrite({
      subject,
      caption: result.caption,
      language,
    });

    const next = { ...result, caption: rewritten };
    setResult(next);

    const audit = seoAudit({
      subject,
      caption: rewritten,
      network, // linkedin
      language,
    });
    setSeo(audit);

    showToast("Caption optimisée ✅");
  }

  const copyAll = () => {
    if (!result) return;
    const parts = [result.caption, result.cta, result.hashtags].filter(Boolean);
    copy(parts.join("\n\n").trim());
  };

  if (!mounted) return null;

  const badge = seo ? scoreBadge(seo.score) : null;
  const remaining = Math.max(0, QUOTA_DAILY - aiCount);

  return (
    <div className="page">
      {/* NAV */}
      <header className="nav">
  <div className="nav__inner">
    <div className="brand">
      <Image
        src="/logo-socialwriter.svg"
        alt="SocialWriter"
        width={150}
        height={38}
        className="brand__logo"
        priority
      />
    </div>

    <nav className="nav__links" aria-label="Navigation">
      <a href="#features">Fonctions</a>
      <a href="#generator">Générateur</a>
      <a href="#faq">FAQ</a>
    </nav>

    <div className="nav__cta">
      <button
        className="burger"
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Ouvrir le menu"
        aria-expanded={menuOpen}
      >
        <span className="burger__icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <button
        className="btn"
        type="button"
        onClick={async () => {
          try {
            await fetch("/api/logout", { method: "POST" });
          } finally {
            window.location.href = "/login";
          }
        }}
        title="Se déconnecter"
      >
        Déconnexion
      </button>

      <a className="btn" href="#generator">
        Commencer
      </a>
    </div>
  </div>

  <div className="nav__mobile" style={{ display: menuOpen ? "block" : undefined }}>
  <div className="nav__mobileInner">
    <a href="#features" onClick={() => setMenuOpen(false)}>
      Fonctions
    </a>
    <a href="#generator" onClick={() => setMenuOpen(false)}>
      Générateur
    </a>
    <a href="#faq" onClick={() => setMenuOpen(false)}>
      FAQ
    </a>

    <a className="btn" href="#generator" onClick={() => setMenuOpen(false)}>
      Commencer
    </a>

    <button
      className="btn"
      type="button"
      onClick={async () => {
        setMenuOpen(false);
        try {
          await fetch("/api/logout", { method: "POST" });
        } finally {
          window.location.href = "/login";
        }
      }}
      title="Se déconnecter"
      style={{ width: "100%" }}
    >
      Déconnexion
    </button>
  </div>
</div>
</header>


      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero__grid">
            <div>
              <div className="pill">
                <span className="pill__spark" />
                <span>
                  <b>LinkedIn uniquement</b> • Texte prêt à poster (3 blocs)
                </span>
              </div>

              <h1 className="h1">
                Des posts <span className="accent">cartoon</span> mais efficaces 😄
              </h1>

              <p className="lead">
                Tu donnes le sujet, la langue et l’objectif. On te sort un post LinkedIn prêt à publier : <b>Texte</b> + <b>CTA</b> + <b>Hashtags</b>.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="btn btn--primary" href="#generator">
                  Générer maintenant
                </a>
                <a className="btn" href="#features">
                  Voir les fonctions
                </a>
              </div>
            </div>

            <div className="heroArt" aria-hidden="true">
              <div className="heroSticker">
                <i /> Fun mode ON
              </div>
              <div className="heroArt__svg">
                <HeroCartoonSVG />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="container">
          <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Fonctions</div>
            <div style={{ color: "var(--muted)" }}>Optimisé pour LinkedIn : structure, ton, lisibilité et “copier-coller”.</div>
          </div>

          <div className="featuresGrid">
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Règles LinkedIn</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Structure claire, storytelling pro, CTA, hashtags propres.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>FR / EN</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Résultat généré directement dans la langue choisie.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Copie ultra simple</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Copier tout ou juste une section (Texte / CTA / Hashtags).</div>
            </div>
          </div>
        </div>
      </section>

      {/* GENERATOR */}
      <section id="generator" className="section section--tight">
        <div className="container">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 950, fontSize: 26 }}>Générateur LinkedIn</div>
            <div style={{ color: "var(--muted)", marginTop: 6 }}>Remplis. Clique. Copie. Poste.</div>
          </div>

          <div className="panel">
            <div className="panel__grid">
              {/* LEFT */}
              <div className="panel__left">
                <div className="field">
                  <div className="field__label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Sujet</span>
                    <span style={{ color: "var(--muted)", fontWeight: 900 }}>{subjectCount} caractères</span>
                  </div>
                  <textarea
                    className="input"
                    rows={4}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: L’importance du time management sur le milieu professionnel"
                  />
                </div>

                {/* ✅ LinkedIn only pill */}
                <div className="field">
                  <div className="field__label">Réseau</div>
                  <div
                    className="panel"
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      border: "3px solid rgba(10,102,194,0.22)",
                      background: "rgba(10,102,194,0.08)",
                      fontWeight: 950,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span>LinkedIn</span>
                    <span className="checkPill">✓ fixe</span>
                  </div>
                </div>

                <div className="row">
                  <div className="field">
                    <div className="field__label">Langue</div>
                    <select className="input" value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                      <option value="fr">Français</option>
                      <option value="en">Anglais</option>
                    </select>
                  </div>

                  <div className="field">
                    <div className="field__label">Objectif</div>
                    <select className="input" value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
                      <option value="vendre">Vendre</option>
                      <option value="attirer">Attirer</option>
                      <option value="éduquer">Éduquer</option>
                      <option value="recruter">Recruter</option>
                      <option value="inspirer">Inspirer</option>
                    </select>
                  </div>
                </div>

                {/* ✅ 2 boutons (Local + IA) + compteur quota visible */}
                <div style={{ display: "grid", gap: 10 }}>
                  <button className="btn btn--primary" onClick={generateLocal} disabled={!canGenerate} style={{ width: "100%" }}>
                    Générer (local)
                  </button>

                  <button
                    className={["btn", loading ? "btn--loading" : ""].join(" ").trim()}
                    onClick={improveWithAI}
                    disabled={!canGenerate || loading || aiCount >= QUOTA_DAILY}
                    style={{ width: "100%" }}
                    title="Utilise le quota gratuit Gemini (20/jour)"
                  >
                    {loading ? (
                      <span className="loaderCartoon" aria-label="Chargement">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      `Améliorer avec IA (${remaining}/${QUOTA_DAILY})`
                    )}
                  </button>

                  {/* petit texte quota (transparent, rassurant) */}
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                    <span style={{ marginRight: 8 }}>🟢 Local illimité</span>
                    <span>✨ IA restante aujourd’hui : {remaining}/{QUOTA_DAILY}</span>
                  </div>
                </div>

                {error && (
                  <div className="alert">
                    <b>Erreur :</b> {error}
                  </div>
                )}
              </div>

              {/* RIGHT */}
              <div className="panel__right" id="resultBlock">
                {!result ? (
                  <div className="empty">
                    <div className="empty__icon">📝</div>
                    <div className="empty__title">Tes résultats apparaîtront ici</div>
                    <div className="empty__sub">Génère pour obtenir un post LinkedIn prêt à poster (copie tout ou par section).</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {/* RESULT */}
                    <div className="result">
                      <div className="result__top">
                        <div style={{ fontWeight: 950 }}>Résultat</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button className="btn" onClick={copyAll}>
                            Copier tout
                          </button>
                        </div>
                      </div>

                      <pre className="pre">{[result.caption, result.cta, result.hashtags].filter(Boolean).join("\n\n")}</pre>
                    </div>

                    {/* ✅ SEO BLOCK + Bouton "Optimiser SEO" */}
                    {seo && (
                      <div className="panel" style={{ padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 950, fontSize: 18 }}>SEO check</div>

                          {badge && (
                            <span
                              style={{
                                padding: "8px 12px",
                                borderRadius: 999,
                                border: `3px solid ${badge.bd}`,
                                background: badge.bg,
                                fontWeight: 950,
                              }}
                            >
                              {badge.label} • {seo.score}/100
                            </span>
                          )}
                        </div>

                        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                          <div>
                            ✓ Mot-clé principal : <b>{seo.primaryKeyword}</b>
                          </div>
                          <div>
                            ✓ Densité : <b>{seo.density}%</b>
                          </div>
                          <div>
                            ✓ Mots-clés secondaires : <b>{seo.secondaryKeywords.join(", ") || "—"}</b>
                          </div>

                          {seo.paragraphsWithoutKeyword > 0 ? (
                            <div style={{ color: "var(--accent)" }}>⚠ {seo.paragraphsWithoutKeyword} paragraphe(s) sans mot-clé</div>
                          ) : (
                            <div>✓ Tous les paragraphes contiennent au moins 1 mot-clé</div>
                          )}

                          <div>{seo.longTailDetected ? "✓ Longue traîne détectée" : "⚠ Longue traîne non détectée"}</div>
                        </div>

                        {seo.suggestions.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontWeight: 950, marginBottom: 8 }}>Suggestions</div>
                            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                              {seo.suggestions.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button className="btn btn--primary" type="button" onClick={optimizeSeo} disabled={loading}>
                            Optimiser SEO
                          </button>

                          <button className="btn" type="button" onClick={() => copy(result.caption)}>
                            Copier caption
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Toast */}
          {toast && (
            <div
              style={{
                position: "fixed",
                left: "50%",
                transform: "translateX(-50%)",
                bottom: 18,
                zIndex: 9999,
                padding: "10px 14px",
                borderRadius: 999,
                border: "3px solid rgba(17,17,17,0.12)",
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 12px 0 rgba(17,17,17,0.08)",
                fontWeight: 950,
              }}
              role="status"
              aria-live="polite"
            >
              {toast}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section">
        <div className="container">
          <div style={{ fontWeight: 950, fontSize: 22, marginBottom: 10 }}>FAQ</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Pourquoi séparer Texte / CTA / Hashtags ?</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Pour copier exactement ce dont tu as besoin, sans polluer la publication avec des titres.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Le choix de langue change vraiment le contenu ?</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Oui. Le résultat est généré directement en Français ou en Anglais selon ton choix.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>L’app marche sans IA ?</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>
                Oui. <b>Générer (local)</b> est illimité et fonctionne même si l’IA est en quota, lente ou indisponible.
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              color: "var(--muted)",
              fontSize: 12,
            }}
          >
            © <span suppressHydrationWarning>{new Date().getFullYear()}</span> SocialWriter — Fun. Rapide. Prêt à poster.
          </div>
        </div>
      </section>
    </div>
  );
}