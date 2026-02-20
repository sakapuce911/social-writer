// src/app/api/profile-preview/route.ts
import "server-only";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfilePreview = {
  name: string;
  headline: string;
  image: string; // url
  sourceUrl: string;
};

function normalizeUrl(input: string) {
  let u = String(input ?? "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  u = u.replace(/\s+/g, "");
  return u;
}

function isAllowedLinkedInProfileUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "linkedin.com" || host === "www.linkedin.com" || host.endsWith(".linkedin.com"))) return false;
    if (!u.pathname.startsWith("/in/")) return false;
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(s: string) {
  return (s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractMeta(html: string, key: string) {
  const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta\\s+[^>]*(?:property|name)=["']${safeKey}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return decodeHtmlEntities(m?.[1] ?? "");
}

function pickFirst(...vals: Array<string | undefined | null>) {
  for (const v of vals) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
}

function cleanName(raw: string) {
  // OG title LinkedIn souvent: "Nom Prénom | LinkedIn"
  return (raw ?? "").replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
}

function cleanHeadline(raw: string) {
  // OG description souvent OK, on enlève juste "| LinkedIn" si présent
  return (raw ?? "").replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      // @ts-ignore (Next fetch)
      cache: "no-store",
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: string };
    const url = normalizeUrl(body?.url ?? "");

    if (!url) {
      return NextResponse.json({ profile: null, error: "URL manquante." }, { status: 400 });
    }

    if (!isAllowedLinkedInProfileUrl(url)) {
      return NextResponse.json(
        { profile: null, error: "URL LinkedIn invalide (attendu: linkedin.com/in/...)." },
        { status: 400 }
      );
    }

    // ✅ timeout court pour ne JAMAIS “figer” l’UI
    const res = await fetchWithTimeout(url, 6000);

    // LinkedIn renvoie parfois 999/403/login wall
    if (!res.ok) {
      return NextResponse.json(
        { profile: null, error: `LinkedIn bloque ou refuse (HTTP ${res.status}).` },
        { status: 200 }
      );
    }

    const html = await res.text();

    // OG tags + fallback twitter
    const ogTitle = extractMeta(html, "og:title");
    const ogDesc = extractMeta(html, "og:description");
    const ogImg = extractMeta(html, "og:image");

    const twTitle = extractMeta(html, "twitter:title");
    const twDesc = extractMeta(html, "twitter:description");
    const twImg = extractMeta(html, "twitter:image");

    const name = cleanName(pickFirst(ogTitle, twTitle));
    const headline = cleanHeadline(pickFirst(ogDesc, twDesc));
    const image = pickFirst(ogImg, twImg);

    const hasSomething = Boolean(name || headline || image);
    if (!hasSomething) {
      return NextResponse.json(
        { profile: null, error: "Aucune donnée exploitable trouvée (LinkedIn bloque peut-être)." },
        { status: 200 }
      );
    }

    const profile: ProfilePreview = {
      name,
      headline,
      image,
      sourceUrl: url,
    };

    return NextResponse.json({ profile }, { status: 200 });
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "Timeout LinkedIn (6s)." : "Erreur serveur.";
    return NextResponse.json({ profile: null, error: msg }, { status: 200 });
  }
}