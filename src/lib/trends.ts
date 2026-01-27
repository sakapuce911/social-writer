export async function getTrendKeywords(params: {
  subject: string;
  language: string;
  objective: string;
}): Promise<string[]> {
  const url = process.env.TRENDS_API_URL; // optionnel
  const apiKey = process.env.TRENDS_API_KEY; // optionnel

  // ✅ Si tu branches une source externe (ton API, SerpAPI, etc.)
  // Elle doit renvoyer JSON: { "keywords": ["...","..."] }
  if (url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.keywords)) {
          return data.keywords.map((x: any) => String(x)).filter(Boolean).slice(0, 15);
        }
      }
    } catch {
      // ignore -> fallback
    }
  }

  // ✅ Fallback “offline” : on renvoie une base générique (utile si pas de source branchée)
  // L’IA complètera ensuite avec des mots-clés spécifiques au sujet.
  const base = [
    "astuce",
    "conseils",
    "checklist",
    "erreurs à éviter",
    "guide",
    "2026",
    "tendance",
    "stratégie",
    "méthode",
    "productivité",
    "business",
    "marketing",
    "vente",
    "lead",
    "croissance",
  ];

  return base.slice(0, 12);
}
