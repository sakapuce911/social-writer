// src/lib/seoAudit.ts

export type SeoAudit = {
  score: number; // 0..100
  primaryKeyword: string;
  density: number; // %
  secondaryKeywords: string[];
  paragraphsWithoutKeyword: number;
  longTailDetected: boolean;
  suggestions: string[];
};

/** Stopwords très simples (FR/EN) pour éviter de remonter des mots inutiles */
const STOP_FR = new Set([
  "le","la","les","un","une","des","du","de","d","dans","sur","sous","avec","sans","pour","par","vers","chez",
  "et","ou","mais","donc","or","ni","car",
  "je","tu","il","elle","on","nous","vous","ils","elles",
  "mon","ma","mes","ton","ta","tes","son","sa","ses","notre","nos","votre","vos","leur","leurs",
  "ce","cet","cette","ces","ça","cela","c","qui","que","quoi","dont","où",
  "ne","pas","plus","moins","très","trop","aussi","déjà","encore",
  "au","aux","à","en","y",
  "est","sont","été","être","avoir","fait","faire","peut","peux","doit","doivent",
  "comme","si","quand","alors","ainsi","ici","là","aujourd","hui",
]);

const STOP_EN = new Set([
  "the","a","an","and","or","but","so","because",
  "i","you","he","she","we","they","me","my","your","our","their",
  "to","of","in","on","at","for","with","without","from","by","about","as",
  "is","are","was","were","be","been","being","have","has","had","do","does","did","can","could","should","would",
  "this","that","these","those","what","which","who","whom","where","when","why","how",
]);

function normalize(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^\p{L}\p{N}\s#'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitParagraphs(text: string) {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  // paragraphes = séparés par lignes vides
  return raw.split(/\n\s*\n+/g).map((p) => p.trim()).filter(Boolean);
}

function tokenize(text: string) {
  const n = normalize(text);
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

function pickStopwords(language: "fr" | "en") {
  return language === "en" ? STOP_EN : STOP_FR;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Occurrence "token-aware" :
 * - si needle = plusieurs mots => on cherche la phrase telle quelle (avec espaces flexibles)
 * - si needle = 1 mot => boundary \b
 */
function countOccurrences(haystack: string, needle: string) {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!h || !n) return 0;

  const tokens = n.split(" ").filter(Boolean);

  if (tokens.length <= 1) {
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "giu");
    const m = h.match(re);
    return m ? m.length : 0;
  }

  // phrase : espaces flexibles
  const re = new RegExp(`\\b${tokens.map(escapeRegExp).join("\\s+")}\\b`, "giu");
  const m = h.match(re);
  return m ? m.length : 0;
}

/**
 * Extraction naïve de mots-clés secondaires depuis le sujet
 * (on enlève stopwords + mots courts)
 */
function extractSecondaryFromSubject(subject: string, language: "fr" | "en") {
  const stop = pickStopwords(language);
  const tokens = tokenize(subject)
    .map((t) => t.replace(/^#/, ""))
    .filter((t) => t.length >= 4)
    .filter((t) => !stop.has(t));

  // unique + garder l'ordre
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, 10);
}

/**
 * ✅ Choisir un "primary keyword" réaliste (1 à 3 mots)
 * - priorité à un bigram si possible (ex: "time management", "personal branding")
 * - sinon le meilleur token (le plus long) hors stopwords
 */
function pickPrimaryKeyword(subject: string, language: "fr" | "en") {
  const stop = pickStopwords(language);
  const toks = tokenize(subject)
    .map((t) => t.replace(/^#/, ""))
    .filter((t) => t.length >= 4)
    .filter((t) => !stop.has(t));

  if (toks.length === 0) return subject.trim() || "mot-clé";

  // bigrams “naturels”
  const bigrams = [];
  for (let i = 0; i < toks.length - 1; i++) {
    bigrams.push(`${toks[i]} ${toks[i + 1]}`);
  }

  // choisir un bigram si le sujet semble être une expression (ex: 2–4 tokens significatifs)
  if (bigrams.length > 0 && toks.length <= 5) {
    // on prend le premier bigram (souvent le plus fidèle au sujet)
    return bigrams[0];
  }

  // sinon le token le plus long
  let best = toks[0];
  for (const t of toks) {
    if (t.length > best.length) best = t;
  }
  return best;
}

/**
 * Détecter une "longue traîne" : 4+ mots significatifs (hors stopwords)
 */
function detectLongTail(subject: string, language: "fr" | "en") {
  const stop = pickStopwords(language);
  const toks = tokenize(subject).filter((t) => t.length >= 3 && !stop.has(t));
  return toks.length >= 4;
}

/**
 * Génère un audit SEO simple sur la caption
 */
export function seoAudit(args: { subject: string; caption: string; network: string; language: "fr" | "en" }): SeoAudit {
  const { subject, caption, language } = args;

  const primaryKeyword = pickPrimaryKeyword(subject, language);
  const secondaryKeywords = extractSecondaryFromSubject(subject, language).filter((k) => normalize(k) !== normalize(primaryKeyword));

  const words = tokenize(caption);
  const totalWords = Math.max(words.length, 1);

  const primaryCount = countOccurrences(caption, primaryKeyword);
  const density = Number(((primaryCount / totalWords) * 100).toFixed(2));

  const paragraphs = splitParagraphs(caption);
  const keywordSet = [primaryKeyword, ...secondaryKeywords].filter(Boolean).map(normalize);

  let without = 0;
  for (const p of paragraphs) {
    const pn = normalize(p);
    const hasAny = keywordSet.some((k) => (k ? pn.includes(k) : false));
    if (!hasAny) without += 1;
  }

  const longTailDetected = detectLongTail(subject, language);

  // scoring simple
  let score = 0;

  if (primaryCount >= 1) score += 35;

  // densité idéale dépend du format LinkedIn long : ~0.4% à 1.8%
  if (density >= 0.4 && density <= 1.8) score += 25;
  else if (density > 0 && density < 0.4) score += 12;
  else if (density > 1.8) score += 10;

  if (secondaryKeywords.length >= 3) score += 15;
  else if (secondaryKeywords.length >= 1) score += 8;

  if (paragraphs.length > 0) {
    const ok = Math.max(0, paragraphs.length - without);
    const ratio = ok / paragraphs.length;
    score += Math.round(ratio * 25);
  }

  if (longTailDetected) score += 5;

  score = Math.max(0, Math.min(100, score));

  const suggestions: string[] = [];

  if (primaryCount < 1) {
    suggestions.push(`Ajoute le mot-clé principal ("${primaryKeyword}") au moins 1 fois dans la caption.`);
  }

  if (density === 0) {
    suggestions.push(`Densité trop faible (0%). Réutilise "${primaryKeyword}" 1 fois de façon naturelle.`);
  } else if (density < 0.4) {
    suggestions.push(`Densité faible (${density}%). Réutilise "${primaryKeyword}" 1 fois de façon naturelle.`);
  } else if (density > 1.8) {
    suggestions.push(`Densité élevée (${density}%). Réduis les répétitions de "${primaryKeyword}".`);
  }

  if (without > 0) {
    suggestions.push(`Ajoute au moins 1 mot-clé (principal ou secondaire) dans ${without} paragraphe(s) pour améliorer le SEO.`);
  }

  if (!longTailDetected) {
    suggestions.push(`Essaie une formulation plus précise (longue traîne) : 4–6 mots significatifs autour du sujet.`);
  }

  return {
    score,
    primaryKeyword,
    density,
    secondaryKeywords,
    paragraphsWithoutKeyword: without,
    longTailDetected,
    suggestions,
  };
}

/**
 * ✅ Applique automatiquement les suggestions SEO en réécrivant la caption
 * - Objectif: intégrer le mot-clé principal 1–2 fois + 1 secondaire dans les paragraphes vides
 * - Sans bourrage
 */
export function applySeoRewrite(args: {
  subject: string;
  caption: string;
  language: "fr" | "en";
}): { rewritten: string } {
  const { subject, caption, language } = args;

  const primary = pickPrimaryKeyword(subject, language);
  const secondary = extractSecondaryFromSubject(subject, language).filter((k) => normalize(k) !== normalize(primary));

  const paragraphs = splitParagraphs(caption);
  if (paragraphs.length === 0) {
    // fallback: juste ajouter une phrase clean
    return { rewritten: `${primary}\n\n${caption}`.trim() };
  }

  let rewrittenParas = [...paragraphs];

  // 1) S’assurer que le primary apparaît au moins 1 fois
  const full = rewrittenParas.join("\n\n");
  const hasPrimary = normalize(full).includes(normalize(primary));
  if (!hasPrimary) {
    rewrittenParas[0] = `${rewrittenParas[0].trim()} — ${primary}.`;
  }

  // 2) Ajouter un secondaire dans les paragraphes sans aucun mot-clé
  const keywordSet = [primary, ...secondary].filter(Boolean).map(normalize);
  let secIdx = 0;

  rewrittenParas = rewrittenParas.map((p, idx) => {
    const pn = normalize(p);
    const hasAny = keywordSet.some((k) => pn.includes(k));
    if (hasAny) return p;

    const kw = secondary[secIdx] ?? primary;
    secIdx += 1;

    // ✅ injection plus "LinkedIn-friendly"
    const add =
      language === "en"
        ? `\n\n👉 Key idea: ${kw}.`
        : `\n\n👉 Mot-clé : ${kw}.`;

    // éviter de rajouter sur un paragraphe déjà très long
    if (p.length > 380 && idx !== 0) return p;

    return `${p.trim()}${add}`;
  });

  // 3) Limiter primary à 2 occurrences max
  let rejoined = rewrittenParas.join("\n\n");
  let primaryCount = countOccurrences(rejoined, primary);

  if (primaryCount > 2) {
    // remplace la dernière occurrence injectée (si possible) par un secondaire
    const replacement = secondary[secIdx] ?? "";
    if (replacement) {
      // remplace seulement la dernière occurrence (approx)
      const target = new RegExp(`(\\b${escapeRegExp(normalize(primary)).replace(/\\s+/g, "\\s+")}\\b)(?![\\s\\S]*\\b${escapeRegExp(normalize(primary)).replace(/\\s+/g, "\\s+")}\\b)`, "iu");
      rejoined = normalize(rejoined) ? rejoined.replace(target, replacement) : rejoined;
      primaryCount = countOccurrences(rejoined, primary);
    }
  }

  return { rewritten: rewrittenParas.join("\n\n").trim() };
}
