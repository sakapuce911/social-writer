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
  // 503 overloaded / 500 server / 429 rate-limit
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

function normalizeBaseUrl(raw: string) {
  // On veut: https://generativelanguage.googleapis.com/v1beta
  let base = (raw || "https://generativelanguage.googleapis.com/v1beta").trim();
  base = base.replace(/\/+$/, "");
  if (!/\/v1beta$/i.test(base)) base = base + "/v1beta";
  return base.replace(/\/+$/, "");
}

function buildModelsList(): string[] {
  // Priorité:
  // 1) LLM_MODELS="m1,m2,m3"
  // 2) LLM_MODEL_PRIMARY + LLM_MODEL_FALLBACKS
  // 3) LLM_MODEL
  // 4) défaut
  const list = getEnvList("LLM_MODELS");
  if (list.length > 0) return list;

  const primary = (process.env.LLM_MODEL_PRIMARY ?? "").trim();
  const fallbacks = getEnvList("LLM_MODEL_FALLBACKS");
  if (primary) return [primary, ...fallbacks].filter(Boolean);

  const single = (process.env.LLM_MODEL ?? "").trim();
  if (single) return [single];

  return ["gemini-2.0-flash", "gemini-1.5-flash"];
}

// Hash simple (FNV-1a) pour un "start index" stable sans crypto
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

/**
 * ✅ Blacklist/Cooldown des clés en mémoire (par instance).
 * keyId = index dans LLM_API_KEYS.
 * value = timestamp (ms) jusqu'auquel la clé est en cooldown.
 */
const keyCooldownUntil = new Map<number, number>();

function nowMs() {
  return Date.now();
}

function getCooldownMs(kind: "quota" | "auth" | "overloaded" | "other") {
  // Valeurs par défaut (tu peux les override via .env)
  // - quota: 10 min
  // - auth (401/403): 60 min (souvent clé morte)
  // - overloaded: 15 sec
  // - other: 60 sec
  const env = (name: string) => {
    const v = Number(process.env[name] ?? "");
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  const quotaSec = env("LLM_COOLDOWN_QUOTA_SEC") ?? 10 * 60;
  const authSec = env("LLM_COOLDOWN_AUTH_SEC") ?? 60 * 60;
  const overloadedSec = env("LLM_COOLDOWN_OVERLOADED_SEC") ?? 15;
  const otherSec = env("LLM_COOLDOWN_OTHER_SEC") ?? 60;

  const sec =
    kind === "quota" ? quotaSec :
    kind === "auth" ? authSec :
    kind === "overloaded" ? overloadedSec :
    otherSec;

  return sec * 1000;
}

function isKeyInCooldown(keyIndex: number) {
  const until = keyCooldownUntil.get(keyIndex);
  if (!until) return false;
  if (until <= nowMs()) {
    keyCooldownUntil.delete(keyIndex);
    return false;
  }
  return true;
}

function setKeyCooldown(keyIndex: number, kind: "quota" | "auth" | "overloaded" | "other") {
  const ms = getCooldownMs(kind);
  const until = nowMs() + ms;
  const prev = keyCooldownUntil.get(keyIndex) ?? 0;
  // on prolonge si déjà en cooldown mais moins long
  if (until > prev) keyCooldownUntil.set(keyIndex, until);
}

export async function callLLM(prompt: string, opts: CallOpts = {}): Promise<CallResult> {
  const baseUrl = normalizeBaseUrl(process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta");

  const keys =
    getEnvList("LLM_API_KEYS").length > 0
      ? getEnvList("LLM_API_KEYS")
      : (process.env.LLM_API_KEY ? [String(process.env.LLM_API_KEY)] : []);

  if (keys.length === 0) {
    throw new Error("LLM_API_KEY(S) manquant. Ajoute LLM_API_KEYS dans .env.local et sur Vercel.");
  }

  const models = buildModelsList();

  const temperature = typeof opts.temperature === "number" ? opts.temperature : 0.6;
  const maxOutputTokens = typeof opts.maxOutputTokens === "number" ? opts.maxOutputTokens : 900;

  let lastErr: { status?: number; message: string } | null = null;

  const start = pickStartIndex(keys, prompt);

  // On tente toutes les clés (en sautant celles en cooldown)
  for (let ki = 0; ki < keys.length; ki++) {
    const keyIndex = (start + ki) % keys.length;

    // ✅ skip si cooldown
    if (isKeyInCooldown(keyIndex)) continue;

    const key = keys[keyIndex];

    for (const model of models) {
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

      for (let attempt = 0; attempt < 2; attempt++) {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens },
          }),
        });

        const data = await resp.json().catch(() => null);

        if (resp.ok) {
          const text = extractTextFromGemini(data);
          if (!text) {
            lastErr = { status: 502, message: "Réponse Gemini vide ou inattendue." };
            break; // modèle suivant
          }
          return { text, model, keyIndex };
        }

        const msg = data?.error?.message ? String(data.error.message) : `Erreur Gemini (${resp.status})`;
        lastErr = { status: resp.status, message: msg };

        // 404 => modèle invalide => modèle suivant
        if (resp.status === 404) break;

        // ✅ 401/403 => clé morte / non autorisée => cooldown long + clé suivante
        if (resp.status === 401 || resp.status === 403) {
          setKeyCooldown(keyIndex, "auth");
          break;
        }

        // ✅ quota / rate-limit => cooldown quota + clé suivante
        if (resp.status === 429 || isQuotaError(msg)) {
          setKeyCooldown(keyIndex, "quota");
          break;
        }

        // ✅ overloaded => petit cooldown + retry 1 fois
        if (resp.status === 503) {
          setKeyCooldown(keyIndex, "overloaded");
          if (attempt === 0) {
            await sleep(900);
            continue;
          }
          break;
        }

        // 500/429 retryable => retry 1 fois, sinon stop
        if (isRetryableStatus(resp.status) && attempt === 0) {
          await sleep(900);
          continue;
        }

        // Autres erreurs => cooldown léger pour éviter boucle
        setKeyCooldown(keyIndex, "other");
        break;
      }
    }

    // Si on arrive ici, la clé n'a pas réussi (tous modèles/attempts)
    // On essaie la clé suivante…
  }

  // Si toutes les clés sont en cooldown et qu'on a tout sauté, on force un essai:
  // (sinon on pourrait rester bloqué si cooldown trop long)
  const allInCooldown = keys.every((_, idx) => isKeyInCooldown(idx));
  if (allInCooldown) {
    // on "débloque" la clé la plus proche de fin de cooldown
    let bestIdx = 0;
    let bestUntil = Infinity;
    for (let i = 0; i < keys.length; i++) {
      const until = keyCooldownUntil.get(i) ?? 0;
      if (until < bestUntil) {
        bestUntil = until;
        bestIdx = i;
      }
    }
    keyCooldownUntil.delete(bestIdx);
    // Une relance rapide
    return callLLM(prompt, opts);
  }

  const s = lastErr?.status ?? 500;
  const m = lastErr?.message ?? "Erreur inconnue";
  throw new Error(`Toutes les clés ont échoué. Dernière erreur (${s}) : ${m}`);
}
