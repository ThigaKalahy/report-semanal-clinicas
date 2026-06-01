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

export async function coletarAvaliacoesGoogle(
  placeId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<ResultadoGoogle> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY não configurado");

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "reviews",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API: ${res.status} — ${text.slice(0, 200)}`);
  }

  const data: { reviews?: PlacesReview[] } = await res.json();
  const reviews = data.reviews ?? [];

  const iniMs = dataInicio.getTime();
  // inclusive end-of-day
  const fimMs = dataFim.getTime() + 86_400_000;

  const filtered = reviews.filter((r) => {
    if (!r.publishTime) return false;
    const t = new Date(r.publishTime).getTime();
    return t >= iniMs && t < fimMs;
  });

  return {
    total: filtered.length,
    avaliacoes: filtered.map((r) => ({
      autor: r.authorAttribution?.displayName ?? "Anônimo",
      nota: r.rating ?? 0,
      texto: r.text?.text ?? "",
      data: r.publishTime ? new Date(r.publishTime).toISOString().slice(0, 10) : "",
    })),
  };
}
