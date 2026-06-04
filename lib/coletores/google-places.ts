import { fromZonedTime } from "date-fns-tz";

export interface AvaliacaoGoogle {
  autor: string;
  nota: number;
  texto: string;
  data: string;
}

export interface ResultadoGoogle {
  total: number;
  avaliacoes: AvaliacaoGoogle[];
}

interface PlacesReview {
  authorAttribution?: { displayName?: string };
  rating?: number;
  text?: { text?: string };
  publishTime?: string;
}

// Limitação conhecida: a Places API (New) retorna no máximo ~5 avaliações
// curadas pelo Google — não necessariamente as mais recentes do período
// solicitado. Se a clínica recebeu avaliações na semana mas elas não estão
// entre as 5 curadas, o resultado será 0. Use o fallback manual na UI de
// relatório para complementar.

const TZ = "America/Sao_Paulo";

export async function coletarAvaliacoesGoogle(
  placeId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<ResultadoGoogle> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY não configurado");

  const fieldMask =
    "reviews.rating,reviews.text,reviews.authorAttribution,reviews.publishTime";
  const url = `https://places.googleapis.com/v1/places/${placeId}`;

  console.log(
    `[google-places] place_id="${placeId}" fieldMask="${fieldMask}"`
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(
        "Places API: timeout de 30s — verifique o Place ID e a chave de API"
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API: ${res.status} — ${text.slice(0, 200)}`);
  }

  const data: { reviews?: PlacesReview[] } = await res.json();
  const reviews = data.reviews ?? [];

  console.log(`[google-places] reviews recebidas da API: ${reviews.length}`);

  // Converter datas do calendário para milissegundos UTC no fuso de SP,
  // independente do TZ do servidor Node (em produção costuma ser UTC).
  const iniCal = new Date(
    dataInicio.getFullYear(),
    dataInicio.getMonth(),
    dataInicio.getDate()
  );
  const fimCal = new Date(
    dataFim.getFullYear(),
    dataFim.getMonth(),
    dataFim.getDate() + 1 // início do dia seguinte = fim inclusivo
  );
  const iniMs = fromZonedTime(iniCal, TZ).getTime();
  const fimMs = fromZonedTime(fimCal, TZ).getTime();

  console.log(
    `[google-places] janela SP: ${new Date(iniMs).toISOString()} → ${new Date(fimMs).toISOString()}`
  );

  const filtered = reviews.filter((r) => {
    if (!r.publishTime) {
      console.log(`[google-places]   review sem publishTime — descartada`);
      return false;
    }
    const t = new Date(r.publishTime).getTime();
    const passou = t >= iniMs && t < fimMs;
    console.log(
      `[google-places]   publishTime="${r.publishTime}" passou=${passou}`
    );
    return passou;
  });

  console.log(
    `[google-places] reviews após filtro de data: ${filtered.length}`
  );

  return {
    total: filtered.length,
    avaliacoes: filtered.map((r) => ({
      autor: r.authorAttribution?.displayName ?? "Anônimo",
      nota: r.rating ?? 0,
      texto: r.text?.text ?? "",
      data: r.publishTime
        ? new Date(r.publishTime).toISOString().slice(0, 10)
        : "",
    })),
  };
}
