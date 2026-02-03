// src/lib/provider.ts
import "server-only";

type CallOpts = {
  temperature?: number;
  maxOutputTokens?: number;
  system?: string;
};

type CallResult = {
  text: string;
  model: string;
  keyIndex: number;
};

function getEnvList(name: string): string[] {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractTextFromGemini(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const t = parts.map((p: any) => p?.text).filter(Boolean).join("\n").trim();
    if (t) return t;
  }
  const t2 = data?.candidates?.[0]?.output;
  if (typeof t2 === "string" && t2.trim()) return t2.trim();
  const t3 = data?.text;
  if (typeof t3 === "string" && t3.trim()) return t3.trim();
  return "";
}

function isRetryableStatus(status: number) {
  // 503 overloaded / 500 server, parfois 429 rate-limit
  return status === 503 || status === 500 || status === 429;
}

function isQuotaError(msg: string) {
  const m = (msg ?? "").toLowerCase();
  return (
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("resource_exhausted") ||
    m.includes("exceeded your current quota")
  );
}

export async function callLLM(prompt: string, opts: CallOpts = {}): Promise<CallResult> {
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const keys =
    getEnvList("LLM_API_KEYS").length > 0
      ? getEnvList("LLM_API_KEYS")
      : (process.env.LLM_API_KEY ? [String(process.env.LLM_API_KEY)] : []);

  if (keys.length === 0) {
    throw new Error("LLM_API_KEY(S) manquant. Ajoute LLM_API_KEYS dans .env.local et sur Vercel.");
  }

  const models =
    getEnvList("LLM_MODELS").length > 0
      ? getEnvList("LLM_MODELS")
      : (process.env.LLM_MODEL ? [String(process.env.LLM_MODEL)] : ["gemini-2.5-flash"]);

  const temperature = typeof opts.temperature === "number" ? opts.temperature : 0.6;
  const maxOutputTokens = typeof opts.maxOutputTokens === "number" ? opts.maxOutputTokens : 900;

  let lastErr: { status?: number; message: string } | null = null;

  // clé1 -> clé2 -> clé3
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];

    // modèle1 -> modèle2 -> ...
    for (const model of models) {
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

      // petit retry local si 503 (overloaded)
      for (let attempt = 0; attempt < 2; attempt++) {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(opts.system
              ? { systemInstruction: { parts: [{ text: opts.system }] } }
              : {}),
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens },
          }),
        });

        const data = await resp.json().catch(() => null);

        if (resp.ok) {
          const text = extractTextFromGemini(data);
          if (!text) {
            lastErr = { status: 502, message: "Réponse Gemini vide ou inattendue." };
            break; // essaye modèle suivant
          }
          return { text, model, keyIndex: k };
        }

        const msg = data?.error?.message ? String(data.error.message) : `Erreur Gemini (${resp.status})`;
        lastErr = { status: resp.status, message: msg };

        // 404 => modèle invalide => on passe au modèle suivant (sans retry)
        if (resp.status === 404) break;

        // quota / rate limit => on passe à la clé suivante (sans retry)
        if (resp.status === 429 || isQuotaError(msg)) break;

        // overloaded => petit backoff puis retry
        if (isRetryableStatus(resp.status) && attempt === 0) {
          await sleep(900);
          continue;
        }

        break;
      }
    }
  }

  const s = lastErr?.status ?? 500;
  const m = lastErr?.message ?? "Erreur inconnue";
  throw new Error(`Toutes les clés ont échoué. Dernière erreur (${s}) : ${m}`);
}
