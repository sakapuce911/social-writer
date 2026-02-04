// src/app/api/generate/route.ts
import { NextResponse } from "next/server";
import { callLLM } from "@/lib/provider";
import { captionPrompt, type Objective } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "fr" | "en";
type Network = "linkedin";

function safeLang(input: unknown): Lang {
  return String(input ?? "").toLowerCase() === "en" ? "en" : "fr";
}

function safeObjective(input: unknown): Objective {
  const v = String(input ?? "").toLowerCase();
  if (v === "vendre") return "vendre";
  if (v === "attirer") return "attirer";
  if (v === "recruter") return "recruter";
  if (v === "inspirer") return "inspirer";
  if (v === "éduquer" || v === "eduquer") return "éduquer";
  return "attirer";
}

function stripCodeFences(s: string) {
  return (s ?? "")
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractFirstJSONObject(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  return null;
}

function safeJsonParse<T = any>(s: string): T | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractHashtags(text: string): string[] {
  const found = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return Array.from(new Set(found)).slice(0, 5);
}

function extractCTA(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].endsWith("?")) return lines[i];
  }
  return "Quelle est votre expérience concrète sur ce sujet ?";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const subject = String(body?.subject ?? "").trim();
    if (!subject) {
      return NextResponse.json({ error: "Sujet manquant." }, { status: 400 });
    }

    const lang = safeLang(body?.language);
    const objective = safeObjective(body?.objective);
    const network: Network = "linkedin";

    const prompt = captionPrompt({
      subject,
      language: lang === "en" ? "English" : "French",
      objective,
      network,
    });

    // 🔥 UN SEUL APPEL IA
    const r = await callLLM(prompt, {
      temperature: 0.3,
      maxOutputTokens: 1100,
    });

    const rawText = stripCodeFences(String((r as any)?.text ?? "")).trim();

    // 1️⃣ Tentative JSON
    let obj = safeJsonParse<any>(rawText);

    if (!obj) {
      const extracted = extractFirstJSONObject(rawText);
      if (extracted) obj = safeJsonParse<any>(extracted);
    }

    // 2️⃣ Fallback SANS ERREUR
    let caption: string;
    let cta: string;
    let hashtags: string[];

    if (obj && typeof obj.caption === "string") {
      caption = obj.caption.trim();
      cta = String(obj.cta ?? extractCTA(caption)).trim();
      hashtags = Array.isArray(obj.hashtags)
        ? obj.hashtags.slice(0, 5)
        : extractHashtags(caption);
    } else {
      // 🔒 MODE "ÇA MARCHE TOUJOURS"
      caption = rawText;
      cta = extractCTA(rawText);
      hashtags = extractHashtags(rawText);
    }

    return NextResponse.json({
      output: JSON.stringify({
        caption,
        cta,
        hashtags,
      }),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}
