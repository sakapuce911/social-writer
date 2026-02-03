// src/lib/provider.ts

type LLMResponse = { text: string };

function stripCodeFences(s: string) {
  return (s ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractTextFromGemini(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  if (!Array.isArray(parts)) return "";
  const joined = parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
  return stripCodeFences(joined);
}

/**
 * ✅ callLLM
 * - Gemini Generative Language API
 * - Sortie: texte brut (souvent JSON string côté /api/generate)
 * - Stable: température modérée + retry léger
 */
export async function callLLM(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;

  if (!apiKey || !baseUrl || !model) {
    throw new Error("Config manquante: LLM_API_KEY / LLM_BASE_URL / LLM_MODEL dans .env.local");
  }

  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // ✅ On veut: JSON strict / consignes respectées -> stabilité > créativité
  // (Le prompt impose déjà le style; on réduit la dérive)
  const generationConfig = {
    temperature: 0.35,
    topP: 0.9,
    maxOutputTokens: 4096,
    // Certaines implémentations acceptent stopSequences; si non supporté, Gemini ignore
    stopSequences: ["```", "```json"],
  };

  // 1 retry max (utile quand Gemini renvoie vide / tronqué)
  const attempts = 2;
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Erreur Gemini (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = extractTextFromGemini(data);

      if (!text.trim()) {
        throw new Error("Réponse Gemini vide ou inattendue.");
      }

      return { text: text.trim() };
    } catch (e) {
      lastErr = e;

      // petit backoff (sans setTimeout bloquant)
      // on relance immédiatement (tentative 2) si nécessaire
      continue;
    }
  }

  // si tout échoue
  if (lastErr instanceof Error) throw lastErr;
  throw new Error("Erreur inconnue (Gemini).");
}
