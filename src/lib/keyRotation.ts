// src/lib/keyRotation.ts

function splitKeys(s?: string) {
  return (s ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function getRotatingKeys(primaryEnv: string, fallbackEnv?: string) {
  const primary = splitKeys(process.env[primaryEnv]);
  if (primary.length > 0) return primary;

  const fb = (process.env[fallbackEnv ?? ""] ?? "").trim();
  if (fb) return [fb];

  return [];
}

export function isQuotaError(msg: string) {
  const m = (msg ?? "").toLowerCase();
  return (
    m.includes("quota") ||
    m.includes("resource_exhausted") ||
    m.includes("rate limit") ||
    m.includes("exceeded your current quota") ||
    m.includes("limit: 0")
  );
}
