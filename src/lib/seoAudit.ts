// src/lib/seoAudit.ts
// LinkedIn Score 2026 — remplace entièrement le SEO check

export type SeoAudit = {
  score: number; // 0..100
  checks: {
    hookLength: boolean;
    singleIdea: boolean;
    openQuestion: boolean;
    hashtagCount: boolean;
    mobileReadable: boolean;
  };
  details: {
    hookLengthChars: number;
    hashtagCount: number;
    paragraphCount: number;
  };
  suggestions: string[];
};

/* =========================
   Utils
========================= */

function splitParagraphs(text: string) {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  return raw.split(/\n\s*\n+/g).map((p) => p.trim()).filter(Boolean);
}

function extractFirstParagraph(text: string) {
  const paras = splitParagraphs(text);
  return paras[0] ?? "";
}

function countHashtags(text: string) {
  const m = text.match(/#[\p{L}\p{N}_]+/gu);
  return m ? m.length : 0;
}

function endsWithQuestion(text: string) {
  const t = (text ?? "").trim();
  return t.endsWith("?") || t.endsWith("؟");
}

function hasQuestionMarkAnywhere(text: string) {
  return /\?/.test(text);
}

function avgParagraphLength(paragraphs: string[]) {
  if (paragraphs.length === 0) return 0;
  const total = paragraphs.reduce((acc, p) => acc + p.length, 0);
  return Math.round(total / paragraphs.length);
}

/* =========================
   LinkedIn Audit 2026
========================= */

export function seoAudit(args: {
  subject: string;
  caption: string;
  network: string;
  language: "fr" | "en";
}): SeoAudit {
  const { caption } = args;

  const paragraphs = splitParagraphs(caption);
  const hook = extractFirstParagraph(caption);
  const hashtags = countHashtags(caption);

  /* -------------------------
     CHECKS (booléens)
  ------------------------- */

  // 1️⃣ Hook 150–180 caractères
  const hookLengthChars = hook.length;
  const hookLengthOk = hookLengthChars >= 150 && hookLengthChars <= 180;

  // 2️⃣ Une seule idée (proxy technique)
  // Heuristique simple mais efficace :
  // trop de paragraphes longs = dispersion
  const paragraphCount = paragraphs.length;
  const avgLen = avgParagraphLength(paragraphs);
  const singleIdeaOk = paragraphCount <= 8 && avgLen <= 320;

  // 3️⃣ Question ouverte (CTA)
  const openQuestionOk = hasQuestionMarkAnywhere(caption) && endsWithQuestion(caption);

  // 4️⃣ Hashtags 3–5 max
  const hashtagCountOk = hashtags >= 3 && hashtags <= 5;

  // 5️⃣ Lisibilité mobile
  // paragraphes courts + espacés
  const mobileReadableOk = paragraphs.every((p) => p.length <= 420);

  /* -------------------------
     SCORING
  ------------------------- */

  let score = 0;
  if (hookLengthOk) score += 25;
  if (singleIdeaOk) score += 20;
  if (openQuestionOk) score += 20;
  if (hashtagCountOk) score += 15;
  if (mobileReadableOk) score += 20;

  score = Math.max(0, Math.min(100, score));

  /* -------------------------
     Suggestions intelligentes
  ------------------------- */

  const suggestions: string[] = [];

  if (!hookLengthOk) {
    suggestions.push(
      `Ajuste le hook : ${hookLengthChars} caractères détectés (objectif LinkedIn 2026 : 150–180).`
    );
  }

  if (!singleIdeaOk) {
    suggestions.push(
      "Le post semble traiter trop d’idées. Réduis à un seul angle clair."
    );
  }

  if (!openQuestionOk) {
    suggestions.push(
      "Termine le post par une question ouverte pour déclencher des commentaires qualitatifs."
    );
  }

  if (!hashtagCountOk) {
    suggestions.push(
      `Utilise 3 à 5 hashtags maximum (actuellement : ${hashtags}).`
    );
  }

  if (!mobileReadableOk) {
    suggestions.push(
      "Raccourcis certains paragraphes pour améliorer la lisibilité mobile."
    );
  }

  return {
    score,
    checks: {
      hookLength: hookLengthOk,
      singleIdea: singleIdeaOk,
      openQuestion: openQuestionOk,
      hashtagCount: hashtagCountOk,
      mobileReadable: mobileReadableOk,
    },
    details: {
      hookLengthChars,
      hashtagCount: hashtags,
      paragraphCount,
    },
    suggestions,
  };
}

/* =========================
   Désactivé volontairement
   (SEO ≠ LinkedIn 2026)
========================= */

export function applySeoRewrite() {
  throw new Error(
    "applySeoRewrite est désactivé. Social Writer utilise désormais le LinkedIn Score 2026 (pas de SEO)."
  );
}
