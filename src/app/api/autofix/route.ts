// src/app/api/autofix/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // important pour avoir process.env
export const dynamic = "force-dynamic";

type Lang = "fr" | "en";

function safeJsonParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** Extrait le texte Gemini de manière robuste (plusieurs formats possibles) */
function extractGeminiText(data: any): string {
  // Format le plus courant : candidates[0].content.parts[0].text
  const t1 = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n");
  if (typeof t1 === "string" && t1.trim()) return t1.trim();

  // Autre format possible : candidates[0].output / candidates[0].content.text
  const t2 = data?.candidates?.[0]?.output;
  if (typeof t2 === "string" && t2.trim()) return t2.trim();

  const t3 = data?.candidates?.[0]?.content?.text;
  if (typeof t3 === "string" && t3.trim()) return t3.trim();

  // Rare : data.text
  const t4 = data?.text;
  if (typeof t4 === "string" && t4.trim()) return t4.trim();

  return "";
}

function normalizeHashtagsToString(raw: unknown) {
  if (Array.isArray(raw)) return raw.join(" ").trim();
  return String(raw ?? "").trim();
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

  // si vraiment vide -> null
  if (!caption && !cta && !hashtags) return null;

  return { caption, cta, hashtags };
}

export async function POST(req: Request) {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY manquant. Ajoute-le dans .env.local et sur Vercel (Environment Variables)." },
        { status: 500 }
      );
    }

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

    // Prompt ultra explicite : on force JSON.
    const sys = `Tu es un expert LinkedIn (2026). Tu corriges un post pour maximiser la conversation (engagement) ET respecter des contraintes.
Tu dois sortir UNIQUEMENT un JSON strict (sans markdown, sans texte autour).`;

    const user = `Langue: ${language}
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
}`;

    // Appel REST Gemini (compatible Next sans SDK)
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
      encodeURIComponent(GEMINI_API_KEY);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 900,
        },
      }),
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      // log utile serveur (vercel logs)
      console.error("Gemini error status:", resp.status, data);
      const msg = data?.error?.message ? String(data.error.message) : "Erreur Gemini";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // log utile si structure surprenante
    // (tu peux commenter après debug)
    console.log("Gemini raw response:", JSON.stringify(data).slice(0, 4000));

    const rawText = extractGeminiText(data);
    if (!rawText) {
      return NextResponse.json(
        {
          error: "Réponse Gemini vide ou inattendue.",
          debug: {
            hasCandidates: Boolean(data?.candidates?.length),
            topKeys: data ? Object.keys(data) : null,
          },
        },
        { status: 500 }
      );
    }

    const parsed = coerceOutput(rawText);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "Gemini a répondu, mais le format est inexploitable (ni JSON ni sections).",
          raw: rawText.slice(0, 2000),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ output: parsed, raw: rawText });
  } catch (e: unknown) {
    console.error("Autofix route crash:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Erreur serveur autofix" }, { status: 500 });
  }
}
