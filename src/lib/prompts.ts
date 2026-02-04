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

function extractFirstJSONObject(text: string) {
  const t = String(text ?? "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return t.slice(first, last + 1).trim();
  return "";
}

function safeJsonParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
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

function isValidLLMJson(text: string): boolean {
  const obj = safeJsonParse<any>(text);
  if (!obj) return false;
  const captionOk = typeof obj?.caption === "string" && String(obj.caption).trim().length > 0;
  const ctaOk = typeof obj?.cta === "string" && String(obj.cta).trim().length > 0;
  const hashtagsOk = Array.isArray(obj?.hashtags) || typeof obj?.hashtags === "string";
  return Boolean(captionOk && ctaOk && hashtagsOk);
}

function clean(obj: any) {
  let caption = String(obj?.caption ?? "").trim();
  let cta = String(obj?.cta ?? "").trim();
  const hashtags = normalizeHashtags(obj?.hashtags);

  // sécurité anti-"2026"
  caption = caption.replace(/\b2026\b/g, "").replace(/\s{2,}/g, " ").trim();

  return { caption, cta, hashtags };
}

function firstNonEmptyLine(text: string) {
  return (text.split("\n").find((l) => l.trim().length > 0) ?? "").trim();
}

function scoreCompliance(caption: string, cta: string, hashtags: string[]) {
  const hook = firstNonEmptyLine(caption);
  const hookLen = hook.length;

  const hasBullets = /(^|\n)\s*[-•–]\s+/.test(caption);
  const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
  const len = caption.length;

  const ctaOk = cta.trim().endsWith("?") || caption.trim().endsWith("?");
  const hashtagsOk = hashtags.length >= 3 && hashtags.length <= 5;

  // on vise “parfait” -> critères stricts
  const ok =
    hook.startsWith("Vous") &&
    hookLen >= 150 &&
    hookLen <= 180 &&
    len >= 850 &&
    len <= 1400 &&
    hasBullets &&
    lines.length >= 7 &&
    ctaOk &&
    hashtagsOk &&
    !/\b2026\b/.test(caption);

  return { ok, hookLen, len, hasBullets, linesCount: lines.length, ctaOk, hashtagsOk };
}

/** Cache 6h (par instance) */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { until: number; payload: any }>();

function cacheKey(subject: string, lang: Lang, objective: Objective) {
  return `${lang}|${objective}|${subject}`.toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const subject = String(body?.subject ?? "").trim();
    if (!subject) return NextResponse.json({ error: "Le sujet est obligatoire." }, { status: 400 });

    const lang = safeLang(body?.language);
    const objective = safeObjective(body?.objective);
    const network: Network = "linkedin";

    // ✅ cache anti-gaspillage
    const key = cacheKey(subject, lang, objective);
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) {
      return NextResponse.json({ output: JSON.stringify(hit.payload) });
    } else if (hit) {
      cache.delete(key);
    }

    const basePrompt = captionPrompt({
      subject,
      language: lang === "en" ? "English" : "French",
      objective,
      network,
    });

    const jsonPrompt = `
${basePrompt}

IMPORTANT (FORMAT DE SORTIE):
- Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de texte autour).
- Utilise des guillemets doubles ASCII (") uniquement.
- Structure EXACTE:
{
  "caption": "string",
  "cta": "string",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}

RAPPEL:
- Interdit de mentionner "2026" sauf si le sujet l'exige.
- Hook (1ère ligne) 150–180 caractères, commence par "Vous".
- Longueur caption ~900–1300 caractères.
- Framework (3–5 points) obligatoire.
`.trim();

    // 1) appel principal (force JSON côté Gemini)
    const r = await callLLM(jsonPrompt, {
      temperature: 0.25,
      maxOutputTokens: 1100,
      responseMimeType: "application/json",
    });

    let raw = stripCodeFences(String((r as any)?.text ?? "")).trim();
    let candidate = raw;

    if (!isValidLLMJson(candidate)) {
      const embedded = extractFirstJSONObject(candidate);
      if (embedded) candidate = embedded;
    }

    // si JSON invalide -> 2) repair UNIQUE (1 seul retry max)
    if (!isValidLLMJson(candidate)) {
      const repairPrompt = `
Tu dois répondre UNIQUEMENT avec un JSON strict valide (aucun texte autour).
Format:
{"caption":"...","cta":"...","hashtags":["#a","#b","#c"]}

Règles:
- caption non vide ~900–1300 caractères
- 1ère ligne commence par "Vous" et fait 150–180 caractères
- framework 3–5 points obligatoire
- question ouverte finale (cta finit par "?")
- 3–5 hashtags niche
- interdit de mentionner "2026" (sauf si le sujet l'exige)

Sujet: ${subject}
Texte brut à réparer:
${raw}
`.trim();

      const rr = await callLLM(repairPrompt, {
        temperature: 0.1,
        maxOutputTokens: 1100,
        responseMimeType: "application/json",
      });

      const repaired = stripCodeFences(String((rr as any)?.text ?? "")).trim();
      const embedded2 = extractFirstJSONObject(repaired);
      candidate = embedded2 || repaired;

      if (!isValidLLMJson(candidate)) {
        return NextResponse.json(
          { error: "Le modèle n'a pas renvoyé un JSON valide.", raw: raw.slice(0, 2000) },
          { status: 502 }
        );
      }
    }

    let out = clean(safeJsonParse(candidate));
    const check1 = scoreCompliance(out.caption, out.cta, out.hashtags);

    // 3) si pas conforme -> 1 seul appel FIX (max) pour atteindre “parfait”
    if (!check1.ok) {
      const fixPrompt = `
Tu dois AMÉLIORER ce post pour respecter STRICTEMENT les contraintes, sans changer le sujet.
Tu réponds UNIQUEMENT en JSON strict au format:
{"caption":"...","cta":"...","hashtags":["#a","#b","#c"]}

Contraintes strictes:
- Hook (1ère ligne): commence par "Vous" et fait 150–180 caractères EXACT.
- Caption: 900–1300 caractères.
- Contexte réel présent (preuve humaine).
- Framework 3–5 points (liste avec - ou •).
- Question finale ouverte (cta finit par "?") qui force une réponse développée.
- 3–5 hashtags niche.
- Interdit de mentionner "2026" sauf si le sujet l'exige.

Sujet: ${subject}

Post actuel:
${out.caption}

CTA actuel:
${out.cta}

Hashtags actuels:
${out.hashtags.join(" ")}
`.trim();

      const fr = await callLLM(fixPrompt, {
        temperature: 0.15,
        maxOutputTokens: 1100,
        responseMimeType: "application/json",
      });

      const fixed = stripCodeFences(String((fr as any)?.text ?? "")).trim();
      const embedded3 = extractFirstJSONObject(fixed);
      const cand2 = embedded3 || fixed;

      if (isValidLLMJson(cand2)) {
        out = clean(safeJsonParse(cand2));
      }
    }

    // cache anti-gaspillage (même sujet -> 0 appel)
    cache.set(key, { until: Date.now() + CACHE_TTL_MS, payload: out });

    return NextResponse.json({ output: JSON.stringify(out) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur inconnue" }, { status: 500 });
  }
}
