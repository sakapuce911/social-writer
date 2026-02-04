// src/app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import LinkedInPreview from "./LinkedInPreview";

// ✅ Types (IA-only)
type Objective = "vendre" | "attirer" | "éduquer" | "recruter" | "inspirer";
type Network = "linkedin";
type Lang = "fr" | "en";

type LinkedInChecks = {
  hookLength: boolean;
  singleIdea: boolean;
  openQuestion: boolean;
  hashtagCount: boolean;
  mobileReadable: boolean;
};

type LinkedInDetails = {
  hook: string;
  hookLengthChars: number;
  paragraphCount: number;
  hashtagCount: number;
  tooLongParagraphs: number;
};

type LinkedInAudit = {
  score: number; // 0..100
  checks: LinkedInChecks;
  details: LinkedInDetails;
  warnings: string[];
};

function normalizeFromLLM(raw: string): { caption: string; cta: string; hashtags: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { caption: "", cta: "", hashtags: "" };

  // JSON strict
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const caption = String(obj.caption ?? "").trim();
      const cta = String(obj.cta ?? "").trim();
      const hashtags = Array.isArray(obj.hashtags) ? obj.hashtags.join(" ").trim() : String(obj.hashtags ?? "").trim();
      return { caption, cta, hashtags };
    } catch {}
  }

  // fallback format CAPTION / CTA / HASHTAGS
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

function scoreBadge(score: number) {
  if (score >= 85) return { label: "Excellent", tone: "ok" as const };
  if (score >= 70) return { label: "Bon", tone: "warn" as const };
  if (score >= 50) return { label: "Moyen", tone: "warn" as const };
  return { label: "À améliorer", tone: "bad" as const };
}

/** ✅ Helpers audit LinkedIn 2026 */
function splitParagraphs(text: string) {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  return raw.split(/\n\s*\n+/g).map((p) => p.trim()).filter(Boolean);
}

function getHook(caption: string) {
  const t = (caption ?? "").trim();
  if (!t) return "";
  const firstLine = t.split("\n").map((s) => s.trim()).find(Boolean) ?? "";
  return firstLine.trim();
}

function extractHashtags(raw: string) {
  const tags = (raw ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/** ✅ Auto-sync hashtags: "tag1 tag2" -> "#tag1 #tag2" */
function normalizeHashtagsInput(input: string) {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  const existing = extractHashtags(raw);

  const tokens = raw
    .replace(/[\n\r]+/g, " ")
    .split(/[\s,;]+/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/^#+/, ""))
    .filter((t) => t.length >= 2);

  const all = [...existing.map((t) => t.replace(/^#/, "")), ...tokens];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of all) {
    const clean = t.replace(/[^\p{L}\p{N}_]+/gu, "");
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${clean}`);
  }

  return out.join(" ").trim();
}

function computeLinkedInAudit(args: { subject: string; caption: string; cta: string; hashtags: string; language: Lang }): LinkedInAudit {
  const { caption, cta, hashtags } = args;

  const hook = getHook(caption);
  const hookLen = hook.length;

  const paragraphs = splitParagraphs(caption);
  const paragraphCount = paragraphs.length;

  const tagList = extractHashtags(hashtags);
  const hashtagCount = tagList.length;

  const hookLengthOk = hookLen >= 150 && hookLen <= 180;

  const listMarkers = (caption.match(/(^|\n)\s*(?:[-–•]|👉|✅|❌)/g) ?? []).length;
  const numberedSteps = (caption.match(/(^|\n)\s*\d+\s*[\)\.]/g) ?? []).length;
  const singleIdeaOk = paragraphCount <= 7 && listMarkers <= 10 && numberedSteps <= 6;

  const capEnd = (caption ?? "").trim();
  const ctaEnd = (cta ?? "").trim();
  const openQuestionOk = capEnd.endsWith("?") || ctaEnd.endsWith("?");

  const hashtagCountOk = hashtagCount >= 3 && hashtagCount <= 5;

  let tooLong = 0;
  let shortOk = 0;
  for (const p of paragraphs) {
    if (p.length > 380) tooLong += 1;
    if (p.length <= 240) shortOk += 1;
  }
  const mobileReadableOk = paragraphs.length === 0 ? false : tooLong === 0 && shortOk / paragraphs.length >= 0.65;

  const checks: LinkedInChecks = {
    hookLength: hookLengthOk,
    singleIdea: singleIdeaOk,
    openQuestion: openQuestionOk,
    hashtagCount: hashtagCountOk,
    mobileReadable: mobileReadableOk,
  };

  let score = 0;
  score += checks.hookLength ? 20 : 0;
  score += checks.singleIdea ? 20 : 0;
  score += checks.openQuestion ? 20 : 0;
  score += checks.hashtagCount ? 20 : 0;
  score += checks.mobileReadable ? 20 : 0;

  if ((cta ?? "").trim().length >= 8) score += 2;
  if (paragraphCount >= 3 && paragraphCount <= 6) score += 2;
  score = Math.max(0, Math.min(100, score));

  const warnings: string[] = [];

  if (!hook.trim()) warnings.push("Hook manquant : ajoute une 1ère ligne forte (accroche).");
  else if (!hookLengthOk) {
    if (hookLen < 150) warnings.push(`Hook trop court (${hookLen} caractères) : vise 150–180.`);
    else warnings.push(`Hook trop long (${hookLen} caractères) : vise 150–180.`);
  }

  if (!singleIdeaOk) warnings.push("Trop d’éléments : garde 1 seule idée (moins de paragraphes / moins de listes).");
  if (!openQuestionOk) warnings.push("Pas de question finale : termine par une question ouverte.");
  if (!hashtagCountOk) warnings.push(`Hashtags : ${hashtagCount} détecté(s). Il en faut 3–5 (de niche).`);
  if (!mobileReadableOk) warnings.push("Lisibilité mobile : paragraphes trop longs. Fais des blocs courts (1–2 lignes).");

  const details: LinkedInDetails = {
    hook,
    hookLengthChars: hookLen,
    paragraphCount,
    hashtagCount,
    tooLongParagraphs: tooLong,
  };

  return { score, checks, details, warnings };
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="statCard">
      <div className="statCard__label">{label}</div>
      <div className="statCard__value">{value}</div>
      <div className="statCard__hint">{hint}</div>
    </div>
  );
}

function MiniStep({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="miniStep">
      <div className="miniStep__n">{n}</div>
      <div className="miniStep__txt">
        <div className="miniStep__title">{title}</div>
        <div className="miniStep__desc">{desc}</div>
      </div>
      <div className="miniStep__arrow" aria-hidden="true">
        ↗
      </div>
    </div>
  );
}

export default function Page() {
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState<Lang>("fr");
  const [objective, setObjective] = useState<Objective>("attirer");
  const network: Network = "linkedin";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ caption: string; cta: string; hashtags: string } | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // ✅ Mode Pro
  const PRO_MIN_SCORE = 75;

  // ✅ IA quota localStorage
  const QUOTA_DAILY = 20;
  const quotaKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `sw_ai_generate_${y}-${m}-${d}`;
  }, []);
  const [aiCount, setAiCount] = useState(0);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const canGenerate = useMemo(() => subject.trim().length > 0, [subject]);
  const subjectCount = subject.trim().length;

  // ✅ Mode “mobile LinkedIn” pour les previews (responsive)
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  useEffect(() => {
    const compute = () => setIsMobilePreview(window.matchMedia("(max-width: 520px)").matches);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

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

  // ✅ Audit temps réel
  const audit = useMemo<LinkedInAudit | null>(() => {
    if (!result) return null;
    const hasAny = (result.caption ?? "").trim() || (result.cta ?? "").trim() || (result.hashtags ?? "").trim();
    if (!hasAny) return null;

    return computeLinkedInAudit({
      subject,
      caption: result.caption ?? "",
      cta: result.cta ?? "",
      hashtags: result.hashtags ?? "",
      language,
    });
  }, [result?.caption, result?.cta, result?.hashtags, subject, language]);

  const badge = audit ? scoreBadge(audit.score) : null;
  const proBlocked = useMemo(() => (audit ? audit.score < PRO_MIN_SCORE : false), [audit]);
  const remaining = Math.max(0, QUOTA_DAILY - aiCount);

  // ✅ Génération IA
  async function generateWithAI() {
    setError(null);

    if (aiCount >= QUOTA_DAILY) {
      setError(`Quota IA atteint (${QUOTA_DAILY}/jour). Réessaie demain.`);
      showToast("Quota IA atteint ⚠️");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, language, objective, network }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = String(data?.code ?? "");
        const msg = String(data?.error || "Erreur génération");

        if (res.status === 429 || code === "quota" || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("resource_exhausted")) {
          setError("Quota API IA atteint (côté provider). Réessaie plus tard ou change de clé.");
          showToast("Quota API IA ⚠️");
          return;
        }

        if (res.status === 504 || code === "timeout" || msg.toLowerCase().includes("timeout")) {
          setError("Timeout IA : le modèle a mis trop de temps. Réessaie.");
          showToast("Timeout IA ⚠️");
          return;
        }

        if (res.status === 502 || code === "bad_output") {
          setError("L’IA a renvoyé un format invalide. Réessaie (ou change légèrement le sujet).");
          showToast("Format IA invalide ⚠️");
          return;
        }

        throw new Error(msg);
      }

      const raw = String(data?.output ?? "").trim();
      if (!raw) throw new Error("Réponse vide.");

      const parsed = normalizeFromLLM(raw);
      parsed.hashtags = normalizeHashtagsInput(parsed.hashtags);
      setResult(parsed);

      setTimeout(() => {
        const el = document.getElementById("resultBlock");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);

      incAiCount();
      showToast("Généré avec IA ✨");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  const copyAll = () => {
    if (!result) return;
    if (audit && audit.score < PRO_MIN_SCORE) {
      showToast(`Mode Pro : score < ${PRO_MIN_SCORE}. Corrige avant de copier.`);
      return;
    }
    const parts = [result.caption, result.cta, result.hashtags].filter(Boolean);
    copy(parts.join("\n\n").trim());
  };

  const copyCaption = () => {
    if (!result) return;
    if (audit && audit.score < PRO_MIN_SCORE) {
      showToast(`Mode Pro : score < ${PRO_MIN_SCORE}. Corrige avant de copier.`);
      return;
    }
    copy(result.caption);
  };

  const copyCTA = () => {
    if (!result) return;
    if (audit && audit.score < PRO_MIN_SCORE) {
      showToast(`Mode Pro : score < ${PRO_MIN_SCORE}. Corrige avant de copier.`);
      return;
    }
    copy(result.cta);
  };

  const copyHashtags = () => {
    if (!result) return;
    if (audit && audit.score < PRO_MIN_SCORE) {
      showToast(`Mode Pro : score < ${PRO_MIN_SCORE}. Corrige avant de copier.`);
      return;
    }
    copy(result.hashtags);
  };

  // ✅ Auto-fix IA
  const onAutoFix = async () => {
    if (!result) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/autofix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          language,
          current: {
            caption: result.caption,
            cta: result.cta,
            hashtags: result.hashtags,
          },
          audit,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = String(data?.error || "Erreur Auto-fix");
        throw new Error(msg);
      }

      const out = data?.output;
      if (!out?.caption && !out?.cta && !out?.hashtags) {
        throw new Error("Auto-fix: réponse vide.");
      }

      setResult((prev) =>
        prev
          ? {
              ...prev,
              caption: String(out.caption ?? prev.caption),
              cta: String(out.cta ?? prev.cta),
              hashtags: String(out.hashtags ?? prev.hashtags),
            }
          : prev
      );

      showToast("Auto-fix IA appliqué ✅");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Erreur Auto-fix");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="page page--dark">
      {/* NAV */}
      <header className="nav nav--dark">
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

            <button
              className="btn btn--ghost"
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

            <a className="btn btn--primary" href="#generator">
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

            <a className="btn btn--primary" href="#generator" onClick={() => setMenuOpen(false)}>
              Commencer
            </a>

            <button
              className="btn btn--ghost"
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
      <section className="hero hero--dark">
        <div className="container">
          <div className="hero__grid hero__grid--ref">
            <div className="heroLeft">
              <div className="heroKicker">
                <span className="dot" aria-hidden="true" />
                <span>
                  <b>LinkedIn uniquement</b> • Structure 2026 • Mode Pro
                </span>
              </div>

              <h1 className="heroTitle">
                ÉCRIVEZ DES POSTS <span className="accent">LINKEDIN</span> QUI DÉCLENCHENT DES COMMENTAIRES
              </h1>

              <p className="heroSub">
                Texte + CTA + Hashtags, optimisés pour la lecture mobile, la clarté, et l’engagement réel (conversation early).
              </p>

              <div className="heroActions">
                <a className="btn btn--primary btn--xl" href="#generator">
                  Générer mon post
                </a>
                <a className="btn btn--ghost btn--xl" href="#features">
                  Voir les fonctions
                </a>
              </div>

              <div className="statsGrid">
                <StatCard label="Mode Pro" value="75/100" hint="Copie bloquée si score < 75" />
                <StatCard label="Audit" value="Temps réel" hint="Hook • Lisibilité • Hashtags • Question" />
                <StatCard label="Quota IA" value={`${remaining}/${QUOTA_DAILY}`} hint="Restant aujourd’hui (local UI)" />
              </div>
            </div>

            <div className="heroRight">
              <div className="heroArtRef">
                <div className="heroStack">
                  <div className="heroTile heroTile--big">
                    <div className="heroTile__title">Aperçu “post LinkedIn”</div>
                    <div className="heroTile__sub">Avant de publier, tu vois ce que ça donne.</div>

                    <div className="heroPreviewFrame">
                      <LinkedInPreview
                        variant={isMobilePreview ? "mobile" : "default"}
                        caption={
                          result?.caption ||
                          "Vous perdez du temps sans vous en rendre compte.\n\nVoici 3 micro-changements qui doublent votre focus (sans travailler plus).\n\n1) …\n2) …\n3) …\n\nVous avez plutôt un problème de focus ou de discipline ?"
                        }
                        cta={result?.cta || "Quelle est LA chose qui te fait perdre le plus de temps en ce moment ?"}
                        hashtags={result?.hashtags || "#productivité #linkedin #personalbranding"}
                      />
                    </div>
                  </div>

                  <div className="heroTile heroTile--mini heroTile--a">
                    <MiniStep n="01" title="Hook" desc="Vous + chiffre / question / confession" />
                  </div>

                  <div className="heroTile heroTile--mini heroTile--b">
                    <MiniStep n="02" title="Structure" desc="Paragraphes courts + 3–5 conseils" />
                  </div>

                  <div className="heroTile heroTile--mini heroTile--c">
                    <MiniStep n="03" title="CTA" desc="Question ouverte (réponses > 10 mots)" />
                  </div>
                </div>

                <div className="heroGlow" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section section--dark">
        <div className="container">
          <div className="sectionHead">
            <div className="sectionTitle">Fonctions</div>
            <div className="sectionDesc">Tout est pensé pour LinkedIn : structure, audit, correction, et copier-coller propre.</div>
          </div>

          <div className="featuresGrid featuresGrid--ref">
            <div className="panel panel--dark" style={{ padding: 18 }}>
              <div className="panelKicker">Auto-sync</div>
              <div className="panelTitle">Hashtags auto-normalisés</div>
              <div className="panelDesc">Tape “tag1 tag2” → ça devient “#tag1 #tag2” (unique, propre, stable).</div>
            </div>

            <div className="panel panel--dark" style={{ padding: 18 }}>
              <div className="panelKicker">Auto-fix</div>
              <div className="panelTitle">Correction basée sur l’audit</div>
              <div className="panelDesc">On envoie score + warnings à l’IA : elle corrige ce qui bloque vraiment.</div>
            </div>

            <div className="panel panel--dark" style={{ padding: 18 }}>
              <div className="panelKicker">Mode Pro</div>
              <div className="panelTitle">Copie bloquée si score &lt; 75</div>
              <div className="panelDesc">Tu postes uniquement quand c’est suffisamment clean.</div>
            </div>
          </div>
        </div>
      </section>

      {/* GENERATOR */}
      <section id="generator" className="section section--dark section--tight">
        <div className="container">
          <div className="sectionHead">
            <div className="sectionTitle">Générateur LinkedIn</div>
            <div className="sectionDesc">Remplis → génère → édite → auto-fix → copie → publie.</div>
          </div>

          <div className="panel panel--dark panel--tool">
            <div className="panel__grid panel__grid--ref">
              {/* LEFT */}
              <div className="panel__left panel__left--dark">
                <div className="field">
                  <div className="field__label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Sujet</span>
                    <span className="field__meta">{subjectCount} caractères</span>
                  </div>
                  <textarea
                    className="input input--dark"
                    rows={4}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Pourquoi on doit booster notre productivité ?"
                  />
                </div>

                <div className="row">
                  <div className="field">
                    <div className="field__label">Langue</div>
                    <select className="input input--dark" value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                      <option value="fr">Français</option>
                      <option value="en">Anglais</option>
                    </select>
                  </div>

                  <div className="field">
                    <div className="field__label">Objectif</div>
                    <select className="input input--dark" value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
                      <option value="vendre">Vendre</option>
                      <option value="attirer">Attirer</option>
                      <option value="éduquer">Éduquer</option>
                      <option value="recruter">Recruter</option>
                      <option value="inspirer">Inspirer</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <button
                    className={["btn", "btn--primary", "btn--xl", loading ? "btn--loading" : ""].join(" ").trim()}
                    onClick={generateWithAI}
                    disabled={!canGenerate || loading || aiCount >= QUOTA_DAILY}
                    style={{ width: "100%" }}
                    title={`Quota IA : ${QUOTA_DAILY}/jour`}
                  >
                    {loading ? (
                      <span className="loaderDots" aria-label="Chargement">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      `Générer avec IA (${remaining}/${QUOTA_DAILY})`
                    )}
                  </button>

                  <div className="tinyInfo">✨ IA restante aujourd’hui : {remaining}/{QUOTA_DAILY}</div>
                </div>

                {error && (
                  <div className="alert alert--dark">
                    <b>Erreur :</b> {error}
                  </div>
                )}

                <div className="proNote">
                  <div className="proNote__title">Mode Pro</div>
                  <div className="proNote__desc">Copie bloquée si score &lt; {PRO_MIN_SCORE}. Utilise Auto-fix IA pour corriger vite.</div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="panel__right panel__right--dark" id="resultBlock">
                {!result ? (
                  <div className="empty empty--dark">
                    <div className="empty__icon">📝</div>
                    <div className="empty__title">Tes résultats apparaîtront ici</div>
                    <div className="empty__sub">Génère, puis édite (caption/CTA/hashtags). Auto-fix IA est dispo.</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div className="result result--dark">
                      <div className="result__top result__top--dark">
                        <div style={{ fontWeight: 950 }}>Éditeur</div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <button className="btn btn--ghost" onClick={onAutoFix} disabled={loading || !audit} title="Auto-fix IA">
                            Auto-fix IA ✨
                          </button>

                          <button
                            className="btn btn--ghost"
                            onClick={copyAll}
                            disabled={loading || proBlocked}
                            title={proBlocked ? `Mode Pro : score < ${PRO_MIN_SCORE}` : "Copier tout"}
                          >
                            Copier tout
                          </button>

                          {audit && badge && (
                            <span className={["scorePill", `scorePill--${badge.tone}`].join(" ")}>
                              {badge.label} • {audit.score}/100
                            </span>
                          )}
                        </div>
                      </div>

                      {proBlocked && (
                        <div className="swWarnings swWarnings--dark" style={{ marginTop: 12 }}>
                          <div className="swWarnings__title">Mode Pro : copie bloquée</div>
                          <div className="swWarnings__desc">Score &lt; {PRO_MIN_SCORE}. Corrige les warnings (ou clique Auto-fix IA).</div>
                        </div>
                      )}

                      <div style={{ marginTop: 12 }}>
                        <div className="subTitle">Aperçu LinkedIn</div>
                        <div className="previewWrap">
                          <LinkedInPreview variant={isMobilePreview ? "mobile" : "default"} caption={result.caption} cta={result.cta} hashtags={result.hashtags} />
                        </div>
                      </div>

                      <div style={{ padding: 14, display: "grid", gap: 12 }}>
                        {/* CAPTION */}
                        <div className="swBlock swBlock--dark">
                          <div className="swBlock__head swBlock__head--dark">
                            <div className="swBlock__title">Caption</div>

                            <div className="swBlock__meta">
                              <span className="swCount swCount--dark">{(result.caption ?? "").length}</span>

                              <button className="btn btn--ghost" type="button" onClick={copyCaption} disabled={loading || proBlocked}>
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help swBlock__help--dark">Hook 150–180 • 1 idée • question finale</div>

                          <textarea
                            className="swEditor swEditor--caption swEditor--dark"
                            value={result.caption}
                            onChange={(e) => setResult((prev) => (prev ? { ...prev, caption: e.target.value } : prev))}
                            placeholder="Ta caption…"
                            style={{ minHeight: 260 }}
                          />
                        </div>

                        {/* CTA */}
                        <div className="swBlock swBlock--dark">
                          <div className="swBlock__head swBlock__head--dark">
                            <div className="swBlock__title">CTA</div>

                            <div className="swBlock__meta">
                              <span className="swCount swCount--dark">{(result.cta ?? "").length}</span>

                              <button className="btn btn--ghost" type="button" onClick={copyCTA} disabled={loading || proBlocked}>
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help swBlock__help--dark">Question ouverte • relance commentaires (&gt; 10 mots)</div>

                          <textarea
                            className="swEditor swEditor--cta swEditor--dark"
                            value={result.cta}
                            onChange={(e) => setResult((prev) => (prev ? { ...prev, cta: e.target.value } : prev))}
                            placeholder="Ta CTA… (idéal: question ouverte)"
                            style={{ minHeight: 110 }}
                          />
                        </div>

                        {/* HASHTAGS */}
                        <div className="swBlock swBlock--dark">
                          <div className="swBlock__head swBlock__head--dark">
                            <div className="swBlock__title">Hashtags</div>

                            <div className="swBlock__meta">
                              <span className="swCount swCount--dark">{(result.hashtags ?? "").length}</span>

                              <button className="btn btn--ghost" type="button" onClick={copyHashtags} disabled={loading || proBlocked}>
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help swBlock__help--dark">3–5 hashtags • niche • auto-ajout de # si oublié</div>

                          <textarea
                            className="swEditor swEditor--hashtags swEditor--dark"
                            value={result.hashtags}
                            onChange={(e) => {
                              const next = e.target.value;
                              const normalized = normalizeHashtagsInput(next);
                              setResult((prev) => (prev ? { ...prev, hashtags: normalized } : prev));
                            }}
                            onBlur={() => {
                              setResult((prev) => (prev ? { ...prev, hashtags: normalizeHashtagsInput(prev.hashtags) } : prev));
                            }}
                            placeholder="tag1 tag2 tag3 (ou #tag1 #tag2 #tag3)"
                            style={{ minHeight: 90 }}
                          />
                        </div>
                      </div>

                      {audit && (
                        <div className="panel panel--dark" style={{ padding: 16 }}>
                          <div className="auditHead">
                            <div className="auditTitle">Score LinkedIn 2026</div>

                            {badge && (
                              <span className={["scorePill", `scorePill--${badge.tone}`].join(" ")}>
                                {badge.label} • {audit.score}/100
                              </span>
                            )}
                          </div>

                          <div className="swChecks swChecks--dark">
                            <div className={["swCheck", "swCheck--dark", audit.checks.hookLength ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.hookLength ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">Hook 150–180 caractères</div>
                                <div className="swCheck__hint">
                                  Hook détecté : <b>{audit.details.hookLengthChars}</b> caractères
                                </div>
                              </div>
                            </div>

                            <div className={["swCheck", "swCheck--dark", audit.checks.singleIdea ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.singleIdea ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">1 seule idée (angle clair)</div>
                                <div className="swCheck__hint">
                                  Paragraphes : <b>{audit.details.paragraphCount}</b> (conseillé ≤ 7)
                                </div>
                              </div>
                            </div>

                            <div className={["swCheck", "swCheck--dark", audit.checks.openQuestion ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.openQuestion ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">Question ouverte en fin de post</div>
                                <div className="swCheck__hint">La caption ou la CTA doit finir par “?”</div>
                              </div>
                            </div>

                            <div className={["swCheck", "swCheck--dark", audit.checks.hashtagCount ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.hashtagCount ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">3–5 hashtags</div>
                                <div className="swCheck__hint">
                                  Hashtags détectés : <b>{audit.details.hashtagCount}</b>
                                </div>
                              </div>
                            </div>

                            <div className={["swCheck", "swCheck--dark", audit.checks.mobileReadable ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.mobileReadable ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">Lisibilité mobile (paragraphes courts)</div>
                                <div className="swCheck__hint">
                                  Paragraphes trop longs : <b>{audit.details.tooLongParagraphs}</b>
                                </div>
                              </div>
                            </div>
                          </div>

                          {audit.warnings.length > 0 && (
                            <div className="swWarnings swWarnings--dark">
                              <div className="swWarnings__title">Warnings (temps réel)</div>
                              <ul>
                                {audit.warnings.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div className="toastDark" role="status" aria-live="polite">
              {toast}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section section--dark">
        <div className="container">
          <div className="sectionHead">
            <div className="sectionTitle">FAQ</div>
            <div className="sectionDesc">Les 3 règles qui rendent un post “prêt à publier”.</div>
          </div>

          <div className="featuresGrid featuresGrid--ref">
            <div className="panel panel--dark" style={{ padding: 18 }}>
              <div className="panelKicker">Auto-sync</div>
              <div className="panelTitle">Hashtags</div>
              <div className="panelDesc">Tu peux taper sans # : on normalise automatiquement.</div>
            </div>

            <div className="panel panel--dark" style={{ padding: 18 }}>
              <div className="panelKicker">Auto-fix</div>
              <div className="panelTitle">Correction</div>
              <div className="panelDesc">On envoie ton post + score + warnings à l’IA pour corriger ce qui bloque.</div>
            </div>

            <div className="panel panel--dark" style={{ padding: 18 }}>
              <div className="panelKicker">Mode Pro</div>
              <div className="panelTitle">Qualité minimale</div>
              <div className="panelDesc">Copie bloquée si score &lt; 75.</div>
            </div>
          </div>

          <div className="footerRef">
            <div className="footerRef__left">
              <div className="footerRef__big">READY TO POST</div>
              <div className="footerRef__small">© {new Date().getFullYear()} SocialWriter — LinkedIn only.</div>
            </div>
            <div className="footerRef__right">
              <a href="#features">Fonctions</a>
              <a href="#generator">Générateur</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
