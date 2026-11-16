/**
 * Utilidades de leitura de linhas de planilha, compartilhadas pelos coletores
 * novos (Entradas e Orçamentos). Módulo puro — sem rede.
 */

/** "A" → 0, "AB" → 27. Devolve -1 para letra vazia ou inválida. */
export function indiceDaColuna(letra: string | undefined | null): number {
  const s = String(letra ?? "").trim().toUpperCase();
  if (!/^[A-Z]+$/.test(s)) return -1;
  let idx = 0;
  for (const ch of s) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

/** Data de planilha em DD/MM/AAAA (com ou sem hora) ou AAAA-MM-DD. */
export function lerData(valor: unknown): Date | null {
  const s = String(valor ?? "").trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return dataValida(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return dataValida(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

function dataValida(ano: number, mes: number, dia: number): Date | null {
  const d = new Date(ano, mes - 1, dia);
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia ? d : null;
}

/**
 * Valor monetário no padrão brasileiro: "R$ 1.234,56", "1.234,56", "1234,56",
 * "1234.56". Devolve null quando a célula está vazia ou não é número — para
 * quem chama poder distinguir "zero" de "ilegível". Aceita negativo.
 */
export function lerValor(bruto: unknown): number | null {
  let s = String(bruto ?? "").replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  // formato contábil das planilhas: zero aparece como "R$ -"
  if (/^[-–—]+$/.test(s)) return 0;
  let sinal = 1;
  if (/^\(.*\)$/.test(s)) { sinal = -1; s = s.slice(1, -1); }
  if (s.startsWith("-")) { sinal = -1; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s)) return null;

  let normalizado: string;
  if (s.includes(",")) {
    normalizado = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(".")) {
    const partes = s.split(".");
    // um ponto só, com até 2 casas depois → decimal ("1234.56"); senão, milhar
    normalizado = partes.length === 2 && partes[1].length <= 2 ? s : s.replace(/\./g, "");
  } else {
    normalizado = s;
  }
  const v = parseFloat(normalizado);
  return isFinite(v) ? sinal * v : null;
}

/** Sem acento, sem caixa, espaços colapsados — para comparar textos de célula. */
export function normalizarTexto(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const centavos = (v: number) => Math.round(v * 100) / 100;

/** Meia-noite local do dia, em ms — para comparar períodos sem hora. */
export function diaMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export interface ItemContagem {
  nome: string;
  quantidade: number;
  /** Participação de 0 a 1. */
  pct: number;
}

/**
 * Conta textos iguais (ignorando acento e caixa) e devolve do mais frequente
 * para o menos. Célula vazia entra como "Não informado", salvo `ignorarVazio`.
 */
export function contarPorTexto(valores: unknown[], ignorarVazio = false): ItemContagem[] {
  const mapa = new Map<string, { nome: string; quantidade: number }>();
  let total = 0;
  for (const v of valores) {
    const texto = String(v ?? "").trim();
    if (!texto && ignorarVazio) continue;
    const nome = texto || "Não informado";
    const chave = normalizarTexto(nome);
    const atual = mapa.get(chave);
    if (atual) atual.quantidade++; else mapa.set(chave, { nome, quantidade: 1 });
    total++;
  }
  return [...mapa.values()]
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((i) => ({ ...i, pct: total > 0 ? i.quantidade / total : 0 }));
}

/**
 * Lista de termos digitada na configuração da fonte ("protocolo completo; fechou")
 * → termos normalizados. Separadores: ponto e vírgula, vírgula ou quebra de linha.
 */
export function lerTermos(texto: unknown): string[] {
  return String(texto ?? "")
    .split(/[;,\n]/)
    .map(normalizarTexto)
    .filter(Boolean);
}

/** O texto (já normalizado) contém algum dos termos? */
export function contemTermo(textoNormalizado: string, termos: string[]): boolean {
  return termos.some((t) => textoNormalizado.includes(t));
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Mês escrito na planilha → "AAAA-MM". Aceita data completa (DD/MM/AAAA,
 * AAAA-MM-DD), "MM/AAAA", "AAAA-MM" e mês por extenso ou abreviado com ano
 * ("out/2026", "Outubro 2026", "Out26"). Devolve null quando não reconhece.
 */
export function lerMes(valor: unknown): string | null {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return null;
  const data = lerData(bruto);
  if (data) return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;

  const chave = (ano: number, mes: number) =>
    mes >= 1 && mes <= 12 ? `${ano < 100 ? 2000 + ano : ano}-${String(mes).padStart(2, "0")}` : null;

  let m = bruto.match(/^(\d{1,2})[\/\-.](\d{4}|\d{2})$/);
  if (m) return chave(Number(m[2]), Number(m[1]));
  m = bruto.match(/^(\d{4})[\/\-.](\d{1,2})$/);
  if (m) return chave(Number(m[1]), Number(m[2]));

  const t = normalizarTexto(bruto);
  m = t.match(/^([a-z]{3})[a-z]*\W*(?:de\W*)?(\d{4}|\d{2})$/);
  if (m) {
    const mes = MESES_ABREV.indexOf(m[1]) + 1;
    return mes ? chave(Number(m[2]), mes) : null;
  }
  return null;
}
