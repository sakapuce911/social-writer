// src/app/api/generate/route.ts

import { NextResponse } from "next/server";
import { callLLM } from "@/lib/provider";
import { captionPrompt, type Objective } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** Nettoie les ```json ... ``` si le modèle en met */
function stripCodeFences(s: string) {
  return (s ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

/** Essaie d'extraire le premier JSON objet { ... } dans un texte */
function extractFirstJSONObject(text: string) {
  const t = String(text ?? "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return t.slice(first, last + 1).trim();
  return "";
}

function normalizeHashtags(h: unknown): string[] {
  if (Array.isArray(h)) {
    const clean = h
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : `#${t}`))
      .map((t) => t.replace(/\s+/g, "").trim())
      .filter((t) => /^#[\p{L}\p{N}_]+$/u.test(t));

    return Array.from(new Set(clean)).slice(0, 5);
  }

  const raw = String(h ?? "").trim();
  if (!raw) return [];
  const found = raw.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return Array.from(new Set(found)).slice(0, 5);
}

function safeJsonParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function isValidLLMJson(text: string): boolean {
  const obj = safeJsonParse<any>(text);
  if (!obj) return false;

  const captionOk = typeof obj?.caption === "string" && String(obj.caption).trim().length > 0;
  const ctaOk = typeof obj?.cta === "string";
  const hashtagsOk = Array.isArray(obj?.hashtags) || typeof obj?.hashtags === "string";

  return Boolean(captionOk && ctaOk && hashtagsOk);
}

function coerceCleanOutput(obj: any) {
  const caption = String(obj?.caption ?? "").trim();
  const cta = String(obj?.cta ?? "").trim();
  const hashtags = normalizeHashtags(obj?.hashtags);

  return { caption, cta, hashtags };
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

    const basePrompt = captionPrompt({
      subject,
      language: lang === "en" ? "English" : "French",
      objective,
      network,
    });

    // ✅ JSON strict + garde-fous LinkedIn 2026
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

    // ✅ Température un peu plus basse => moins de dérive JSON
    const r = await callLLM(jsonPrompt, { temperature: 0.45, maxOutputTokens: 950 });

    let rawText = stripCodeFences(String((r as any)?.text ?? "")).trim();

    // 1) Parse direct
    let text = rawText;
    if (!isValidLLMJson(text)) {
      // 2) Extraction du 1er objet JSON { ... }
      const embedded = extractFirstJSONObject(text);
      if (embedded && isValidLLMJson(embedded)) {
        text = embedded;
      }
    }

    // 3) Si toujours pas ok -> repair via LLM (format JSON strict)
    if (!isValidLLMJson(text)) {
      const repairPrompt = `
Tu dois répondre UNIQUEMENT avec un JSON strict valide, sans markdown, sans texte autour.

FORMAT EXACT:
{
  "caption": "string",
  "cta": "string",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}

Contraintes:
- caption non vide
- cta doit être une question ouverte (finir par "?")
- hashtags: 3 à 5, uniquement des hashtags

Texte à convertir/réparer:
${rawText}
`.trim();

      const rr = await callLLM(repairPrompt, { temperature: 0.2, maxOutputTokens: 700 });
      const repaired = stripCodeFences(String((rr as any)?.text ?? "")).trim();

      let candidate = repaired;
      if (!isValidLLMJson(candidate)) {
        const embedded2 = extractFirstJSONObject(candidate);
        if (embedded2) candidate = embedded2;
      }

      if (isValidLLMJson(candidate)) {
        text = candidate;
      } else {
        // Dernier recours : on renvoie l'erreur avec raw pour debug
        return NextResponse.json(
          {
            error: "Le modèle n'a pas renvoyé un JSON valide (même après réparation).",
            raw: rawText.slice(0, 2500),
            repaired: repaired.slice(0, 2500),
          },
          { status: 502 }
        );
      }
    }

    // ✅ Normalisation finale
    const obj = safeJsonParse<any>(text);
    const cleaned = coerceCleanOutput(obj);

    // Sécurité extra : caption non vide
    if (!cleaned.caption.trim()) {
      return NextResponse.json(
        { error: "Réponse IA vide après nettoyage.", raw: text.slice(0, 2500) },
        { status: 502 }
      );
    }

    return NextResponse.json({ output: JSON.stringify(cleaned) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur inconnue" }, { status: 500 });
  }
}
