import type { DestaqueItem } from "@/lib/relatorio/imagem-tipos";

export interface SugestaoIA {
  destaques: DestaqueItem[];
  alertas: string[];
  acoes: string[];
}

// Modelos confirmados disponíveis via GET /v1beta/models (junho 2026).
// Se o primário retornar 404 a função tenta o fallback automaticamente.
const PRIMARY_MODEL  = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";
const API_BASE       = "https://generativelanguage.googleapis.com/v1beta/models";

// Schema que força o Gemini a produzir JSON estruturado (sem texto fora do objeto).
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    destaques: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo:  { type: "string", enum: ["positivo", "financeiro", "atencao"] },
          texto: { type: "string" },
        },
        required: ["tipo", "texto"],
      },
    },
    alertas: { type: "array", items: { type: "string" } },
    acoes:   { type: "array", items: { type: "string" } },
  },
  required: ["destaques", "alertas", "acoes"],
};

function endpointFor(model: string) {
  return `${API_BASE}/${model}:generateContent`;
}

function buildBody(systemPrompt: string, userContent: string) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: {
      temperature:      0.3,
      maxOutputTokens:  2048,
      responseMimeType: "application/json",
      responseSchema:   RESPONSE_SCHEMA,
    },
  };
}

async function doRequest(
  model: string,
  apiKey: string,
  body: object,
  signal: AbortSignal,
): Promise<Response> {
  const masked = `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`;
  console.log(`[gemini] POST ${endpointFor(model)}?key=${masked}`);
  return fetch(`${endpointFor(model)}?key=${apiKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    signal,
  });
}

/** Extrai JSON defensivamente: remove fences, faz trim, recorta {…} externo. */
function extractJSON(raw: string): string {
  // Remove markdown fences
  let s = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Recorta do primeiro { até o último } — protege contra prefixo/sufixo de texto
  const start = s.indexOf("{");
  const end   = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  return s;
}

export async function callGemini(
  systemPrompt: string,
  userContent: string,
): Promise<SugestaoIA> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 30_000);
  const body       = buildBody(systemPrompt, userContent);

  try {
    let res = await doRequest(PRIMARY_MODEL, apiKey, body, controller.signal);

    // Fallback automático se o modelo primário não existir
    if (res.status === 404) {
      console.log(`[gemini] ${PRIMARY_MODEL} → 404, tentando fallback ${FALLBACK_MODEL}`);
      res = await doRequest(FALLBACK_MODEL, apiKey, body, controller.signal);
      if (res.status === 404) {
        throw new Error(
          `Modelos ${PRIMARY_MODEL} e ${FALLBACK_MODEL} não encontrados (HTTP 404). ` +
          `Atualize os nomes em lib/ia/gemini.ts.`
        );
      }
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403)
        throw new Error("Chave de API inválida ou sem permissão (Gemini).");
      if (res.status === 429)
        throw new Error("Cota do Gemini esgotada. Tente novamente em alguns minutos.");
      const errBody = await res.text().catch(() => "");
      throw new Error(`Erro na API do Gemini (HTTP ${res.status}): ${errBody.slice(0, 300)}`);
    }

    const json    = await res.json();
    const rawText = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;

    // Log temporário da resposta crua — aparece no terminal do servidor (Next.js)
    console.log(`[gemini] resposta crua (${rawText.length} chars):`, rawText.slice(0, 500));

    if (!rawText) throw new Error("Resposta vazia da IA.");

    const cleaned = extractJSON(rawText);

    let parsed: SugestaoIA;
    try {
      parsed = JSON.parse(cleaned) as SugestaoIA;
    } catch (parseErr) {
      // Log completo para diagnóstico — aparece no terminal, não na tela do usuário
      console.error("[gemini] falha no JSON.parse. Resposta CRUA COMPLETA:", rawText);
      console.error("[gemini] texto após extractJSON:", cleaned);
      throw new Error(
        "A IA retornou uma resposta incompleta ou malformada. Tente novamente."
      );
    }

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
