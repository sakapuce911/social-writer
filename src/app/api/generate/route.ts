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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });

    const subject = String(body?.subject ?? "").trim();
    if (!subject) return NextResponse.json({ error: "Le sujet est obligatoire." }, { status: 400 });

    const lang = safeLang(body?.language);
    const objective = safeObjective(body?.objective);

    // Social Writer = LinkedIn only
    const network: Network = "linkedin";

    // ✅ Prompt "audit-friendly" (format CAPTION/CTA/HASHTAGS)
    const prompt = captionPrompt({
      subject,
      language: lang === "en" ? "English" : "French",
      objective,
      network,
    });

    // ✅ 1 seul appel IA
    const r = await callLLM(prompt, { temperature: 0.4, maxOutputTokens: 1200 });
    const text = stripCodeFences(String((r as any)?.text ?? "")).trim();

    // ✅ On renvoie tel quel : ton page.tsx sait parser CAPTION/CTA/HASHTAGS
    return NextResponse.json({ output: text || "CAPTION:\n\nCTA:\nQuelle est votre expérience concrète sur ce sujet ?\n\nHASHTAGS:\n#linkedin #strategiecontenu #personalbranding" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur inconnue" }, { status: 500 });
  }
}
