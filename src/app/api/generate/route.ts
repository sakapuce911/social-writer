// src/app/api/generate/route.ts

import { NextResponse } from "next/server";
import { callLLM } from "@/lib/provider";
import { captionPrompt, type Objective } from "@/lib/prompts";

export const runtime = "nodejs";

type Lang = "fr" | "en";
type Network = "linkedin";

function safeLang(input: unknown): Lang {
  const v = String(input ?? "").trim().toLowerCase();
  return v === "en" ? "en" : "fr";
}

function safeObjective(input: unknown): Objective {
  const v = String(input ?? "").trim().toLowerCase();

  // ⚠️ Objective contient "éduquer" avec accent -> on accepte aussi "eduquer"
  if (v === "vendre") return "vendre";
  if (v === "attirer") return "attirer";
  if (v === "recruter") return "recruter";
  if (v === "inspirer") return "inspirer";
  if (v === "éduquer" || v === "eduquer") return "éduquer";

  return "attirer";
}

function stripCodeFences(s: string) {
  return (s ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeHashtags(h: unknown): string[] {
  if (Array.isArray(h)) {
    const clean = h
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : `#${t}`))
      .map((t) => t.replace(/\s+/g, "").trim())
      .filter((t) => /^#[\p{L}\p{N}_]+$/u.test(t));

    // 3–5 max (LinkedIn 2026)
    return Array.from(new Set(clean)).slice(0, 5);
  }

  // si le modèle renvoie une string
  const raw = String(h ?? "").trim();
  if (!raw) return [];
  const found = raw.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return Array.from(new Set(found)).slice(0, 5);
}

function isValidLLMJson(text: string): boolean {
  try {
    const obj = JSON.parse(text);

    const captionOk = typeof obj?.caption === "string";
    const ctaOk = typeof obj?.cta === "string";
    const hashtagsOk = Array.isArray(obj?.hashtags) || typeof obj?.hashtags === "string";

    if (!captionOk || !ctaOk || !hashtagsOk) return false;

    // caption non vide
    if (!String(obj.caption).trim()) return false;

    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const subject = String(body?.subject ?? "").trim();
    if (!subject) {
      return NextResponse.json({ error: "Le sujet est obligatoire." }, { status: 400 });
    }

    const lang = safeLang(body?.language);
    const objective = safeObjective(body?.objective);

    // ✅ Social Writer = LinkedIn only (hard lock)
    const network: Network = "linkedin";

    // ✅ Prompt moteur LinkedIn 2026 (déjà verrouillé dans prompts.ts)
    const basePrompt = captionPrompt({
      subject,
      language: lang === "en" ? "English" : "French",
      objective,
      network,
    });

    // ✅ JSON strict + règles LinkedIn 2026 renforcées côté API (anti-dérive modèle)
    const jsonPrompt = `
${basePrompt}

IMPORTANT (FORMAT DE SORTIE):
- Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de texte autour).
- Structure EXACTE:
{
  "caption": "string",
  "cta": "string",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}

RÈGLES DE SORTIE (LINKEDIN 2026):
- "caption" = description finale du post (sans "caption:", sans "CTA:", sans "hashtags:")
- "cta" = UNE question ouverte intelligente (réponse développée, >10 mots). Interdit: like si..., oui/non, DM "OFFRE", "commente GO".
- "hashtags" = tableau de 3 à 5 hashtags MAX (de niche), uniquement des hashtags (pas de texte).
- Langue obligatoire: ${lang === "en" ? "English" : "French"}

GARDE-FOUS (OBLIGATOIRES):
- Hook (début du caption) : 150–180 caractères MAX, 1–2 lignes, très percutant (clic “Voir plus”).
- Une seule idée centrale (angle précis).
- Texte aéré : paragraphes de 1–2 lignes, sauts de ligne fréquents.
- Aucun lien / aucune URL.
- Aucun conseil générique.
`.trim();

    const r = await callLLM(jsonPrompt);

    let text = stripCodeFences(String(r.text ?? ""));
    if (!isValidLLMJson(text)) {
      // Tentative de réparation simple : si le modèle a ajouté du texte autour
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const sliced = text.slice(firstBrace, lastBrace + 1).trim();
        if (isValidLLMJson(sliced)) text = sliced;
      }
    }

    if (!isValidLLMJson(text)) {
      return NextResponse.json(
        {
          error: "Le modèle n'a pas renvoyé un JSON valide. Réessaie (ou baisse la température).",
          raw: text,
        },
        { status: 502 }
      );
    }

    // ✅ Normalisation finale (hashtags + trim)
    const obj = JSON.parse(text);
    const caption = String(obj.caption ?? "").trim();
    const cta = String(obj.cta ?? "").trim();
    const hashtags = normalizeHashtags(obj.hashtags);

    const cleaned = {
      caption,
      cta,
      hashtags,
    };

    return NextResponse.json({ output: JSON.stringify(cleaned) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur inconnue" }, { status: 500 });
  }
}
