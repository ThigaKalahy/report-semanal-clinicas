import type { ComentarioItem } from "./imagem-tipos";

/**
 * Filtros opcionais da página de feedbacks. Todos aceitam `null`/vazio, que
 * significa "não filtrar por isso".
 */
export interface FiltroComentarios {
  /** Teto de comentários — aplicado por último, na ordem de coleta. */
  maxComentarios: number | null;
  minPalavras: number | null;
  maxPalavras: number | null;
  /** Comentário entra se contiver QUALQUER um destes termos. */
  palavras: string[];
}

export const FILTRO_VAZIO: FiltroComentarios = {
  maxComentarios: null,
  minPalavras: null,
  maxPalavras: null,
  palavras: [],
};

/** Normaliza para comparar sem acento nem caixa ("médico" acha "medico"). */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function contarPalavras(texto: string): number {
  const limpo = (texto ?? "").trim();
  if (!limpo) return 0;
  return limpo.split(/\s+/).length;
}

/** Quebra o campo de texto do formulário em termos ("médico, demora" → 2 termos). */
export function parsePalavras(entrada: string): string[] {
  return (entrada ?? "")
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Converte um número digitado em filtro; vazio ou inválido vira null. */
export function parseLimite(entrada: string): number | null {
  const n = parseInt((entrada ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Devolve os ÍNDICES dos comentários que passam no filtro, preservando a ordem
 * de coleta (NPS e depois Google). Índices — e não os itens — porque a tela
 * marca e desmarca cada comentário pela posição na lista original.
 */
export function filtrarComentarios(
  itens: ComentarioItem[],
  filtro: FiltroComentarios,
): number[] {
  const termos = (filtro.palavras ?? []).map(normalizar).filter(Boolean);

  const indices: number[] = [];
  itens.forEach((item, i) => {
    const texto = (item?.texto ?? "").trim();
    if (!texto) return;

    const palavras = contarPalavras(texto);
    if (filtro.minPalavras !== null && palavras < filtro.minPalavras) return;
    if (filtro.maxPalavras !== null && palavras > filtro.maxPalavras) return;

    if (termos.length > 0) {
      const alvo = normalizar(texto);
      if (!termos.some((t) => alvo.includes(t))) return;
    }

    indices.push(i);
  });

  return filtro.maxComentarios !== null
    ? indices.slice(0, filtro.maxComentarios)
    : indices;
}

/** Algum filtro está ativo? Usado só para a mensagem da tela. */
export function filtroAtivo(filtro: FiltroComentarios): boolean {
  return (
    filtro.maxComentarios !== null ||
    filtro.minPalavras !== null ||
    filtro.maxPalavras !== null ||
    filtro.palavras.length > 0
  );
}
