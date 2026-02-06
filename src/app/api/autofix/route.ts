// src/app/api/autofix/route.ts
import { NextResponse } from "next/server";
import { callLLM } from "@/lib/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "fr" | "en";
type Objective = "éduquer" | "inspirer" | "sarcasme";

function safeLang(input: unknown): Lang {
  const v = String(input ?? "").trim().toLowerCase();
  return v === "en" ? "en" : "fr";
}

function safeObjective(input: unknown): Objective {
  const v = String(input ?? "").trim().toLowerCase();
  if (v === "inspirer" || v === "inspire") return "inspirer";
  if (v === "éduquer" || v === "eduquer" || v === "educate") return "éduquer";
  if (v === "sarcasme" || v === "sarcastique" || v === "sarcasm") return "sarcasme";
  return "inspirer";
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

function extractFirstJSONObject(text: string) {
  const t = String(text ?? "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return t.slice(first, last + 1).trim();
  return "";
}

function coerceOutput(rawText: string): { caption: string; cta: string; hashtags: string } | null {
  let t = stripCodeFences(String(rawText ?? "")).trim();
  if (!t) return null;

  // JSON stringifié
  if (t.startsWith('"') && t.endsWith('"')) {
    const inner = safeJsonParse<string>(t);
    if (typeof inner === "string" && inner.trim()) t = inner.trim();
  }

  // JSON direct
  if (t.startsWith("{") && t.endsWith("}")) {
    const obj = safeJsonParse<any>(t);
    if (obj) {
      // wrapper {"output":"{...}"}
      if (typeof obj.output === "string" && obj.output.trim()) {
        const innerTxt = obj.output.trim();
        const innerObj = safeJsonParse<any>(innerTxt) || safeJsonParse<any>(extractFirstJSONObject(innerTxt));
        if (innerObj) {
          return {
            caption: String(innerObj.caption ?? "").trim(),
            cta: String(innerObj.cta ?? "").trim(),
            hashtags: normalizeHashtagsToString(innerObj.hashtags),
          };
        }
      }

      const caption = String(obj.caption ?? "").trim();
      const cta = String(obj.cta ?? "").trim();
      const hashtags = normalizeHashtagsToString(obj.hashtags);
      if (caption || cta || hashtags) return { caption, cta, hashtags };
    }
  }

  // JSON embedded
  const embedded = extractFirstJSONObject(t);
  if (embedded) {
    const obj = safeJsonParse<any>(embedded);
    if (obj) {
      return {
        caption: String(obj.caption ?? "").trim(),
        cta: String(obj.cta ?? "").trim(),
        hashtags: normalizeHashtagsToString(obj.hashtags),
      };
    }
  }

  return null;
}

// ✅ System strict JSON (identique à generate)
const STRICT_SYSTEM = `Réponds UNIQUEMENT en JSON strict, sans markdown, sans texte autour.
Schéma: {"caption":"string","cta":"string","hashtags":"string"}
Aucune autre clé.`.trim();

/**
 * ✅ Prompt Auto-fix: minimal + ciblé
 * (moins de tokens = moins de quota)
 */
function buildAutoFixPrompt(args: {
  subject: string;
  language: Lang;
  objective: Objective;
  current: { caption: string; cta: string; hashtags: string };
  audit?: any;
}) {
  const { subject, language, objective, current, audit } = args;
  const langLabel = language === "en" ? "English" : "French";

  return `
Corrige une sortie LinkedIn non conforme. Réponds UNIQUEMENT en JSON strict.

Langue: ${langLabel}
Sujet: ${subject}
Objectif: ${objective}

Règles (STRICT):
- Hook (1ère ligne caption): commence par "Vous", contient 1 chiffre OU "?", 150–180 caractères, 1 ligne.
- Caption: 900–1400 caractères, paragraphes courts + lignes vides.
- Liste: 3–5 points, chaque ligne commence par "- ".
- Fin caption: question ouverte "?"
- CTA: question ouverte "?" (≥ 20 caractères)
- Hashtags: 3–5 uniques, une seule ligne "#a #b #c"
- Interdit: inventer des % ou stats non fournies. Préférer des petits nombres (1/3/5).
- Pas de lien / URL.

Audit (si présent):
${audit ? JSON.stringify(audit) : "Aucun"}

Entrée actuelle:
CAPTION:
"""${String(current.caption ?? "").trim()}"""

CTA:
"""${String(current.cta ?? "").trim()}"""

HASHTAGS:
"""${String(current.hashtags ?? "").trim()}"""

Consignes:
- Corrige le minimum pour être conforme.
- Garde le même sens, même angle, même ton.
- Schéma: {"caption":"string","cta":"string","hashtags":"string"}
`.trim();
}

/**
 * ✅ Dédup serveur (anti double clic)
 */
const INFLIGHT = new Map<string, Promise<any>>();

async function sha256(input: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });

    const subject = String(body?.subject ?? "").trim();
    if (!subject) return NextResponse.json({ error: "Le sujet est obligatoire." }, { status: 400 });

    const language = safeLang(body?.language);

    // ✅ IMPORTANT: sanitize objective (type safe + prompt stable)
    const objective = safeObjective(body?.objective);

    const current = body?.current ?? {};
    const caption = String(current?.caption ?? "");
    const cta = String(current?.cta ?? "");
    const hashtags = String(current?.hashtags ?? "");

    if (!caption && !cta && !hashtags) {
      return NextResponse.json({ error: "Auto-fix: contenu vide (caption/cta/hashtags)." }, { status: 400 });
    }

    const audit = body?.audit ?? null;

    const key = await sha256(
      JSON.stringify({
        subject,
        language,
        objective,
        current: { caption: caption.trim(), cta: cta.trim(), hashtags: hashtags.trim() },
        audit,
      })
    );

    const inflight = INFLIGHT.get(key);
    if (inflight) return NextResponse.json(await inflight);

    const job = (async () => {
      const prompt = buildAutoFixPrompt({
        subject,
        language,
        objective,
        current: { caption, cta, hashtags },
        audit,
      });

      const r = await callLLM(prompt, {
        temperature: 0.2,
        maxOutputTokens: 650,
        timeoutMs: 15000,
        forceJson: true,
        system: STRICT_SYSTEM,
        cacheTtlMs: 0, // ✅ FULL IA (zéro cache)
      });

      const raw = String(r.text ?? "");
      const out = coerceOutput(raw);

      if (!out || (!out.caption && !out.cta && !out.hashtags)) {
        return {
          error: "Auto-fix: JSON inexploitable.",
          code: "bad_output",
          raw: stripCodeFences(raw).slice(0, 2000),
        };
      }

      return {
        output: {
          caption: String(out.caption ?? "").trim(),
          cta: String(out.cta ?? "").trim(),
          hashtags: normalizeHashtagsToString(out.hashtags),
        },
        meta: { objective, language, model: r.model },
      };
    })();

    INFLIGHT.set(key, job);

    try {
      const payload = await job;
      return NextResponse.json(payload);
    } finally {
      INFLIGHT.delete(key);
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "Erreur inconnue");
    const lower = msg.toLowerCase();

    const isTimeout = lower.includes("timeout") || lower.includes("aborterror") || lower.includes("504");
    const isQuota =
      lower.includes("quota") ||
      lower.includes("resource_exhausted") ||
      lower.includes("rate limit") ||
      lower.includes("429");

    if (isTimeout) return NextResponse.json({ error: msg, code: "timeout" }, { status: 504 });
    if (isQuota) return NextResponse.json({ error: msg, code: "quota" }, { status: 429 });

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
