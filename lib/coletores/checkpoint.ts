import { readSheetRange } from "@/lib/google/sheets";
import type { FonteDados, Json } from "@/lib/supabase/types";

/**
 * Leitura "crua" de uma planilha para o checkpoint: não interpreta valores,
 * só responde quando foi o último lançamento e se a categoria está preenchida.
 */
export interface LeituraFonte {
  /** Data do lançamento mais recente da planilha; null = planilha sem datas. */
  ultimoLancamento: Date | null;
  /** Linhas com data válida (toda a planilha, não só o período). */
  totalLancamentos: number;
  /** Linhas com data dentro do período consultado. */
  lancamentosPeriodo: number;
  /** Linhas do período sem categoria; null = planilha não tem coluna de categoria. */
  semCategoriaPeriodo: number | null;
  abasLidas: string[];
  /** Meses do período sem aba mapeada (só faturamento/despesa). */
  mesesSemAba: string[];
}

function getMapeamento(m: Json): Record<string, unknown> {
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

function getAbasMensais(raw: Record<string, unknown>): Record<string, string> {
  const v = raw.abas_mensais;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const result: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") result[k] = val;
  }
  return result;
}

function colIndex(letter: string): number {
  let idx = 0;
  for (const ch of letter.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

/** Aceita DD/MM/AAAA e D/M/AAAA, com ou sem hora depois. */
function parseSheetDate(value: string): Date | null {
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function anoMesDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatAnoMes(anoMes: string): string {
  const [y, m] = anoMes.split("-");
  return `${MESES[parseInt(m, 10) - 1] ?? m}/${y}`;
}

/** Meses a consultar: os do período mais o mês de referência (normalmente hoje). */
function mesesDeInteresse(ini: Date, fim: Date, referencia: Date): string[] {
  const meses: string[] = [];
  let y = ini.getFullYear(), m = ini.getMonth();
  const yF = fim.getFullYear(), mF = fim.getMonth();
  while (y < yF || (y === yF && m <= mF)) {
    meses.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    if (m === 11) { y++; m = 0; } else { m++; }
  }
  const mesRef = anoMesDe(referencia);
  if (!meses.includes(mesRef)) meses.push(mesRef);
  return meses;
}

/**
 * Lê a planilha de uma fonte e extrai os sinais do checkpoint.
 *
 * Fontes de faturamento e despesa guardam um mês por aba (`abas_mensais`); as
 * demais têm aba única. Em ambos os casos, as linhas começam em `linha_inicial`
 * (padrão 2, cabeçalho na linha 1).
 */
export async function lerFonteCheckpoint(
  fonte: FonteDados,
  ini: Date,
  fim: Date,
  referencia: Date,
): Promise<LeituraFonte> {
  const mapeamento  = getMapeamento(fonte.mapeamento);
  const abasMensais = getAbasMensais(mapeamento);
  const mensal      = Object.keys(abasMensais).length > 0;

  const dataIdx      = colIndex(fonte.coluna_data);
  const categoriaCol = typeof mapeamento.categoria === "string" ? mapeamento.categoria : "";
  const categoriaIdx = categoriaCol ? colIndex(categoriaCol) : -1;
  const linhaInicial = Math.max(2, parseInt(String(mapeamento.linha_inicial ?? "2"), 10));

  const abas: string[] = [];
  const mesesSemAba: string[] = [];

  if (mensal) {
    for (const mes of mesesDeInteresse(ini, fim, referencia)) {
      const aba = abasMensais[mes];
      if (aba) abas.push(aba);
      else mesesSemAba.push(mes);
    }
  } else {
    abas.push(fonte.aba_nome);
  }

  const iniMs = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()).getTime();
  const fimMs = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();

  let ultimoLancamento: Date | null = null;
  let totalLancamentos = 0;
  let lancamentosPeriodo = 0;
  let semCategoriaPeriodo = 0;
  const abasLidas: string[] = [];

  for (const aba of abas) {
    if (!aba) continue;
    const rows = await readSheetRange(fonte.sheet_id, `${aba}!A:Z`);
    abasLidas.push(aba);

    for (const row of rows.slice(linhaInicial - 1)) {
      const data = parseSheetDate(String(row[dataIdx] ?? ""));
      if (!data) continue;

      totalLancamentos++;
      if (ultimoLancamento === null || data > ultimoLancamento) ultimoLancamento = data;

      const t = data.getTime();
      if (t < iniMs || t > fimMs) continue;

      lancamentosPeriodo++;
      if (categoriaIdx >= 0 && String(row[categoriaIdx] ?? "").trim() === "") {
        semCategoriaPeriodo++;
      }
    }
  }

  return {
    ultimoLancamento,
    totalLancamentos,
    lancamentosPeriodo,
    semCategoriaPeriodo: categoriaIdx >= 0 ? semCategoriaPeriodo : null,
    abasLidas,
    mesesSemAba,
  };
}
