// src/app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { seoAudit, applySeoRewrite, type SeoAudit } from "@/lib/seoAudit";

type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
type Network = "linkedin" | "facebook" | "instagram" | "tiktok";
type Lang = "fr" | "en";

const NETWORKS: {
  key: Network;
  label: string;
  hint: string;
  bg: string; // utilisé pour les petits effets
}[] = [
  { key: "linkedin", label: "LinkedIn", hint: "Pro • storytelling • crédibilité", bg: "rgba(10,102,194,0.18)" },
  { key: "facebook", label: "Facebook", hint: "Communauté • simple • engageant", bg: "rgba(24,119,242,0.16)" },
  { key: "instagram", label: "Instagram", hint: "Visuel • hooks • hashtags", bg: "rgba(253,101,133,0.18)" },
  { key: "tiktok", label: "TikTok", hint: "Punchy • trends • CTA direct", bg: "rgba(23,23,23,0.10)" },
];

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

/** Logos inline (pas besoin d’images) */
function SocialLogo({ net }: { net: Network }) {
  const common = { width: 44, height: 44, viewBox: "0 0 64 64" };

  if (net === "linkedin") {
    return (
      <svg {...common} aria-hidden="true">
        <path fill="#FFFFFF" d="M14 26h8v24h-8V26zm4-12c2.6 0 4.7 2.1 4.7 4.7S20.6 23.4 18 23.4s-4.7-2.1-4.7-4.7S15.4 14 18 14z" />
        <path fill="#FFFFFF" d="M26 26h8v3.3c1.1-2 3.6-4 7.7-4 8.2 0 9.8 5.4 9.8 12.4V50h-8V38.9c0-2.7-.1-6.2-3.8-6.2-3.8 0-4.4 3-4.4 6V50h-8V26z" />
      </svg>
    );
  }

  if (net === "facebook") {
    return (
      <svg {...common} aria-hidden="true">
        <path fill="#FFFFFF" d="M38 22h6v-8h-6c-6.1 0-10 3.9-10 10v4h-6v8h6v20h8V36h7l1-8h-8v-3c0-1.8 1.2-3 3-3z" />
      </svg>
    );
  }

  if (net === "instagram") {
    return (
      <svg {...common} aria-hidden="true">
        <path
          fill="#FFFFFF"
          d="M40.5 14h-17C18.3 14 14 18.3 14 23.5v17C14 45.7 18.3 50 23.5 50h17C45.7 50 50 45.7 50 40.5v-17C50 18.3 45.7 14 40.5 14zM32 41.5c-5.2 0-9.5-4.3-9.5-9.5s4.3-9.5 9.5-9.5 9.5 4.3 9.5 9.5-4.3 9.5-9.5 9.5z"
        />
        <circle fill="#FFFFFF" cx="42.5" cy="21.5" r="2.5" />
        <circle fill="#FFFFFF" cx="32" cy="32" r="6" />
      </svg>
    );
  }

  // tiktok
  return (
    <svg {...common} aria-hidden="true">
      <path
        fill="#FFFFFF"
        d="M44 18c-2.1-1.7-3.4-3.9-3.8-6h-6v24.5c0 2.7-2.2 5-5 5s-5-2.2-5-5 2.2-5 5-5c.7 0 1.4.1 2 .4v-6.4c-.7-.1-1.3-.2-2-.2-6.1 0-11 4.9-11 11s4.9 11 11 11 11-4.9 11-11V26.7c2.7 1.9 5.9 3 9 3v-6c-2 0-4-.7-5.2-1.7z"
      />
    </svg>
  );
}

function bannerVars(net: Network) {
  if (net === "linkedin") return { bg: "#0A66C2" };
  if (net === "facebook") return { bg: "#1877F2" };
  if (net === "instagram") return { bg: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4)" };
  return { bg: "#111111" };
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
  const [network, setNetwork] = useState<Network>("linkedin");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ caption: string; cta: string; hashtags: string } | null>(null);

  const [seo, setSeo] = useState<SeoAudit | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [popKey, setPopKey] = useState<Network | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const canGenerate = useMemo(() => subject.trim().length > 0, [subject]);
  const subjectCount = subject.trim().length;

  useEffect(() => {
    const onHashChange = () => setMenuOpen(false);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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

  async function generate() {
    setError(null);
    setResult(null);
    setSeo(null);
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, language, objective, network }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erreur génération");

      const raw = String(data.output ?? "").trim();
      const parsed = normalizeFromLLM(raw);

      if (!parsed.hashtags) {
        const maybeTags = raw.match(/#[\p{L}\p{N}_]+/gu) ?? [];
        parsed.hashtags = Array.from(new Set(maybeTags)).join(" ");
      }

      setResult(parsed);

      // ✅ SEO audit (caption seule)
      const audit = seoAudit({
        subject,
        caption: parsed.caption,
        network,
        language,
      });
      setSeo(audit);

      setTimeout(() => {
        const el = document.getElementById("resultBlock");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  // ✅ NOUVEAU: Optimiser SEO (réécrit la caption selon suggestions)
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
      network,
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

  const onPickNetwork = (k: Network) => {
    setNetwork(k);
    setPopKey(k);
    window.setTimeout(() => setPopKey(null), 240);
  };

  const selectedNetworkLabel = NETWORKS.find((n) => n.key === network)?.label ?? "Réseau";

  if (!mounted) return null;

  const badge = seo ? scoreBadge(seo.score) : null;

  return (
    <div className="page">
      {/* NAV */}
      <header className="nav">
        <div className="nav__inner">
          <div className="brand">
            <Image src="/logo-socialwriter.svg" alt="SocialWriter" width={150} height={38} className="brand__logo" priority />
          </div>

          <nav className="nav__links" aria-label="Navigation">
            <a href="#features">Fonctions</a>
            <a href="#generator">Générateur</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="nav__cta">
            <button className="burger" type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Ouvrir le menu" aria-expanded={menuOpen}>
              <span className="burger__icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>

            <a className="btn" href="#generator">
              Commencer
            </a>
          </div>
        </div>

        <div className="nav__mobile" style={{ display: menuOpen ? "block" : undefined }}>
          <div className="nav__mobileInner">
            <a href="#features" onClick={() => setMenuOpen(false)}>Fonctions</a>
            <a href="#generator" onClick={() => setMenuOpen(false)}>Générateur</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <a href="#generator" onClick={() => setMenuOpen(false)}>Commencer</a>
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
                  <b>Texte prêt à poster</b> (séparé en 3 blocs)
                </span>
              </div>

              <h1 className="h1">
                Des posts <span className="accent">cartoon</span> mais efficaces 😄
              </h1>

              <p className="lead">
                Tu donnes le sujet, la langue et l’objectif. On te sort un post prêt à publier : <b>Texte</b> + <b>CTA</b> + <b>Hashtags</b>.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="btn btn--primary" href="#generator">Générer maintenant</a>
                <a className="btn" href="#features">Voir les fonctions</a>
              </div>
            </div>

            <div className="heroArt" aria-hidden="true">
              <div className="heroSticker"><i /> Fun mode ON</div>
              <div className="heroArt__svg"><HeroCartoonSVG /></div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="container">
          <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Fonctions</div>
            <div style={{ color: "var(--muted)" }}>Format adapté automatiquement + choix du réseau + copie ultra simple.</div>
          </div>

          <div className="featuresGrid">
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Règles par plateforme</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>LinkedIn / Facebook / Instagram / TikTok : structure et ton adaptés.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>FR / EN</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Résultat généré directement dans la langue choisie.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Copie flexible</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Copier tout ou juste une section (Texte / CTA / Hashtags).</div>
            </div>
          </div>
        </div>
      </section>

      {/* GENERATOR */}
      <section id="generator" className="section section--tight">
        <div className="container">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 950, fontSize: 26 }}>Générateur</div>
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

                <div className="field">
                  <div className="field__label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Réseau</span>
                    <span className="checkPill">Sélection : {selectedNetworkLabel}</span>
                  </div>

                  <div className="networkGrid" role="radiogroup" aria-label="Choix du réseau">
                    {NETWORKS.map((n) => {
                      const selected = n.key === network;
                      const pop = popKey === n.key;

                      const vars = bannerVars(n.key);

                      return (
                        <button
                          key={n.key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onPickNetwork(n.key)}
                          style={{
                            ["--netGlow" as any]: n.bg,
                            ["--bannerBg" as any]: vars.bg,
                          }}
                          className={["networkCard2", selected ? "networkCard2--selected" : "", pop ? "networkCard2--pop" : ""].join(" ").trim()}
                        >
                          <div className="netBanner" aria-hidden="true">
                            <div className="netBanner__inner">
                              <div className="netLogo">
                                <SocialLogo net={n.key} />
                              </div>
                            </div>
                          </div>

                          <div className="netInfo">
                            <div className="netTitleRow">
                              <div className="netName">{n.label}</div>
                              {selected && <span className="checkPill">✓ choisi</span>}
                            </div>
                            <div className="netHint">{n.hint}</div>
                          </div>
                        </button>
                      );
                    })}
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

                <button
                  className={["btn", "btn--primary", loading ? "btn--loading" : ""].join(" ").trim()}
                  onClick={generate}
                  disabled={!canGenerate || loading}
                  style={{ width: "100%" }}
                >
                  {loading ? (
                    <span className="loaderCartoon" aria-label="Chargement">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    "Générer"
                  )}
                </button>

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
                    <div className="empty__sub">Génère pour obtenir un texte prêt à poster (copie tout ou par section).</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {/* RESULT */}
                    <div className="result">
                      <div className="result__top">
                        <div style={{ fontWeight: 950 }}>Résultat</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button className="btn" onClick={copyAll}>Copier tout</button>
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
                          <div>✓ Mot-clé principal : <b>{seo.primaryKeyword}</b></div>
                          <div>✓ Densité : <b>{seo.density}%</b></div>
                          <div>✓ Mots-clés secondaires : <b>{seo.secondaryKeywords.join(", ") || "—"}</b></div>

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
                                                    </ul>
                        </div>
                        )}

                        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            className="btn btn--primary"
                            type="button"
                            onClick={optimizeSeo}
                            disabled={loading}
                          >
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

          {/* Sticky bar mobile */}
          <div className="mobileBar" style={{ position: "sticky", bottom: 10, zIndex: 10, marginTop: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: result ? "1fr 1fr" : "1fr",
                gap: 10,
                padding: 10,
                borderRadius: 18,
                border: "3px solid rgba(17,17,17,0.12)",
                background: "rgba(246,241,234,0.92)",
                boxShadow: "0 12px 0 rgba(17,17,17,0.08)",
                backdropFilter: "blur(10px)",
              }}
            >
              <button
                className={["btn", "btn--primary", loading ? "btn--loading" : ""].join(" ").trim()}
                onClick={generate}
                disabled={!canGenerate || loading}
                style={{ width: "100%" }}
              >
                {loading ? (
                  <span className="loaderCartoon" aria-label="Chargement">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  "Générer"
                )}
              </button>

              {result && (
                <button className="btn" onClick={copyAll} style={{ width: "100%" }}>
                  Copier tout
                </button>
              )}
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
              <div style={{ color: "var(--muted)", marginTop: 6 }}>
                Pour copier exactement ce dont tu as besoin, sans polluer la publication avec des titres.
              </div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Le choix de langue change vraiment le contenu ?</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>
                Oui. Le modèle génère le résultat directement en Français ou en Anglais selon ton choix.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, color: "var(--muted)", fontSize: 12 }}>
            © <span suppressHydrationWarning>{new Date().getFullYear()}</span> SocialWriter — Fun. Rapide. Prêt à poster.
          </div>
        </div>
      </section>
    </div>
  );
}

