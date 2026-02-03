// src/lib/provider.ts
// Provider unique: Google Generative Language (Gemini) via REST
// ✅ Rotation des clés (LLM_API_KEYS -> fallback LLM_API_KEY)
// ✅ Retry automatique sur erreurs quota / rate limit
// ✅ Extraction texte robuste

export type LLMResult = {
  text: string;
  raw?: any;
  keyIndexUsed?: number;
};

function splitKeys(s?: string) {
  return (s ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function getKeys(): string[] {
  const keys = splitKeys(process.env.LLM_API_KEYS);
  if (keys.length > 0) return keys;

  const single = (process.env.LLM_API_KEY ?? "").trim();
  if (single) return [single];

  return [];
}

function isQuotaOrRateLimit(status: number, message: string) {
  const m = (message ?? "").toLowerCase();
  return (
    status === 429 ||
    m.includes("quota") ||
    m.includes("resource_exhausted") ||
    m.includes("rate limit") ||
    m.includes("exceeded your current quota") ||
    m.includes("limit: 0")
  );
}

function extractGeminiText(data: any): string {
  // Format courant : candidates[0].content.parts[].text
  const t1 = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text)
    .filter(Boolean)
    .join("\n");
  if (typeof t1 === "string" && t1.trim()) return t1.trim();

  // Autres formats possibles
  const t2 = data?.candidates?.[0]?.output;
  if (typeof t2 === "string" && t2.trim()) return t2.trim();

  const t3 = data?.candidates?.[0]?.content?.text;
  if (typeof t3 === "string" && t3.trim()) return t3.trim();

  const t4 = data?.text;
  if (typeof t4 === "string" && t4.trim()) return t4.trim();

  return "";
}

/**
 * callLLM(prompt) -> { text }
 * - prompt: string (texte complet)
 * - tente clé par clé si quota / rate limit
 */
export async function callLLM(
  prompt: string,
  opts?: {
    temperature?: number;
    maxOutputTokens?: number;
    model?: string; // override
  }
): Promise<LLMResult> {
  const keys = getKeys();
  if (keys.length === 0) {
    throw new Error("LLM_API_KEYS/LLM_API_KEY manquant. Ajoute-le dans .env.local et sur Vercel.");
  }

  const baseUrl = (process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const model = (opts?.model ?? process.env.LLM_MODEL ?? "gemini-2.0-flash").trim();

  const temperature = typeof opts?.temperature === "number" ? opts!.temperature : 0.7;
  const maxOutputTokens = typeof opts?.maxOutputTokens === "number" ? opts!.maxOutputTokens : 900;

  let lastErrMsg = "Erreur inconnue";
  let lastStatus = 0;

  // Rotation : on essaye chaque clé
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: String(prompt ?? "") }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
    });

    const data = await resp.json().catch(() => null);

    if (resp.ok) {
      const text = extractGeminiText(data);
      if (!text) {
        // Réponse vide => on tente la clé suivante (rare, mais possible)
        lastErrMsg = "Réponse Gemini vide ou inattendue.";
        lastStatus = 200;
        continue;
      }
      return { text, raw: data, keyIndexUsed: i };
    }

    const msg = data?.error?.message ? String(data.error.message) : `Erreur Gemini (${resp.status})`;
    lastErrMsg = msg;
    lastStatus = resp.status;

    // quota/rate limit => on tente la clé suivante
    if (isQuotaOrRateLimit(resp.status, msg)) {
      continue;
    }

    // Autres erreurs => on stop, pas besoin de brûler toutes les clés
    break;
  }

  throw new Error(`Toutes les clés ont échoué. Dernière erreur (${lastStatus}) : ${lastErrMsg}`);
}
