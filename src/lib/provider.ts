// src/lib/provider.ts
import "server-only";

type CallOpts = {
  temperature?: number;
  maxOutputTokens?: number;
  system?: string;

  // ✅ force JSON (Gemini)
  responseMimeType?: "application/json" | "text/plain";

  // ✅ timeout par requête (ms)
  timeoutMs?: number;

  // ✅ compat: quand tu veux forcer du JSON
  forceJson?: boolean;
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

function isQuotaError(msg: string) {
  const m = (msg ?? "").toLowerCase();
  return (
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("resource_exhausted") ||
    m.includes("exceeded your current quota") ||
    m.includes("limit: 0") ||
    m.includes("insufficient quota")
  );
}

function normalizeBaseUrl(raw: string) {
  let base = (raw || "https://generativelanguage.googleapis.com/v1beta").trim();
  base = base.replace(/\/+$/, "");
  if (!/\/v1beta$/i.test(base)) base = base + "/v1beta";
  return base.replace(/\/+$/, "");
}

// Hash simple (FNV-1a)
function fnv1a32(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickStartIndex(keys: string[], prompt: string) {
  const strategy = String(process.env.LLM_KEY_STRATEGY ?? "").trim().toLowerCase();
  if (strategy === "random") return Math.floor(Math.random() * keys.length);
  return fnv1a32(prompt) % keys.length;
}

function envTimeoutMs() {
  const v = Number(process.env.LLM_TIMEOUT_MS ?? "");
  return Number.isFinite(v) && v > 0 ? v : null;
}

function devLog(...args: any[]) {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[LLM]", ...args);
  }
}

/**
 * ✅ fetch "anti-blocage" :
 * - AbortController
 * - + Promise.race hard-timeout
 *
 * FIX: pas de référence à timeoutPromise avant initialisation
 */
async function fetchWithHardTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
      reject(new Error(`Timeout après ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const fetchPromise = fetch(url, { ...init, signal: controller.signal });
    const resp = await Promise.race([fetchPromise, timeoutPromise]);
    return resp as Response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function buildModelsList(): string[] {
  const list = getEnvList("LLM_MODELS");
  if (list.length > 0) return list;

  const primary = (process.env.LLM_MODEL_PRIMARY ?? "").trim();
  const fallbacks = getEnvList("LLM_MODEL_FALLBACKS");
  if (primary) return [primary, ...fallbacks].filter(Boolean);

  const single = (process.env.LLM_MODEL ?? "").trim();
  if (single) return [single];

  return ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
}

export async function callLLM(prompt: string, opts: CallOpts = {}): Promise<CallResult> {
  const baseUrl = normalizeBaseUrl(process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta");

  const keys =
    getEnvList("LLM_API_KEYS").length > 0
      ? getEnvList("LLM_API_KEYS")
      : process.env.LLM_API_KEY
        ? [String(process.env.LLM_API_KEY)]
        : [];

  if (keys.length === 0) {
    throw new Error("LLM_API_KEY(S) manquant. Ajoute LLM_API_KEYS dans .env.local et sur Vercel.");
  }

  const models = buildModelsList();

  const temperature = typeof opts.temperature === "number" ? opts.temperature : 0.6;
  const maxOutputTokens = typeof opts.maxOutputTokens === "number" ? opts.maxOutputTokens : 900;

  const timeoutMs =
    typeof opts.timeoutMs === "number" && opts.timeoutMs > 0
      ? opts.timeoutMs
      : envTimeoutMs() ?? 15000;

  const responseMimeType =
    opts.forceJson ? "application/json" : (opts.responseMimeType ?? "text/plain");

  const start = pickStartIndex(keys, prompt);

  // ✅ Politique "quota gratuit" :
  // - on essaye clé -> modèle, sans boucle infinie
  // - si quota, on passe à la clé suivante
  let lastErr: { status?: number; message: string } | null = null;

  for (let ki = 0; ki < keys.length; ki++) {
    const keyIndex = (start + ki) % keys.length;
    const key = keys[keyIndex];

    for (const model of models) {
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

      let resp: Response | null = null;
      let data: any = null;

      try {
        devLog(`call model=${model} keyIndex=${keyIndex} timeoutMs=${timeoutMs}`);

        resp = await fetchWithHardTimeout(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens,
                responseMimeType,
              },
            }),
          },
          timeoutMs
        );

        data = await resp.json().catch(() => null);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        lastErr = { status: 504, message: msg };
        devLog(`timeout/error keyIndex=${keyIndex} model=${model} -> ${msg}`);
        continue; // essaye modèle/clé suivante
      }

      if (resp.ok) {
        const text = extractTextFromGemini(data);
        if (!text) {
          lastErr = { status: 502, message: "Réponse Gemini vide ou inattendue." };
          devLog(`empty response model=${model} keyIndex=${keyIndex}`);
          continue;
        }
        devLog(`ok model=${model} keyIndex=${keyIndex} chars=${text.length}`);
        return { text, model, keyIndex };
      }

      const msg = data?.error?.message ? String(data.error.message) : `Erreur Gemini (${resp.status})`;
      lastErr = { status: resp.status, message: msg };
      devLog(`http ${resp.status} model=${model} keyIndex=${keyIndex} -> ${msg}`);

      // quota -> essayer autre clé
      if (resp.status === 429 || isQuotaError(msg)) break;

      // auth -> essayer autre clé
      if (resp.status === 401 || resp.status === 403) break;

      // 404 -> modèle indispo -> essayer fallback modèle
      if (resp.status === 404) continue;

      // autres erreurs -> essayer fallback modèle (continue)
      continue;
    }
  }

  const s = lastErr?.status ?? 500;
  const m = lastErr?.message ?? "Erreur inconnue";

  if (s === 429 || isQuotaError(m)) {
    throw new Error(`Quota Gemini gratuit épuisé / indisponible. (${s}) ${m}`);
  }

  throw new Error(`Appel Gemini échoué. Dernière erreur (${s}) : ${m}`);
}
