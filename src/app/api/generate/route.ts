import { NextResponse } from "next/server";
import { callLLM } from "@/lib/provider";
import { captionPrompt, type Objective, type Network } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const subject = String(body?.subject ?? "").trim();

    const language = String(body?.language ?? "fr").trim().toLowerCase();
    const lang = language === "en" ? "en" : "fr";

    const objective = String(body?.objective ?? "attirer").trim() as Objective;
    const network = String(body?.network ?? "instagram").trim() as Network;

    if (!subject) {
      return NextResponse.json({ error: "Le sujet est obligatoire." }, { status: 400 });
    }

    const basePrompt = captionPrompt({
      subject,
      language: lang === "en" ? "English" : "French",
      objective,
      network,
    });

    // ✅ Rappel SEO + format JSON strict (robuste)
    const jsonPrompt = `
${basePrompt}

IMPORTANT (FORMAT DE SORTIE):
- Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de texte autour).
- Structure EXACTE:
{
  "caption": "string",
  "cta": "string",
  "hashtags": ["#tag1", "#tag2", ...]
}

RÈGLES DE SORTIE:
- "caption" = texte final du post (sans titre "caption:", sans "CTA:", sans "hashtags:")
- "cta" = 1 phrase courte d'action adaptée au réseau
- "hashtags" = tableau de hashtags uniquement
- Langue obligatoire: ${lang === "en" ? "English" : "French"}

RÈGLES SEO (RAPPEL):
- Utilise un mot-clé principal + plusieurs variantes sémantiques autour du sujet.
- LinkedIn/Instagram: si plusieurs paragraphes, chaque paragraphe doit contenir au moins 1 mot-clé (principal ou secondaire).
- Facebook/TikTok: texte court mais doit contenir 1 mot-clé principal + 1 variante.
- Pas de bourrage de mots-clés: naturel, fluide, lisible.
`.trim();

    const r = await callLLM(jsonPrompt);

    let text = (r.text ?? "").trim();
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    try {
      JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "Le modèle n'a pas renvoyé un JSON valide. Réessaie (ou baisse la température).",
          raw: text,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ output: text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur inconnue" }, { status: 500 });
  }
}
