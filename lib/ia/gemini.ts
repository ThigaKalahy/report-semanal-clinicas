import type { DestaqueItem } from "@/lib/relatorio/imagem-tipos";

export interface SugestaoIA {
  destaques: DestaqueItem[];
  alertas: string[];
  acoes: string[];
}

const MODEL    = "gemini-1.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function callGemini(
  systemPrompt: string,
  userContent: string,
): Promise<SugestaoIA> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: {
          temperature:      0.3,
          maxOutputTokens:  1024,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403)
        throw new Error("Chave de API inválida ou sem permissão (Gemini).");
      if (res.status === 429)
        throw new Error("Cota do Gemini esgotada. Tente novamente em alguns minutos.");
      throw new Error(`Erro na API do Gemini (HTTP ${res.status}).`);
    }

    const json    = await res.json();
    const rawText = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
    if (!rawText) throw new Error("Resposta vazia da IA.");

    // Strip markdown fences in case responseMimeType didn't prevent them
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as SugestaoIA;
    if (!Array.isArray(parsed.destaques)) parsed.destaques = [];
    if (!Array.isArray(parsed.alertas))   parsed.alertas   = [];
    if (!Array.isArray(parsed.acoes))     parsed.acoes     = [];

    return parsed;
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === "AbortError")
        throw new Error("Timeout: a IA demorou mais de 30 s para responder.");
      throw e;
    }
    throw new Error("Erro desconhecido ao chamar a IA.");
  } finally {
    clearTimeout(timer);
  }
}
