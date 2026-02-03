// src/app/api/autofix/route.ts
import { NextResponse } from "next/server";
import { callLLM } from "@/lib/provider";

export const runtime = "nodejs"; // process.env OK
export const dynamic = "force-dynamic";

type Lang = "fr" | "en";

function safeJsonParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function normalizeHashtagsToString(raw: unknown) {
  if (Array.isArray(raw)) return raw.join(" ").trim();
  return String(raw ?? "").trim();
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

function coerceOutput(rawText: string): { caption: string; cta: string; hashtags: string } | null {
  const trimmed = (rawText ?? "").trim();
  if (!trimmed) return null;

  // 1) JSON strict
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const obj = safeJsonParse<any>(trimmed);
    if (obj) {
      return {
        caption: String(obj.caption ?? "").trim(),
        cta: String(obj.cta ?? "").trim(),
        hashtags: normalizeHashtagsToString(obj.hashtags),
      };
    }
  }

  // 2) Format CAPTION/CTA/HASHTAGS (fallback)
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
  const hashtags = out.hashtags.join(" ").replace(/\s+/g, " ").trim();

  if (!caption && !cta && !hashtags) return null;

  return { caption, cta, hashtags };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });

    const language = (body.language ?? "fr") as Lang;
    const subject = String(body.subject ?? "").trim();
    const audit = body.audit ?? null;

    const current = body.current ?? {};
    const caption = String(current.caption ?? "").trim();
    const cta = String(current.cta ?? "").trim();
    const hashtags = String(current.hashtags ?? "").trim();

    if (!subject) return NextResponse.json({ error: "Sujet manquant." }, { status: 400 });

    // Prompt ultra explicite : JSON strict
    const prompt = `
Tu es un expert LinkedIn (2026). Tu corriges un post pour maximiser la conversation (engagement) ET respecter des contraintes.
Tu dois sortir UNIQUEMENT un JSON strict (sans markdown, sans texte autour).

Langue: ${language}
Sujet: ${subject}

Post actuel:
CAPTION:
${caption}

CTA:
${cta}

HASHTAGS:
${hashtags}

Score & recommandations (si présentes):
${audit ? JSON.stringify(audit) : "Aucun audit fourni"}

Contraintes à respecter:
- Hook (1ère ligne) doit être entre 150 et 180 caractères (FR/EN) si possible
- 1 seule idée, lisible mobile (paragraphes courts)
- Une question ouverte en fin (caption ou cta doit finir par "?")
- Hashtags: 3 à 5, uniques, de niche, format "#tag"
- Ne change PAS le sujet, améliore la clarté et l'impact
- Ne supprime pas le CTA : il doit inciter à commenter (>10 mots)

Sortie attendue (JSON strict):
{
  "caption": "...",
  "cta": "...",
  "hashtags": "#tag1 #tag2 #tag3"
}
`.trim();

    // ✅ Appel via provider (rotation clés + retry + fallback models)
    const r = await callLLM(prompt, { temperature: 0.5, maxOutputTokens: 900 });

    let rawText = stripCodeFences(String(r.text ?? "")).trim();

    // 1) parse direct
    let parsed = coerceOutput(rawText);

    // 2) si pas ok -> tente d’extraire un JSON embedded
    if (!parsed) {
      const embedded = extractFirstJSONObject(rawText);
      if (embedded) parsed = coerceOutput(embedded);
    }

    // 3) si encore pas ok -> tentative de "repair" (demande au modèle de renvoyer uniquement JSON)
    if (!parsed) {
      const repairPrompt = `
Tu dois répondre UNIQUEMENT avec un JSON strict, sans aucun autre texte.
Voici un texte qui doit être converti en JSON au format:
{
  "caption": "...",
  "cta": "...",
  "hashtags": "#tag1 #tag2 #tag3"
}

Texte:
${rawText}
`.trim();

      const rr = await callLLM(repairPrompt, { temperature: 0.2, maxOutputTokens: 700 });
      const repaired = stripCodeFences(String(rr.text ?? "")).trim();

      parsed = coerceOutput(repaired) || coerceOutput(extractFirstJSONObject(repaired));
      rawText = repaired || rawText;
    }

    if (!parsed) {
      return NextResponse.json(
        {
          error: "Réponse IA inexploitable (ni JSON ni sections).",
          raw: rawText.slice(0, 2500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
  output: {
    caption: parsed.caption,
    cta: parsed.cta,
    hashtags: normalizeHashtagsToString(parsed.hashtags),
  },
  meta: { model: r.model, keyIndex: r.keyIndex },
});

  } catch (e: unknown) {
    console.error("Autofix route crash:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Erreur serveur autofix" }, { status: 500 });
  }
}
