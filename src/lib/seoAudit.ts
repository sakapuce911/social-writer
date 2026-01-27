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

function countOccurrences(haystack: string, needle: string) {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!h || !n) return 0;
  // match simple "contient", mais sur tokens => on utilise regex word boundary approximatif
  const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "giu");
  const m = h.match(re);
  return m ? m.length : 0;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
 * Détecter une "longue traîne" : 4+ mots dans le sujet
 */
function detectLongTail(subject: string) {
  const toks = tokenize(subject);
  return toks.length >= 4;
}

/**
 * Génère un audit SEO simple sur la caption
 */
export function seoAudit(args: { subject: string; caption: string; network: string; language: "fr" | "en" }): SeoAudit {
  const { subject, caption, language } = args;

  const primaryKeyword = normalize(subject); // on considère le sujet comme mot-clé principal
  const secondaryKeywords = extractSecondaryFromSubject(subject, language);

  const words = tokenize(caption);
  const totalWords = Math.max(words.length, 1);

  const primaryCount = countOccurrences(caption, primaryKeyword);
  const density = Number(((primaryCount / totalWords) * 100).toFixed(2));

  const paragraphs = splitParagraphs(caption);
  const keywordSet = [primaryKeyword, ...secondaryKeywords].filter(Boolean);

  let without = 0;
  for (const p of paragraphs) {
    const hasAny = keywordSet.some((k) => (k ? normalize(p).includes(normalize(k)) : false));
    if (!hasAny) without += 1;
  }

  const longTailDetected = detectLongTail(subject);

  // scoring simple
  let score = 0;
  if (primaryCount >= 1) score += 35;
  if (density >= 0.6 && density <= 2.2) score += 25;
  else if (density > 0 && density < 0.6) score += 12;
  else if (density > 2.2) score += 10;

  if (secondaryKeywords.length >= 3) score += 15;
  else if (secondaryKeywords.length >= 1) score += 8;

  if (paragraphs.length === 0) score += 0;
  else {
    const ok = Math.max(0, paragraphs.length - without);
    const ratio = ok / paragraphs.length;
    score += Math.round(ratio * 25);
  }

  if (longTailDetected) score += 5;

  score = Math.max(0, Math.min(100, score));

  const suggestions: string[] = [];

  if (primaryCount < 1) {
    suggestions.push(`Ajoute le mot-clé principal ("${subject}") au moins 1 fois dans la caption.`);
  }
  if (density === 0) {
    suggestions.push(`Densité trop faible (0%). Réutilise "${subject}" 1–2 fois de façon naturelle.`);
  } else if (density < 0.6) {
    suggestions.push(`Densité faible (${density}%). Réutilise "${subject}" 1 fois de façon naturelle.`);
  } else if (density > 2.2) {
    suggestions.push(`Densité élevée (${density}%). Réduis les répétitions de "${subject}".`);
  }

  if (without > 0) {
    suggestions.push(`Ajoute au moins 1 mot-clé (principal ou secondaire) dans ${without} paragraphe(s) pour améliorer le SEO.`);
  }

  if (!longTailDetected) {
    suggestions.push(`Essaie une formulation plus précise (longue traîne) : ex. 4–6 mots autour du sujet.`);
  }

  return {
    score,
    primaryKeyword: subject,
    density,
    secondaryKeywords,
    paragraphsWithoutKeyword: without,
    longTailDetected,
    suggestions,
  };
}

/**
 * ✅ Applique automatiquement les suggestions SEO en réécrivant la caption
 * - Objectif: intégrer le mot-clé principal 1–2 fois + 1 mot-clé secondaire par paragraphe
 * - Sans bourrage (limite répétitions)
 */
export function applySeoRewrite(args: {
  subject: string;
  caption: string;
  language: "fr" | "en";
}): { rewritten: string } {
  const { subject, caption, language } = args;

  const primary = subject.trim();
  const secondary = extractSecondaryFromSubject(subject, language);

  const paragraphs = splitParagraphs(caption);
  if (paragraphs.length === 0) {
    // fallback: juste ajouter une phrase clean
    return { rewritten: `${primary}\n\n${caption}`.trim() };
  }

  // 1) S’assurer que le mot-clé principal apparaît au moins 1 fois
  let rewrittenParas = [...paragraphs];

  const full = rewrittenParas.join("\n\n");
  const hasPrimary = normalize(full).includes(normalize(primary));

  if (!hasPrimary) {
    // on l’ajoute dans le 1er paragraphe (hook) de façon naturelle
    rewrittenParas[0] = `${rewrittenParas[0].trim()} — ${primary}.`;
  }

  // 2) Ajouter des secondaires dans les paragraphes qui n’ont aucun mot-clé (principal/secondaire)
  const keywordSet = [primary, ...secondary].filter(Boolean);
  let secIdx = 0;

  rewrittenParas = rewrittenParas.map((p) => {
    const hasAny = keywordSet.some((k) => normalize(p).includes(normalize(k)));
    if (hasAny) return p;

    // injecter un secondaire (ou le primaire si on n'a plus rien)
    const kw = secondary[secIdx] ?? primary;
    secIdx += 1;

    // injection douce, fin de paragraphe
    const suffix = language === "en"
      ? ` (key point: ${kw})`
      : ` (point clé : ${kw})`;

    return `${p.trim()}${suffix}`;
  });

  // 3) Limiter répétition du primary à 2 max (si déjà trop présent)
  // (simple: si >2 occurrences exactes du sujet, on enlève la dernière injection primaire)
  const rejoined = rewrittenParas.join("\n\n");
  const primaryCount = countOccurrences(rejoined, primary);

  if (primaryCount > 2) {
    // essayer de remplacer les ajouts "(point clé : primary)" par un secondaire
    rewrittenParas = rewrittenParas.map((p) => {
      const markerFr = `(point clé : ${primary})`;
      const markerEn = `(key point: ${primary})`;
      if (p.includes(markerFr) || p.includes(markerEn)) {
        const kw = secondary[secIdx] ?? "";
        secIdx += 1;
        if (!kw) return p.replace(markerFr, "").replace(markerEn, "").trim();
        return p.replace(markerFr, `(point clé : ${kw})`).replace(markerEn, `(key point: ${kw})`);
      }
      return p;
    });
  }

  return { rewritten: rewrittenParas.join("\n\n").trim() };
}
