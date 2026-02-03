// src/app/api/autofix/route.ts
import { NextResponse } from "next/server";

type Lang = "fr" | "en";

type LinkedInAudit = {
  score: number;
  warnings: string[];
  checks?: {
    hookLength: boolean;
    singleIdea: boolean;
    openQuestion: boolean;
    hashtagCount: boolean;
    mobileReadable: boolean;
  };
  details?: {
    hook: string;
    hookLengthChars: number;
    paragraphCount: number;
    hashtagCount: number;
    tooLongParagraphs: number;
  };
};

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractJsonBlock(text: string) {
  // essaie de trouver le premier {...} valide
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function normalizeHashtagsArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
  }
  const s = String(input ?? "").trim();
  if (!s) return [];
  const found = s.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  // fallback si pas de #
  if (found.length === 0) {
    return s
      .split(/[\s,;]+/g)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
  }
  // unique
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of found) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, 5);
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquant. Ajoute-le dans .env.local et sur Vercel (Environment Variables).");
  }

  // modèle “safe default”
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 1200,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error ||
      "Erreur Gemini (appel API). Vérifie GEMINI_API_KEY / modèle / quotas.";
    throw new Error(msg);
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ??
    "";

  return String(text).trim();
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const subject = String(payload?.subject ?? "").trim();
    const caption = String(payload?.caption ?? "");
    const cta = String(payload?.cta ?? "");
    const hashtags = String(payload?.hashtags ?? "");
    const language = (payload?.language === "en" ? "en" : "fr") as Lang;

    const audit = (payload?.audit ?? null) as LinkedInAudit | null;

    if (!subject) {
      return NextResponse.json({ error: "Sujet manquant." }, { status: 400 });
    }
    if (!audit) {
      return NextResponse.json({ error: "Audit manquant (score/warnings)." }, { status: 400 });
    }

    const warnings = Array.isArray(audit.warnings) ? audit.warnings : [];
    const score = Number.isFinite(audit.score) ? audit.score : 0;

    const prompt = `
Tu es un expert LinkedIn 2026.

Tu dois améliorer un post existant en te basant SUR l'audit ci-dessous.
Objectif: augmenter le score LinkedIn en respectant STRICTEMENT ces règles:

RÈGLES STRICTES:
- Hook: 150 à 180 caractères (1ère ligne)
- Une seule idée centrale (pas de dispersion)
- Lisibilité mobile: paragraphes courts (1–2 lignes), respirations
- Fin: question ouverte obligatoire (caption OU CTA)
- Hashtags: 3 à 5 maximum, niches, uniques, placés à la fin
- Ne change PAS le sens du message (garde l'intention)
- N'invente pas de chiffres/données non présentes
- Langue: ${language === "en" ? "anglais" : "français"}

AUDIT ACTUEL:
- Score: ${score}/100
- Warnings:
${warnings.map((w) => `- ${w}`).join("\n")}

CONTENU ACTUEL:
Sujet: "${subject}"

Caption:
"""${caption}"""

CTA:
"""${cta}"""

Hashtags:
"""${hashtags}"""

SORTIE STRICTEMENT EN JSON (AUCUN texte autour):
{
  "caption": "string",
  "cta": "string",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}
`.trim();

    const raw = await callGemini(prompt);

    const jsonText = extractJsonBlock(raw);
    const parsed = safeJsonParse<{ caption: string; cta: string; hashtags: string[] | string }>(jsonText);

    if (!parsed) {
      return NextResponse.json(
        {
          error: "Réponse IA invalide (JSON non parsable).",
          raw: raw.slice(0, 800),
        },
        { status: 502 }
      );
    }

    const outCaption = String(parsed.caption ?? "").trim();
    const outCta = String(parsed.cta ?? "").trim();
    const outTags = normalizeHashtagsArray(parsed.hashtags).slice(0, 5);

    if (!outCaption) {
      return NextResponse.json(
        { error: "La caption retournée par l'IA est vide.", raw: raw.slice(0, 800) },
        { status: 502 }
      );
    }

    // garde 3–5 tags si possible (mais sans inventer de nouveaux si l'IA n'en donne pas)
    const finalTags = outTags.slice(0, 5);

    return NextResponse.json({
      caption: outCaption,
      cta: outCta,
      hashtags: finalTags,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Erreur Auto-fix." }, { status: 500 });
  }
}
