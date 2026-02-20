// src/app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import LinkedInPreview from "./LinkedInPreview";

// ✅ Types (IA-only)
type Objective = "éduquer" | "inspirer" | "sarcasme";
type Gender = "masculin" | "feminin";
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

function safeObjective(input: unknown): Objective {
  const v = String(input ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (v === "eduquer" || v === "éduquer") return "éduquer";
  if (v === "inspirer") return "inspirer";
  if (v === "sarcasme") return "sarcasme";
  return "inspirer";
}

function safeGender(input: unknown): Gender {
  const v = String(input ?? "").trim().toLowerCase();
  if (v === "feminin" || v === "féminin" || v === "female" || v === "f") return "feminin";
  if (v === "masculin" || v === "male" || v === "m") return "masculin";
  return "masculin";
}

function normalizeFromLLM(raw: string): { caption: string; cta: string; hashtags: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { caption: "", cta: "", hashtags: "" };

  // JSON strict
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const caption = String(obj.caption ?? "").trim();
      const cta = String(obj.cta ?? "").trim();
      const hashtags = Array.isArray(obj.hashtags)
        ? obj.hashtags.join(" ").trim()
        : String(obj.hashtags ?? "").trim();
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

/** ✅ Helpers audit LinkedIn */
function splitParagraphs(text: string) {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  return raw
    .split(/\n\s*\n+/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function getHook(caption: string) {
  const t = (caption ?? "").trim();
  if (!t) return "";
  const firstLine =
    t
      .split("\n")
      .map((s) => s.trim())
      .find(Boolean) ?? "";
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

function computeLinkedInAudit(args: {
  subject: string;
  caption: string;
  cta: string;
  hashtags: string;
  language: Lang;
}): LinkedInAudit {
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
  const mobileReadableOk =
    paragraphs.length === 0 ? false : tooLong === 0 && shortOk / paragraphs.length >= 0.65;

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

  if (!singleIdeaOk)
    warnings.push("Trop d’éléments : garde 1 seule idée (moins de paragraphes / moins de listes).");
  if (!openQuestionOk) warnings.push("Pas de question finale : termine par une question ouverte.");
  if (!hashtagCountOk)
    warnings.push(`Hashtags : ${hashtagCount} détecté(s). Il en faut 3–5 (de niche).`);
  if (!mobileReadableOk)
    warnings.push("Lisibilité mobile : paragraphes trop longs. Fais des blocs courts (1–2 lignes).");

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
    <div className="statCard swMotion swHoverLift" data-reveal>
      <div className="statCard__label">{label}</div>
      <div className="statCard__value">{value}</div>
      <div className="statCard__hint">{hint}</div>
    </div>
  );
}

function MiniStep({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="miniStep swMotion swHoverLift" data-reveal>
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

function objectiveLabel(o: Objective) {
  if (o === "inspirer") return "Inspirer";
  if (o === "sarcasme") return "Sarcasme";
  return "Éduquer";
}

function genderLabel(g: Gender) {
  return g === "feminin" ? "Féminin" : "Masculin";
}

/**
 * ✅ Clé stable (sert uniquement à bloquer double-clic pendant un call)
 */
function makeClientKey(args: {
  subject: string;
  language: Lang;
  objective: Objective;
  gender: Gender;
  network: Network;
}) {
  const s = args.subject.trim().replace(/\s+/g, " ");
  return JSON.stringify({
    subject: s,
    language: args.language,
    objective: args.objective,
    gender: args.gender,
    network: args.network,
  });
}

/**
 * ✅ fetch avec timeout + abort
 */
async function fetchJsonWithTimeout(url: string, init: RequestInit & { timeoutMs?: number }) {
  const timeoutMs = init.timeoutMs ?? 20000;
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    window.clearTimeout(t);
  }
}

function ProgressPill({ stepLabel, subLabel }: { stepLabel: string; subLabel: string }) {
  return (
    <div className="swProgress swMotion" role="status" aria-live="polite">
      <span className="swProgress__dot" aria-hidden="true" />
      <div style={{ display: "grid", gap: 2 }}>
        <div className="swProgress__txt">{stepLabel}</div>
        <div className="swProgress__sub">{subLabel}</div>
      </div>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="skeleton swMotion">
      <div className="skeleton__pad">
        <div className="skelLine skelLine--lg" />
        <div className="skelLine" />
        <div className="skelLine skelLine--sm" />
        <div className="skelLine" />
        <div className="skelLine" />
        <div className="skelLine skelLine--sm" />
        <div className="skelLine" />
        <div className="skelLine" />
        <div className="skelLine skelLine--sm" />
      </div>
    </div>
  );
}

export default function Page() {
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState<Lang>("fr");
  const [objective, setObjective] = useState<Objective>("inspirer");
  const [gender, setGender] = useState<Gender>("masculin");
  const network: Network = "linkedin";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ caption: string; cta: string; hashtags: string } | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // ✅ Mode Pro (INFO uniquement : la copie n’est PLUS bloquée)
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

  // ✅ respects prefers-reduced-motion
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(Boolean(mq.matches));
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

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
        showToast("Impossible de copier");
      } catch {
        showToast("Impossible de copier");
      }
    }
  }

  // ✅ Audit temps réel
  const audit = useMemo<LinkedInAudit | null>(() => {
    if (!result) return null;
    const hasAny =
      (result.caption ?? "").trim() || (result.cta ?? "").trim() || (result.hashtags ?? "").trim();
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

  // ✅ IMPORTANT: plus de blocage de copie (on garde juste l’info)
  const proBlocked = false;

  const remaining = Math.max(0, QUOTA_DAILY - aiCount);

  /**
   * ✅ Anti double-call client
   * - abort précédent si relance
   * - bloque double-clic pendant un call
   * - ignore les réponses “anciennes” (race condition)
   */
  const lastClientKeyRef = useRef<string | null>(null);
  const inflightAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // ✅ Progress steps UI (pure front)
  const [progressStep, setProgressStep] = useState(0);
  const progressTimerRef = useRef<number | null>(null);

  const progressMeta = useMemo(() => {
    const steps = [
      { label: "Analyse du sujet…", sub: "Je détecte l’angle + le ton" },
      { label: "Structure du post…", sub: "Hook + rythme mobile + liste" },
      { label: "Rédaction…", sub: "Story + conseils actionnables" },
      { label: "Finalisation…", sub: "CTA + hashtags + cohérence" },
    ];
    const safe = Math.max(0, Math.min(steps.length - 1, progressStep));
    return { steps, current: steps[safe], pct: (safe + 1) / steps.length };
  }, [progressStep]);

  function startProgress() {
    setProgressStep(0);
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = window.setInterval(() => {
      setProgressStep((s) => (s < 3 ? s + 1 : 3));
    }, 950);
  }

  function stopProgress() {
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
    setProgressStep(0);
  }

  // ✅ Reveal on scroll (premium, LinkedIn-like)
  useEffect(() => {
    if (!mounted) return;
    if (reduceMotion) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!els.length) return;

    for (const el of els) el.classList.add("swReveal");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("swRevealIn");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "60px 0px -10% 0px" }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [mounted, reduceMotion]);

  // ✅ Génération IA (FULL IA : pas de cache)
  async function generateWithAI() {
    setError(null);

    const cleanSubject = subject.trim();
    if (!cleanSubject) {
      setError("Le sujet est obligatoire.");
      showToast("Sujet manquant ⚠️");
      return;
    }

    if (aiCount >= QUOTA_DAILY) {
      setError(`Quota IA atteint (${QUOTA_DAILY}/jour). Réessaie demain.`);
      showToast("Quota IA atteint ⚠️");
      return;
    }

    const obj = safeObjective(objective);
    const gen = safeGender(gender);

    const clientKey = makeClientKey({ subject: cleanSubject, language, objective: obj, gender: gen, network });

    if (loading && lastClientKeyRef.current === clientKey) {
      showToast("Déjà en cours…");
      return;
    }

    if (inflightAbortRef.current) {
      inflightAbortRef.current.abort();
      inflightAbortRef.current = null;
    }

    const controller = new AbortController();
    inflightAbortRef.current = controller;

    setLoading(true);
    startProgress();

    const myRequestId = ++requestIdRef.current;
    lastClientKeyRef.current = clientKey;

    try {
      const { res, data } = await fetchJsonWithTimeout("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: cleanSubject,
          language,
          objective: obj,
          gender: gen,
          network,
        }),
        signal: controller.signal,
        timeoutMs: 20000,
      });

      if (myRequestId !== requestIdRef.current) return;

      if (!res.ok) {
        const code = String((data as any)?.code ?? "");
        const msg = String((data as any)?.error || "Erreur génération");

        if (
          res.status === 429 ||
          code === "quota" ||
          msg.toLowerCase().includes("quota") ||
          msg.toLowerCase().includes("resource_exhausted")
        ) {
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

      const raw = String((data as any)?.output ?? "").trim();
      if (!raw) throw new Error("Réponse vide.");

      const parsed = normalizeFromLLM(raw);
      parsed.hashtags = normalizeHashtagsInput(parsed.hashtags);

      setResult(parsed);

      setTimeout(() => {
        const el = document.getElementById("resultBlock");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);

      incAiCount();
      showToast(`Généré • ${objectiveLabel(obj)} • ${genderLabel(gen)} ✨`);
    } catch (e: any) {
      const aborted = e?.name === "AbortError" || String(e?.message ?? "").toLowerCase().includes("aborted");
      if (aborted) {
        showToast("Requête annulée");
        return;
      }

      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Une erreur est survenue.");
    } finally {
      if (myRequestId === requestIdRef.current) {
        setLoading(false);
        inflightAbortRef.current = null;
        stopProgress();
      }
    }
  }

  const copyAll = () => {
    if (!result) return;

    if (audit && audit.score < PRO_MIN_SCORE) {
      showToast(`Score ${audit.score}/100 : tu peux copier, mais tu peux encore optimiser.`);
    }

    const parts = [result.caption, result.cta, result.hashtags].filter(Boolean);
    copy(parts.join("\n\n").trim());
  };

  const copyCaption = () => {
    if (!result) return;
    if (audit && audit.score < PRO_MIN_SCORE) {
      showToast(`Score ${audit.score}/100 : tu peux copier, mais tu peux encore optimiser.`);
    }
    copy(result.caption);
  };

  const copyCTA = () => {
    if (!result) return;
    if (audit && audit.score < PRO_MIN_SCORE) {
      showToast(`Score ${audit.score}/100 : tu peux copier, mais tu peux encore optimiser.`);
    }
    copy(result.cta);
  };

  const copyHashtags = () => {
    if (!result) return;
    if (audit && audit.score < PRO_MIN_SCORE) {
      showToast(`Score ${audit.score}/100 : tu peux copier, mais tu peux encore optimiser.`);
    }
    copy(result.hashtags);
  };

  if (!mounted) return null;

  return (
    <div className={["page", "page--dark", reduceMotion ? "swReduceMotion" : ""].join(" ").trim()}>
      {/* ✅ V2 PREMIUM MOTION (1 fichier, no CSS edits ailleurs) */}
      <style jsx global>{`
        /* ===== V2 Premium (LinkedIn-like) ===== */

        .swReduceMotion * {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }

        /* Smooth press / hover */
        .swMotion {
          transition: transform 260ms ease, box-shadow 260ms ease, opacity 260ms ease, filter 260ms ease;
          will-change: transform;
        }
        .swHoverLift:hover {
          transform: translateY(-2px);
          filter: saturate(1.03);
        }
        .swPress:active {
          transform: translateY(0px) scale(0.99);
        }

        /* Reveal on scroll */
        .swReveal {
          opacity: 0;
          transform: translateY(10px);
        }
        .swRevealIn {
          opacity: 1;
          transform: translateY(0px);
          transition: opacity 520ms ease, transform 520ms cubic-bezier(0.2, 0.7, 0.2, 1);
        }

        /* Premium subtle background */
        .swBackdrop {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.9;
        }
        .swBackdrop::before {
          content: "";
          position: absolute;
          inset: -40px;
          background:
            radial-gradient(800px 420px at 15% 10%, rgba(98, 84, 255, 0.16), transparent 55%),
            radial-gradient(720px 380px at 80% 20%, rgba(0, 198, 255, 0.12), transparent 55%),
            radial-gradient(720px 420px at 55% 85%, rgba(120, 255, 180, 0.08), transparent 60%);
          filter: blur(10px);
          animation: swGlowMove 9.5s ease-in-out infinite alternate;
        }
        .swBackdrop::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E");
          opacity: 0.22;
          mix-blend-mode: overlay;
        }
        @keyframes swGlowMove {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.9;
          }
          100% {
            transform: translate3d(0, -18px, 0) scale(1.03);
            opacity: 1;
          }
        }

        /* Nav polish */
        .nav--dark {
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .nav--dark::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.12),
            transparent
          );
          opacity: 0.9;
        }

        /* Mobile menu smooth */
        .nav__mobile {
          animation: swMenuIn 220ms ease;
          transform-origin: top center;
        }
        @keyframes swMenuIn {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Buttons */
        .btn {
          transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease, filter 180ms ease;
        }
        .btn:hover {
          transform: translateY(-1px);
        }
        .btn:active {
          transform: translateY(0px) scale(0.99);
        }

        /* Progress bar animate */
        .swBar {
          height: 10px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.06);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
        }
        .swBar__fill {
          height: 100%;
          width: var(--swP, 25%);
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(98, 84, 255, 0.9), rgba(0, 198, 255, 0.75));
          transition: width 520ms cubic-bezier(0.2, 0.7, 0.2, 1);
        }

        /* Editor panel subtle lift */
        .panel--tool {
          position: relative;
          z-index: 1;
        }
        .panel--tool[data-reveal] {
          opacity: 0;
          transform: translateY(10px);
        }
        .panel--tool.swRevealIn {
          opacity: 1;
          transform: translateY(0px);
        }

        /* Result overlay soften */
        .swLoadingOverlay {
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
      `}</style>

      {/* Background */}
      <div className="swBackdrop" aria-hidden="true" />

      {/* NAV */}
      <header className="nav nav--dark swMotion" data-reveal>
        <div className="nav__inner">
          <div className="brand swMotion">
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
            <a className="swMotion" href="#features">
              Fonctions
            </a>
            <a className="swMotion" href="#generator">
              Générateur
            </a>
            <a className="swMotion" href="#faq">
              FAQ
            </a>
          </nav>

          <div className="nav__cta">
            <button
              className="burger swMotion swPress"
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
              className="btn btn--ghost swPress"
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

            <a className="btn btn--primary swPress" href="#generator">
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
              <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                <h1 className="heroTitle swMotion" style={{ marginTop: 0 }} data-reveal>
                  ÉCRIVEZ DES POSTS <span className="accent">LINKEDIN</span> QUI DÉCLENCHENT DES IMPRÉSSIONS
                </h1>

                <p className="heroSub swMotion" style={{ marginTop: 0 }} data-reveal>
                  Texte + CTA + Hashtags, optimisés pour la lecture mobile, la clarté, et l’engagement réel (conversation
                  early).
                </p>

                <div className="heroActions swMotion" style={{ marginTop: 2 }} data-reveal>
                  <a className="btn btn--primary btn--xl swPress" href="#generator">
                    Générer mon post
                  </a>
                  <a className="btn btn--ghost btn--xl swPress" href="#features">
                    Voir les fonctions
                  </a>
                </div>

                <div className="statsGrid" style={{ marginTop: 6 }}>
                  <StatCard label="Mode Pro" value="75/100" hint="Score recommandé" />
                  <StatCard label="Audit" value="Temps réel" hint="Hook • Lisibilité • Hashtags • Question" />
                  <StatCard
                    label="Quota IA"
                    value={`${Math.max(0, QUOTA_DAILY - aiCount)}/${QUOTA_DAILY}`}
                    hint="Restant aujourd’hui"
                  />
                </div>
              </div>
            </div>

            <div className="heroRight">
              <div className="heroArtRef swMotion" data-reveal>
                <div className="heroStack">
                  <div className="heroTile heroTile--big swMotion swHoverLift">
                    <div className="heroTile__title">Aperçu “post LinkedIn”</div>
                    <div className="heroTile__sub">Avant de publier, tu vois ce que ça donne.</div>

                    <div className="heroPreviewFrame" style={{ marginTop: 12 }}>
                      <LinkedInPreview
                        variant={isMobilePreview ? "mobile" : "desktop"}
                        authorName="Vous"
                        authorHeadline="Créateur • SocialWriter"
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
          <div className="sectionHead swMotion" data-reveal>
            <div className="sectionTitle">Fonctions</div>
            <div className="sectionDesc">Tout est pensé pour LinkedIn : structure, audit, et copier-coller propre.</div>
          </div>

          <div className="featuresGrid featuresGrid--ref">
            <div className="panel panel--dark swMotion swHoverLift" style={{ padding: 18 }} data-reveal>
              <div className="panelKicker">Auto-sync</div>
              <div className="panelTitle">Hashtags auto-normalisés</div>
              <div className="panelDesc">Tape “tag1 tag2” → ça devient “#tag1 #tag2” (unique, propre, stable).</div>
            </div>

            <div className="panel panel--dark swMotion swHoverLift" style={{ padding: 18 }} data-reveal>
              <div className="panelKicker">Audit</div>
              <div className="panelTitle">Score LinkedIn temps réel</div>
              <div className="panelDesc">Hook • Lisibilité mobile • Hashtags • Question finale — tout est mesuré.</div>
            </div>

            <div className="panel panel--dark swMotion swHoverLift" style={{ padding: 18 }} data-reveal>
              <div className="panelKicker">Mode Pro</div>
              <div className="panelTitle">Qualité recommandée</div>
              <div className="panelDesc">Objectif : score ≥ 75 (mais la copie reste autorisée).</div>
            </div>
          </div>
        </div>
      </section>

      {/* GENERATOR */}
      <section id="generator" className="section section--dark section--tight">
        <div className="container">
          <div className="sectionHead swMotion" data-reveal>
            <div className="sectionTitle">Générateur LinkedIn</div>
            <div className="sectionDesc">Remplis → génère → édite → copie → publie.</div>
          </div>

          <div className="panel panel--dark panel--tool swMotion" data-reveal>
            <div className="panel__grid panel__grid--ref">
              {/* LEFT */}
              <div className="panel__left panel__left--dark">
                <div className="field">
                  <div className="field__label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Sujet</span>
                    <span className="field__meta">{subjectCount} caractères</span>
                  </div>
                  <textarea
                    className="input input--dark swMotion"
                    rows={4}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Pourquoi on doit booster notre productivité ?"
                  />
                </div>

                <div className="row">
                  <div className="field">
                    <div className="field__label">Langue</div>
                    <select
                      className="input input--dark swMotion"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Lang)}
                    >
                      <option value="fr">Français</option>
                      <option value="en">Anglais</option>
                    </select>
                  </div>

                  <div className="field">
                    <div className="field__label">Style</div>
                    <select
                      className="input input--dark swMotion"
                      value={objective}
                      onChange={(e) => setObjective(e.target.value as Objective)}
                    >
                      <option value="inspirer">Inspirer</option>
                      <option value="sarcasme">Sarcasme</option>
                      <option value="éduquer">Éduquer</option>
                    </select>
                  </div>
                </div>

                {/* ✅ Genre */}
                <div className="row">
                  <div className="field">
                    <div className="field__label">Genre</div>
                    <select
                      className="input input--dark swMotion"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                    >
                      <option value="masculin">Masculin (narrateur)</option>
                      <option value="feminin">Féminin (narratrice)</option>
                    </select>
                  </div>

                  <div className="field" aria-hidden="true" style={{ opacity: 0 }}>
                    <div className="field__label">.</div>
                    <select className="input input--dark" disabled>
                      <option>.</option>
                    </select>
                  </div>
                </div>

                {/* ✅ Progress status */}
                {loading && (
                  <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                    <ProgressPill stepLabel={progressMeta.current.label} subLabel={progressMeta.current.sub} />
                    <div className="swBar" aria-hidden="true">
                      <div className="swBar__fill" style={{ width: `${Math.round(progressMeta.pct * 100)}%` } as any} />
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gap: 10 }}>
                  <button
                    className={["btn", "btn--primary", "btn--xl", "swPress", loading ? "btn--loading" : ""]
                      .join(" ")
                      .trim()}
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
                  <div className="alert alert--dark swMotion" data-reveal>
                    <b>Erreur :</b> {error}
                  </div>
                )}

                <div className="proNote swMotion swHoverLift" data-reveal>
                  <div className="proNote__title">Mode Pro</div>
                  <div className="proNote__desc">
                    Objectif score ≥ {PRO_MIN_SCORE}. (Copie toujours autorisée.) Utilise l’audit pour améliorer vite.
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="panel__right panel__right--dark" id="resultBlock">
                {loading && !result ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <ResultSkeleton />
                    <ResultSkeleton />
                  </div>
                ) : !result ? (
                  <div className="empty empty--dark swMotion" data-reveal>
                    <div className="empty__icon">📝</div>
                    <div className="empty__title">Tes résultats apparaîtront ici</div>
                    <div className="empty__sub">Génère, puis édite (caption/CTA/hashtags) et copie proprement.</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div className="result result--dark swMotion" style={{ position: "relative" }} data-reveal>
                      {loading && (
                        <div className="swLoadingOverlay" aria-hidden="true">
                          <ProgressPill stepLabel={progressMeta.current.label} subLabel={progressMeta.current.sub} />
                        </div>
                      )}

                      <div className="result__top result__top--dark">
                        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 950, letterSpacing: "-0.2px" }}>Éditeur</div>
                          <span style={{ opacity: 0.55 }}>•</span>
                          <span style={{ opacity: 0.85, fontWeight: 800 }}>
                            {objectiveLabel(safeObjective(objective))} • {genderLabel(safeGender(gender))}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridAutoFlow: "column",
                            justifyContent: "end",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {audit && badge && (
                            <span
                              className={["scorePill", `scorePill--${badge.tone}`].join(" ")}
                              style={{
                                padding: "7px 10px",
                                fontSize: 13,
                                lineHeight: 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {badge.label} • {audit.score}/100
                            </span>
                          )}

                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                              justifyContent: "flex-end",
                              alignItems: "center",
                            }}
                          >
                            <button
                              className="btn btn--ghost swPress"
                              onClick={copyAll}
                              disabled={loading || proBlocked}
                              title="Copier tout"
                            >
                              Copier tout
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: 14, display: "grid", gap: 14 }}>
                        <div style={{ display: "grid", gap: 10 }}>
                          <div
                            className="subTitle"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 10,
                              margin: 0,
                            }}
                          >
                            <span style={{ fontWeight: 950 }}>Aperçu LinkedIn</span>
                            <span style={{ opacity: 0.7, fontSize: 12, fontWeight: 800 }}>
                              {isMobilePreview ? "Mode mobile" : "Mode desktop"}
                            </span>
                          </div>

                          <div className="previewWrap swMotion swHoverLift">
                            <LinkedInPreview
                              variant={isMobilePreview ? "mobile" : "desktop"}
                              authorName="Vous"
                              authorHeadline="Créateur • SocialWriter"
                              caption={result.caption}
                              cta={result.cta}
                              hashtags={result.hashtags}
                            />
                          </div>
                        </div>

                        {/* CAPTION */}
                        <div className="swBlock swBlock--dark swMotion swHoverLift" data-reveal>
                          <div className="swBlock__head swBlock__head--dark">
                            <div className="swBlock__title">Caption</div>

                            <div className="swBlock__meta">
                              <span className="swCount swCount--dark">{(result.caption ?? "").length}</span>

                              <button
                                className="btn btn--ghost swPress"
                                type="button"
                                onClick={() => copyCaption()}
                                disabled={loading || proBlocked}
                              >
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help swBlock__help--dark">Hook 150–180 • 1 idée • question finale</div>

                          <textarea
                            className="swEditor swEditor--caption swEditor--dark swMotion"
                            value={result.caption}
                            onChange={(e) => setResult((prev) => (prev ? { ...prev, caption: e.target.value } : prev))}
                            placeholder="Ta caption…"
                            style={{ minHeight: 260 }}
                          />
                        </div>

                        {/* CTA */}
                        <div className="swBlock swBlock--dark swMotion swHoverLift" data-reveal>
                          <div className="swBlock__head swBlock__head--dark">
                            <div className="swBlock__title">CTA</div>

                            <div className="swBlock__meta">
                              <span className="swCount swCount--dark">{(result.cta ?? "").length}</span>

                              <button
                                className="btn btn--ghost swPress"
                                type="button"
                                onClick={() => copyCTA()}
                                disabled={loading || proBlocked}
                              >
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help swBlock__help--dark">
                            Question ouverte • relance commentaires (&gt; 10 mots)
                          </div>

                          <textarea
                            className="swEditor swEditor--cta swEditor--dark swMotion"
                            value={result.cta}
                            onChange={(e) => setResult((prev) => (prev ? { ...prev, cta: e.target.value } : prev))}
                            placeholder="Ta CTA… (idéal: question ouverte)"
                            style={{ minHeight: 110 }}
                          />
                        </div>

                        {/* HASHTAGS */}
                        <div className="swBlock swBlock--dark swMotion swHoverLift" data-reveal>
                          <div className="swBlock__head swBlock__head--dark">
                            <div className="swBlock__title">Hashtags</div>

                            <div className="swBlock__meta">
                              <span className="swCount swCount--dark">{(result.hashtags ?? "").length}</span>

                              <button
                                className="btn btn--ghost swPress"
                                type="button"
                                onClick={() => copyHashtags()}
                                disabled={loading || proBlocked}
                              >
                                Copier
                              </button>
                            </div>
                          </div>

                          <div className="swBlock__help swBlock__help--dark">
                            3–5 hashtags • niche • auto-ajout de # si oublié
                          </div>

                          <textarea
                            className="swEditor swEditor--hashtags swEditor--dark swMotion"
                            value={result.hashtags}
                            onChange={(e) => {
                              const next = e.target.value;
                              const normalized = normalizeHashtagsInput(next);
                              setResult((prev) => (prev ? { ...prev, hashtags: normalized } : prev));
                            }}
                            onBlur={() => {
                              setResult((prev) =>
                                prev ? { ...prev, hashtags: normalizeHashtagsInput(prev.hashtags) } : prev
                              );
                            }}
                            placeholder="tag1 tag2 tag3 (ou #tag1 #tag2 #tag3)"
                            style={{ minHeight: 90 }}
                          />
                        </div>

                        {/* AUDIT */}
                        {audit && (
                          <div className="panel panel--dark swMotion swHoverLift" style={{ padding: 16 }} data-reveal>
                            <div className="auditHead">
                              <div className="auditTitle">Score LinkedIn</div>

                              {badge && (
                                <span className={["scorePill", `scorePill--${badge.tone}`].join(" ")}>
                                  {badge.label} • {audit.score}/100
                                </span>
                              )}
                            </div>

                            <div className="swChecks swChecks--dark">
                              <div
                                className={[
                                  "swCheck",
                                  "swCheck--dark",
                                  audit.checks.hookLength ? "swCheck--ok" : "swCheck--bad",
                                ]
                                  .join(" ")
                                  .trim()}
                              >
                                <div className="swCheck__icon">{audit.checks.hookLength ? "✓" : "✗"}</div>
                                <div className="swCheck__text">
                                  <div className="swCheck__label">Hook 150–180 caractères</div>
                                  <div className="swCheck__hint">
                                    Hook détecté : <b>{audit.details.hookLengthChars}</b> caractères
                                  </div>
                                </div>
                              </div>

                              <div
                                className={[
                                  "swCheck",
                                  "swCheck--dark",
                                  audit.checks.singleIdea ? "swCheck--ok" : "swCheck--bad",
                                ]
                                  .join(" ")
                                  .trim()}
                              >
                                <div className="swCheck__icon">{audit.checks.singleIdea ? "✓" : "✗"}</div>
                                <div className="swCheck__text">
                                  <div className="swCheck__label">1 seule idée (angle clair)</div>
                                  <div className="swCheck__hint">
                                    Paragraphes : <b>{audit.details.paragraphCount}</b> (conseillé ≤ 7)
                                  </div>
                                </div>
                              </div>

                              <div
                                className={[
                                  "swCheck",
                                  "swCheck--dark",
                                  audit.checks.openQuestion ? "swCheck--ok" : "swCheck--bad",
                                ]
                                  .join(" ")
                                  .trim()}
                              >
                                <div className="swCheck__icon">{audit.checks.openQuestion ? "✓" : "✗"}</div>
                                <div className="swCheck__text">
                                  <div className="swCheck__label">Question ouverte en fin de post</div>
                                  <div className="swCheck__hint">La caption ou la CTA doit finir par “?”</div>
                                </div>
                              </div>

                              <div
                                className={[
                                  "swCheck",
                                  "swCheck--dark",
                                  audit.checks.hashtagCount ? "swCheck--ok" : "swCheck--bad",
                                ]
                                  .join(" ")
                                  .trim()}
                              >
                                <div className="swCheck__icon">{audit.checks.hashtagCount ? "✓" : "✗"}</div>
                                <div className="swCheck__text">
                                  <div className="swCheck__label">3–5 hashtags</div>
                                  <div className="swCheck__hint">
                                    Hashtags détectés : <b>{audit.details.hashtagCount}</b>
                                  </div>
                                </div>
                              </div>

                              <div
                                className={[
                                  "swCheck",
                                  "swCheck--dark",
                                  audit.checks.mobileReadable ? "swCheck--ok" : "swCheck--bad",
                                ]
                                  .join(" ")
                                  .trim()}
                              >
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
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div className="toastDark swMotion" role="status" aria-live="polite">
              {toast}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section section--dark">
        <div className="container">
          <div className="sectionHead swMotion" data-reveal>
            <div className="sectionTitle">FAQ</div>
            <div className="sectionDesc">Les 3 règles qui rendent un post “prêt à publier”.</div>
          </div>

          <div className="featuresGrid featuresGrid--ref">
            <div className="panel panel--dark swMotion swHoverLift" style={{ padding: 18 }} data-reveal>
              <div className="panelKicker">Auto-sync</div>
              <div className="panelTitle">Hashtags</div>
              <div className="panelDesc">Tu peux taper sans # : on normalise automatiquement.</div>
            </div>

            <div className="panel panel--dark swMotion swHoverLift" style={{ padding: 18 }} data-reveal>
              <div className="panelKicker">Audit</div>
              <div className="panelTitle">Score</div>
              <div className="panelDesc">Tu vois immédiatement ce qui bloque : hook, question finale, lisibilité, hashtags.</div>
            </div>

            <div className="panel panel--dark swMotion swHoverLift" style={{ padding: 18 }} data-reveal>
              <div className="panelKicker">Mode Pro</div>
              <div className="panelTitle">Qualité recommandée</div>
              <div className="panelDesc">Objectif : score ≥ 75 (copie autorisée).</div>
            </div>
          </div>

          <div className="footerRef swMotion" data-reveal>
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