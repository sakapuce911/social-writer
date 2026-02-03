// src/app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

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
  if (score >= 85) return { label: "Excellent", bg: "rgba(143,227,214,0.22)", bd: "rgba(143,227,214,0.35)" };
  if (score >= 70) return { label: "Bon", bg: "rgba(255,216,106,0.22)", bd: "rgba(255,216,106,0.35)" };
  if (score >= 50) return { label: "Moyen", bg: "rgba(255,176,102,0.20)", bd: "rgba(255,176,102,0.32)" };
  return { label: "À améliorer", bg: "rgba(255,77,109,0.16)", bd: "rgba(255,77,109,0.28)" };
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
  // Hook = 1ère ligne non vide
  const firstLine = t.split("\n").map((s) => s.trim()).find(Boolean) ?? "";
  return firstLine.trim();
}

function extractHashtags(raw: string) {
  const tags = (raw ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [];
  // unique
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

/** ✅ Aperçu LinkedIn (hook + Voir plus) */
function LinkedInPreview(props: { caption: string; cta: string; hashtags: string }) {
  const { caption, cta, hashtags } = props;
  const [expanded, setExpanded] = useState(false);

  const fullText = useMemo(() => {
    const parts = [caption?.trim(), cta?.trim(), hashtags?.trim()].filter(Boolean);
    return parts.join("\n\n").trim();
  }, [caption, cta, hashtags]);

  const COLLAPSE_AT = 210;

  const collapsed = useMemo(() => {
    if (!fullText) return "";
    if (fullText.length <= COLLAPSE_AT) return fullText;
    return fullText.slice(0, COLLAPSE_AT).trimEnd();
  }, [fullText]);

  const showMore = fullText.length > COLLAPSE_AT;

  return (
    <div
      style={{
        border: "3px solid rgba(17,17,17,0.12)",
        borderRadius: 22,
        background: "rgba(255,255,255,0.90)",
        boxShadow: "0 12px 0 rgba(17,17,17,0.08)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 999, background: "rgba(17,17,17,0.10)" }} />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 950 }}>Vous</div>
          <div style={{ fontSize: 12, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>LinkedIn • Aperçu</div>
        </div>
      </div>

      <div style={{ marginTop: 12, whiteSpace: "pre-wrap", fontSize: 14, fontWeight: 800, color: "rgba(17,17,17,0.84)" }}>
        {!expanded ? collapsed : fullText}
        {showMore && !expanded && (
          <>
            {" "}
            <span style={{ color: "rgba(10,102,194,0.95)", fontWeight: 950 }}>… voir plus</span>
          </>
        )}
      </div>

      {showMore && (
        <button
          className="btn"
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ marginTop: 10 }}
        >
          {expanded ? "Réduire" : "Voir plus"}
        </button>
      )}
    </div>
  );
}

/** ✅ Gros SVG hero inline */
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
        </g>

        <g transform="translate(430 250)">
          <rect x="0" y="0" width="380" height="130" rx="26" fill="rgba(255,255,255,0.92)" stroke="rgba(17,17,17,0.14)" strokeWidth="4" />
          <text x="22" y="48" fontSize="18" fontWeight="950" fill="rgba(17,17,17,0.86)">
            CTA
          </text>
          <text x="22" y="82" fontSize="16" fontWeight="800" fill="rgba(17,17,17,0.70)">
            Une question qui lance une vraie discussion.
          </text>
        </g>

        <g transform="translate(240 410)">
          <rect x="0" y="0" width="560" height="150" rx="26" fill="rgba(255,255,255,0.92)" stroke="rgba(17,17,17,0.14)" strokeWidth="4" />
          <text x="22" y="48" fontSize="18" fontWeight="950" fill="rgba(17,17,17,0.86)">
            Hashtags
          </text>
          <text x="22" y="86" fontSize="16" fontWeight="800" fill="rgba(17,17,17,0.70)">
            3–5 hashtags de niche (en bas du post)
          </text>
        </g>
      </g>
    </svg>
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

  // ✅ Génération IA (déjà existant chez toi)
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

      const data = await res.json();

      if (!res.ok) {
        const msg = String(data?.error || "Erreur génération");
        if (res.status === 429 || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("resource_exhausted")) {
          setError(`Quota IA atteint (${QUOTA_DAILY}/jour). Réessaie demain.`);
          showToast("Quota IA atteint ⚠️");
          return;
        }
        throw new Error(msg);
      }

      const raw = String(data.output ?? "").trim();
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

  // ✅ Auto-fix IA (IMPORTANT)
  const onAutoFix = async () => {
    if (!result || !audit) {
      showToast("Génère un post d’abord ✅");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/autofix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          caption: result.caption,
          cta: result.cta,
          hashtags: result.hashtags,
          audit,
          language,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(String(data?.error || "Auto-fix IA échoué"));
      }

      const nextCaption = String(data.caption ?? "").trim();
      const nextCta = String(data.cta ?? "").trim();
      const nextTags = Array.isArray(data.hashtags) ? data.hashtags.join(" ") : String(data.hashtags ?? "");

      setResult({
        caption: nextCaption,
        cta: nextCta,
        hashtags: normalizeHashtagsInput(nextTags),
      });

      showToast("Auto-fix IA appliqué ✨");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Erreur Auto-fix IA.");
      showToast("Erreur Auto-fix IA");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

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
                  <b>LinkedIn uniquement</b> • IA optimisée 2026
                </span>
              </div>

              <h1 className="h1">
                Génère des posts LinkedIn <span className="accent">engageants</span> avec l’IA 😄
              </h1>

              <p className="lead">Texte + CTA + Hashtags, structurés pour maximiser la lecture et les conversations.</p>

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
              <div style={{ fontWeight: 950 }}>Auto-sync hashtags</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Tape “tag1 tag2” → ça devient “#tag1 #tag2”.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Auto-fix IA</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>L’IA corrige en utilisant le score + warnings LinkedIn.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Mode Pro</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>
                Bloque le copier-coller si le score est &lt; <b>75</b>.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GENERATOR */}
      <section id="generator" className="section section--tight">
        <div className="container">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 950, fontSize: 26 }}>Générateur LinkedIn</div>
            <div style={{ color: "var(--muted)", marginTop: 6 }}>Remplis. Clique. Édite. Auto-fix IA. Copie. Poste.</div>
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

                <div style={{ display: "grid", gap: 10 }}>
                  <button
                    className={["btn", "btn--primary", loading ? "btn--loading" : ""].join(" ").trim()}
                    onClick={generateWithAI}
                    disabled={!canGenerate || loading || aiCount >= QUOTA_DAILY}
                    style={{ width: "100%" }}
                    title={`Quota IA : ${QUOTA_DAILY}/jour`}
                  >
                    {loading ? (
                      <span className="loaderCartoon" aria-label="Chargement">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      `Générer avec IA (${remaining}/${QUOTA_DAILY})`
                    )}
                  </button>

                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                    ✨ IA restante aujourd’hui : {remaining}/{QUOTA_DAILY}
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
                    <div className="empty__sub">Génère, puis édite (caption/CTA/hashtags). Auto-fix IA est dispo.</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div className="result">
                      <div className="result__top">
                        <div style={{ fontWeight: 950 }}>Éditeur</div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <button className="btn" onClick={onAutoFix} disabled={loading || !audit} title="Auto-fix IA basé sur score + warnings">
                            Auto-fix IA ✨
                          </button>

                          <button className="btn" onClick={copyAll} disabled={loading || proBlocked} title={proBlocked ? `Mode Pro : score < ${PRO_MIN_SCORE}` : "Copier tout"}>
                            Copier tout
                          </button>

                          {audit && badge && (
                            <span style={{ padding: "8px 12px", borderRadius: 999, fontWeight: 950, border: "3px solid rgba(17,17,17,0.10)", background: "rgba(255,255,255,0.84)" }}>
                              {badge.label} • {audit.score}/100
                            </span>
                          )}
                        </div>
                      </div>

                      {proBlocked && (
                        <div className="swWarnings" style={{ marginTop: 12 }}>
                          <div className="swWarnings__title">Mode Pro : copie bloquée</div>
                          <div style={{ color: "var(--muted)", fontWeight: 900 }}>
                            Score &lt; {PRO_MIN_SCORE}. Corrige les warnings (ou clique Auto-fix IA).
                          </div>
                        </div>
                      )}

                      {/* ✅ Aperçu LinkedIn réel */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontWeight: 950, marginBottom: 8 }}>Aperçu LinkedIn</div>
                        <LinkedInPreview caption={result.caption} cta={result.cta} hashtags={result.hashtags} />
                      </div>

                      <div style={{ padding: 14, display: "grid", gap: 12 }}>
                        {/* ===== CAPTION ===== */}
                        <div className="swBlock">
                          <div className="swBlock__head">
                            <div className="swBlock__title">Caption</div>

                            <div className="swBlock__meta">
                              <span className="swCount">{(result.caption ?? "").length}</span>

                              <button className="btn" type="button" onClick={copyCaption} disabled={loading || proBlocked}>
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help">Hook 150–180 • 1 idée • question finale</div>

                          <textarea
                            className="swEditor swEditor--caption"
                            value={result.caption}
                            onChange={(e) => setResult((prev) => (prev ? { ...prev, caption: e.target.value } : prev))}
                            placeholder="Ta caption…"
                            style={{ minHeight: 260 }}
                          />
                        </div>

                        {/* ===== CTA ===== */}
                        <div className="swBlock">
                          <div className="swBlock__head">
                            <div className="swBlock__title">CTA</div>

                            <div className="swBlock__meta">
                              <span className="swCount">{(result.cta ?? "").length}</span>

                              <button className="btn" type="button" onClick={copyCTA} disabled={loading || proBlocked}>
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help">Question ouverte • relance commentaires (&gt; 10 mots)</div>

                          <textarea
                            className="swEditor swEditor--cta"
                            value={result.cta}
                            onChange={(e) => setResult((prev) => (prev ? { ...prev, cta: e.target.value } : prev))}
                            placeholder="Ta CTA… (idéal: question ouverte)"
                            style={{ minHeight: 110 }}
                          />
                        </div>

                        {/* ===== HASHTAGS ===== */}
                        <div className="swBlock">
                          <div className="swBlock__head">
                            <div className="swBlock__title">Hashtags</div>

                            <div className="swBlock__meta">
                              <span className="swCount">{(result.hashtags ?? "").length}</span>

                              <button className="btn" type="button" onClick={copyHashtags} disabled={loading || proBlocked}>
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help">3–5 hashtags • niche • auto-ajout de # si oublié</div>

                          <textarea
                            className="swEditor swEditor--hashtags"
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
                        <div className="panel" style={{ padding: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 950, fontSize: 18 }}>Score LinkedIn 2026</div>

                            {badge && (
                              <span style={{ padding: "8px 12px", borderRadius: 999, fontWeight: 950, border: `3px solid ${badge.bd}`, background: badge.bg }}>
                                {badge.label} • {audit.score}/100
                              </span>
                            )}
                          </div>

                          <div className="swChecks">
                            <div className={["swCheck", audit.checks.hookLength ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.hookLength ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">Hook 150–180 caractères</div>
                                <div className="swCheck__hint">
                                  Hook détecté : <b>{audit.details.hookLengthChars}</b> caractères
                                </div>
                              </div>
                            </div>

                            <div className={["swCheck", audit.checks.singleIdea ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.singleIdea ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">1 seule idée (angle clair)</div>
                                <div className="swCheck__hint">
                                  Paragraphes : <b>{audit.details.paragraphCount}</b> (conseillé ≤ 7)
                                </div>
                              </div>
                            </div>

                            <div className={["swCheck", audit.checks.openQuestion ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.openQuestion ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">Question ouverte en fin de post</div>
                                <div className="swCheck__hint">La caption ou la CTA doit finir par “?”</div>
                              </div>
                            </div>

                            <div className={["swCheck", audit.checks.hashtagCount ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
                              <div className="swCheck__icon">{audit.checks.hashtagCount ? "✓" : "✗"}</div>
                              <div className="swCheck__text">
                                <div className="swCheck__label">3–5 hashtags</div>
                                <div className="swCheck__hint">
                                  Hashtags détectés : <b>{audit.details.hashtagCount}</b>
                                </div>
                              </div>
                            </div>

                            <div className={["swCheck", audit.checks.mobileReadable ? "swCheck--ok" : "swCheck--bad"].join(" ").trim()}>
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
                            <div className="swWarnings">
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
              <div style={{ fontWeight: 950 }}>Auto-sync hashtags</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Tu peux taper sans # : on normalise automatiquement.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Auto-fix IA</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>On envoie ton post + score + warnings à l’IA qui corrige vraiment.</div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 950 }}>Mode Pro</div>
              <div style={{ color: "var(--muted)", marginTop: 6 }}>Copie bloquée si score &lt; 75.</div>
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
