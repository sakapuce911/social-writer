import { NextResponse } from "next/server";
import { callLLM } from "@/lib/provider";
import { captionPrompt, type Objective, type Network } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const subject = String(body?.subject ?? "").trim();

    // ✅ UI V2 envoie "fr" ou "en"
    const language = String(body?.language ?? "fr").trim().toLowerCase();
    const lang = language === "en" ? "en" : "fr";

    const objective = String(body?.objective ?? "attirer").trim() as Objective;
    const network = String(body?.network ?? "instagram").trim() as Network;

    if (!subject) {
      return NextResponse.json({ error: "Le sujet est obligatoire." }, { status: 400 });
    }

    // Prompt métier (tes règles par réseau)
    const basePrompt = captionPrompt({
      subject,
      language: lang === "en" ? "Anglais" : "Français",
      objective,
      network,
    });

    // ✅ On force une sortie JSON clean
    // (pour éviter CAPTION/CTA/HASHTAGS dans le texte copié, et mieux parser)
    const jsonPrompt = `
${basePrompt}

IMPORTANT:
- Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de texte autour).
- Structure EXACTE:
{
  "caption": "string",
  "cta": "string",
  "hashtags": ["#tag1", "#tag2", ...]
}

Règles:
- "caption" = le texte du post (sans titre "caption:", sans "CTA:", sans "hashtags:")
- "cta" = une phrase courte d'action adaptée au réseau
- "hashtags" = tableau de hashtags (sans texte autour)
- La langue DOIT être: ${lang === "en" ? "English" : "French"}.
`.trim();

    const r = await callLLM(jsonPrompt);

    // 🔒 Nettoyage minimal (au cas où le modèle renvoie des backticks)
    let text = (r.text ?? "").trim();
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    // ✅ Vérifie que c'est bien du JSON
    try {
      JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error:
            "Le modèle n'a pas renvoyé un JSON valide. Réessaie (ou baisse la température).",
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
