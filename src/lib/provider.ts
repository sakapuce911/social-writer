type LLMResponse = { text: string };

export async function callLLM(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;

  if (!apiKey || !baseUrl || !model) {
    throw new Error("Config manquante: LLM_API_KEY / LLM_BASE_URL / LLM_MODEL dans .env.local");
  }

  // ✅ Gemini Generative Language API
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        // ✅ LinkedIn (1000–2000 car.) a besoin de plus de tokens
        // 2048 coupe souvent. On monte.
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erreur Gemini (${res.status}): ${errText}`);
  }

  const data = await res.json();

  // ✅ IMPORTANT: parfois Gemini renvoie plusieurs parts
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? "").join("") : "";

  if (!text.trim()) {
    throw new Error("Réponse Gemini vide ou inattendue.");
  }

  return { text: text.trim() };
}
