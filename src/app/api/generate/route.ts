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

function safeJsonParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function extractFirstJSONObject(text: string) {
  const t = String(text ?? "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return t.slice(first, last + 1).trim();
  return "";
}

function normalizeHashtagsToString(raw: unknown) {
  if (Array.isArray(raw)) return raw.join(" ").trim();
  return String(raw ?? "").trim();
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

const STRICT_SYSTEM = `
Tu dois répondre UNIQUEMENT avec un JSON strict.
Aucun texte autour. Aucun markdown. Aucun \`\`\`.
Schéma exact:
{"caption":"string","cta":"string","hashtags":"string"}
Ne jamais ajouter d'autres clés.
`.trim();

function splitLines(s: string) {
  return (s ?? "").split("\n");
}

function getHook(caption: string) {
  const firstLine = splitLines(caption)
    .map((s) => s.trim())
    .find(Boolean);
  return (firstLine ?? "").trim();
}

function setHook(caption: string, newHook: string) {
  const lines = splitLines(caption);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      lines[i] = newHook;
      return lines.join("\n");
    }
  }
  return newHook;
}

function hasList(caption: string) {
  return /(^|\n)-\s+\S/m.test(caption ?? "");
}

function countHashtags(hashtags: string) {
  const tags = (hashtags ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const uniq = new Set(tags.map((t) => t.toLowerCase()));
  return uniq.size;
}

function hookOk(hook: string) {
  const h = (hook ?? "").trim();
  const len = h.length;
  const starts = h.startsWith("Vous");
  const hasDigit = /\d/.test(h);
  const hasQ = h.includes("?");
  return starts && (hasDigit || hasQ) && len >= 150 && len <= 180;
}

function captionLenOk(caption: string) {
  const n = (caption ?? "").trim().length;
  return n >= 900 && n <= 1400;
}

function ctaOk(cta: string) {
  const t = (cta ?? "").trim();
  // ✅ CTA doit être une question (pas une phrase)
  return t.endsWith("?") && t.length >= 20;
}

function endsWithQuestion(caption: string, cta: string) {
  const cap = (caption ?? "").trim();
  const cc = (cta ?? "").trim();
  // ✅ caption doit finir par ? (ou CTA, mais au moins un des deux)
  return cap.endsWith("?") || cc.endsWith("?");
}

function hashtagsOk(hashtags: string) {
  const n = countHashtags(hashtags ?? "");
  return n >= 3 && n <= 5;
}

function computeDebug(out: { caption: string; cta: string; hashtags: string }) {
  const hook = getHook(out.caption ?? "");
  const hookLen = hook.length;
  const captionLen = (out.caption ?? "").trim().length;
  const hCount = countHashtags(out.hashtags ?? "");
  return {
    hook,
    hookLen,
    captionLen,
    hasList: hasList(out.caption ?? ""),
    captionEndsWithQ: (out.caption ?? "").trim().endsWith("?"),
    ctaEndsWithQ: (out.cta ?? "").trim().endsWith("?"),
    hashtagsCount: hCount,
    hookOk: hookOk(hook),
    captionLenOk: captionLenOk(out.caption ?? ""),
    listOk: hasList(out.caption ?? ""),
    ctaOk: ctaOk(out.cta ?? ""),
    hashtagsOk: hashtagsOk(out.hashtags ?? ""),
  };
}

function looksLikeLinkedInOk(out: { caption: string; cta: string; hashtags: string }) {
  const hook = getHook(out.caption ?? "");
  return (
    hookOk(hook) &&
    captionLenOk(out.caption ?? "") &&
    hasList(out.caption ?? "") &&
    endsWithQuestion(out.caption ?? "", out.cta ?? "") &&
    ctaOk(out.cta ?? "") &&
    hashtagsOk(out.hashtags ?? "")
  );
}

/** Répare JSON tronqué / incomplet */
async function repairJsonWithLLM(badText: string) {
  const repairPrompt = `
Tu répares une sortie incomplète ou mal formattée.
Tu dois répondre UNIQUEMENT avec un JSON strict.

Schéma exact:
{"caption":"string","cta":"string","hashtags":"string"}

Règles:
- "cta" est une question ouverte (pas une phrase) et finit par "?".
- "hashtags" = 3 à 5 hashtags max, uniques, une seule ligne.
- Si le texte est tronqué, tu complètes en restant cohérent.
- Ne pas inventer de stats (% / "70%" / "80%") si elles ne sont pas fournies.

Texte à réparer:
"""${badText}"""
`.trim();

  const r = await callLLM(repairPrompt, {
    temperature: 0.2,
    maxOutputTokens: 1800,
    timeoutMs: 45000,
    forceJson: true,
    system: STRICT_SYSTEM,
  });

  return coerceOutput(String(r.text ?? ""));
}

/** REWRITE HOOK ONLY */
/** REWRITE HOOK ONLY (avec retry IA jusqu'à hook strict 150–180) */
async function rewriteHookOnly(args: {
  subject: string;
  language: Lang;
  objective: Objective;
  current: { caption: string; cta: string; hashtags: string };
}) {
  const { subject, language, objective, current } = args;
  const oldCaption = current.caption ?? "";
  const oldHook = getHook(oldCaption);

  // ✅ 3 tentatives max (hook uniquement) = petit coût quota
  for (let attempt = 0; attempt < 3; attempt++) {
    const prompt = `
Tu dois UNIQUEMENT réécrire le HOOK (1ère ligne) d’un post LinkedIn.
Tu réponds UNIQUEMENT en JSON strict.

Langue: ${language}
Objectif: ${objective}
Sujet: ${subject}

Hook actuel:
"${oldHook}"

Contraintes HOOK (NON NÉGOCIABLES):
- commence par "Vous"
- contient au moins 1 chiffre OU 1 "?"
- longueur STRICTE entre 150 et 180 caractères (espaces inclus)
- 1 seule ligne (aucun saut de ligne)
- naturel, conversation early, pas marketing
- Interdiction d'inventer des stats (% / "70%" / "80%"). Si tu mets un chiffre: préfère "3" / "5" / "1".
- Le hook doit se terminer par "?" (recommandé pour déclencher la lecture)

IMPORTANT:
- Compte les caractères avant de répondre. Si tu dépasses 180, réécris.
- Si tu es sous 150, rallonge sans ajouter de chiffres inventés.

Sortie JSON:
{"hook":"..."}
`.trim();

    const r = await callLLM(prompt, {
      temperature: attempt === 0 ? 0.2 : 0.1, // plus strict en retry
      maxOutputTokens: 500,
      timeoutMs: 30000,
      forceJson: true,
      system: `Tu dois répondre UNIQUEMENT avec un JSON strict: {"hook":"string"}.`,
    });

    const obj = safeJsonParse<any>(stripCodeFences(String(r.text ?? "")).trim());
    const newHook = String(obj?.hook ?? "").trim();

    if (!newHook) continue;
    if (!hookOk(newHook)) continue;

    const nextCaption = setHook(oldCaption, newHook);
    return { ...current, caption: nextCaption };
  }

  return null;
}


/** EXTEND CAPTION : 900–1300, hook inchangé + caption finit par ? */
async function extendCaption(args: {
  subject: string;
  language: Lang;
  objective: Objective;
  current: { caption: string; cta: string; hashtags: string };
}) {
  const { subject, language, objective, current } = args;
  const hook = getHook(current.caption ?? "");

  const prompt = `
Tu dois ALLONGER la "caption" à 900–1300 caractères.
Tu dois garder EXACTEMENT le même hook (1ère ligne) inchangé.

Langue: ${language}
Objectif: ${objective}
Sujet: ${subject}

Post actuel (JSON):
${JSON.stringify(current)}

Contraintes:
- Hook inchangé: "${hook}"
- Paragraphes courts (1–2 lignes) + lignes vides.
- Inclure une liste 3–5 points max, chaque ligne commence par "- ".
- Fin de caption = question ouverte "?" (obligatoire).
- CTA = question ouverte (pas une phrase), finit par "?" (obligatoire).
- Hashtags 3–5 max, uniques, une seule ligne.
- Ne pas inventer de stats (% / "70%" / "80%").

Réponds UNIQUEMENT en JSON strict:
{"caption":"...","cta":"...?","hashtags":"#tag1 #tag2 #tag3"}
`.trim();

  const r = await callLLM(prompt, {
    temperature: 0.35,
    maxOutputTokens: 2600,
    timeoutMs: 45000,
    forceJson: true,
    system: STRICT_SYSTEM,
  });

  return coerceOutput(String(r.text ?? ""));
}

/** INJECT LIST (sans casser la fin en ?) */
async function injectList(args: {
  subject: string;
  language: Lang;
  objective: Objective;
  current: { caption: string; cta: string; hashtags: string };
}) {
  const { subject, language, objective, current } = args;

  const prompt = `
Tu dois AJOUTER une liste (3 à 5 points max) dans la caption.
Tu ne dois PAS raccourcir la caption.
Tu dois garder une fin de caption en question "?" (obligatoire).

Langue: ${language}
Objectif: ${objective}
Sujet: ${subject}

Post actuel (JSON):
${JSON.stringify(current)}

Contraintes:
- Liste sur 3–5 lignes, chaque ligne commence par "- ".
- Paragraphes courts + 1 ligne vide entre blocs.
- Fin caption = question ouverte "?" (obligatoire).
- CTA = question ouverte (pas une phrase) qui finit par "?".
- Hashtags 3–5 max, uniques, une seule ligne.
- Ne pas inventer de stats (% / "70%" / "80%").

Réponds UNIQUEMENT en JSON strict:
{"caption":"...","cta":"...?","hashtags":"#tag1 #tag2 #tag3"}
`.trim();

  const r = await callLLM(prompt, {
    temperature: 0.35,
    maxOutputTokens: 2600,
    timeoutMs: 45000,
    forceJson: true,
    system: STRICT_SYSTEM,
  });

  return coerceOutput(String(r.text ?? ""));
}

/** LAST PASS : force caption endsWith ? (si l’IA oublie) */
async function forceCaptionEndsWithQuestion(args: {
  subject: string;
  language: Lang;
  objective: Objective;
  current: { caption: string; cta: string; hashtags: string };
}) {
  const { subject, language, objective, current } = args;

  const prompt = `
Tu dois corriger UNIQUEMENT la fin de la caption pour qu'elle se termine par une question ouverte "?".
Tu gardes le hook (1ère ligne) inchangé et tu conserves le contenu au maximum.

Langue: ${language}
Objectif: ${objective}
Sujet: ${subject}

Post actuel (JSON):
${JSON.stringify(current)}

Règles:
- Hook inchangé
- Caption finit par "?" (obligatoire)
- CTA reste une question finissant par "?"
- Hashtags 3–5 max
- Pas de stats inventées

Réponds UNIQUEMENT en JSON strict:
{"caption":"...","cta":"...?","hashtags":"#tag1 #tag2 #tag3"}
`.trim();

  const r = await callLLM(prompt, {
    temperature: 0.25,
    maxOutputTokens: 1800,
    timeoutMs: 45000,
    forceJson: true,
    system: STRICT_SYSTEM,
  });

  return coerceOutput(String(r.text ?? ""));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });

    const subject = String(body?.subject ?? "").trim();
    if (!subject) return NextResponse.json({ error: "Le sujet est obligatoire." }, { status: 400 });

    const lang = safeLang(body?.language);
    const objective = safeObjective(body?.objective);
    const network: Network = "linkedin";

    const prompt = captionPrompt({
      subject,
      language: lang === "en" ? "English" : "French",
      objective,
      network,
    });

    // 1) génération initiale
    const r1 = await callLLM(prompt, {
      temperature: 0.35,
      maxOutputTokens: 2600,
      timeoutMs: 45000,
      forceJson: true,
      system: STRICT_SYSTEM,
    });

    const raw1 = String(r1.text ?? "");
    let out = coerceOutput(raw1);

    // 2) repair JSON si besoin
    if (!out || !out.caption || !out.cta || !out.hashtags) {
      const repaired = await repairJsonWithLLM(stripCodeFences(raw1).slice(0, 8000));
      if (repaired && repaired.caption) out = repaired;
    }

    if (!out || !out.caption) {
      return NextResponse.json(
        { error: "La génération IA n’a pas produit un JSON valide.", code: "bad_output", raw: stripCodeFences(raw1).slice(0, 2000) },
        { status: 502 }
      );
    }

    // ✅ Boucles ciblées (petit budget quota)
    for (let i = 0; i < 4; i++) {
      const hook = getHook(out.caption ?? "");
      if (hookOk(hook)) break;
      const fixedHook = await rewriteHookOnly({ subject, language: lang, objective, current: out });
      if (fixedHook && fixedHook.caption) out = fixedHook;
      else break;
    }

    for (let i = 0; i < 4; i++) {
      if (captionLenOk(out.caption ?? "")) break;
      const extended = await extendCaption({ subject, language: lang, objective, current: out });
      if (extended && extended.caption) out = extended;
      else break;
    }

    if (!hasList(out.caption ?? "")) {
      const withList = await injectList({ subject, language: lang, objective, current: out });
      if (withList && withList.caption) out = withList;
    }

    // ✅ Dernière passe: caption doit finir par "?"
    if (!(out.caption ?? "").trim().endsWith("?")) {
      const fixedEnd = await forceCaptionEndsWithQuestion({ subject, language: lang, objective, current: out });
      if (fixedEnd && fixedEnd.caption) out = fixedEnd;
    }

    const compliant = looksLikeLinkedInOk(out);
    const debug = computeDebug(out);

    return NextResponse.json({
      output: JSON.stringify({ caption: out.caption, cta: out.cta, hashtags: out.hashtags }, null, 0),
      compliant,
      debug,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "Erreur inconnue");
    const lower = msg.toLowerCase();

    const isTimeout = lower.includes("timeout") || lower.includes("aborterror") || lower.includes("504");
    const isQuota = lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("rate limit") || lower.includes("429");

    if (isTimeout) return NextResponse.json({ error: msg, code: "timeout" }, { status: 504 });
    if (isQuota) return NextResponse.json({ error: msg, code: "quota" }, { status: 429 });

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
