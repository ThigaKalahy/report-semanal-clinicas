import { readSheetRange } from "@/lib/google/sheets";
import type { FonteDados, Json } from "@/lib/supabase/types";
import type { GrupoFinanceiro, DiagnosticoLinha } from "./faturamento";

export type { GrupoFinanceiro };

export interface ResultadoDespesa {
  total_despesa: number;
  qtd_lancamentos: number;
  por_categoria: Record<string, GrupoFinanceiro>;
  abas_lidas: string[];
  diagnostico?: {
    debug_cols: {
      data:       { letra: string; idx: number };
      valor_pago: { letra: string; idx: number };
      categoria:  { letra: string; idx: number };
    };
    cabecalho_api: string[];
    primeiras_linhas: DiagnosticoLinha[];
  };
}

function getMapeamento(m: Json): Record<string, string> {
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, string>;
  return {};
}

function getMapeamentoRaw(m: Json): Record<string, unknown> {
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

function resolveAbas(
  dataInicio: Date,
  dataFim: Date,
  abasMensais: Record<string, string>
): { anoMes: string; abaNome: string }[] {
  const result: { anoMes: string; abaNome: string }[] = [];
  let y = dataInicio.getFullYear(), m = dataInicio.getMonth();
  const yFim = dataFim.getFullYear(), mFim = dataFim.getMonth();
  while (y < yFim || (y === yFim && m <= mFim)) {
    const anoMes = `${y}-${String(m + 1).padStart(2, "0")}`;
    result.push({ anoMes, abaNome: abasMensais[anoMes] ?? "" });
    if (m === 11) { y++; m = 0; } else { m++; }
  }
  return result;
}

function formatAnoMes(anoMes: string): string {
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = anoMes.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MESES[idx] ?? m}/${y}`;
}

function colIndex(letter: string): number {
  let idx = 0;
  for (const ch of letter.toUpperCase()) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

function parseSheetDate(value: string): Date | null {
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseValorBR(raw: string): number {
  const s = String(raw).replace(/[R$\s]/g, "").trim();
  if (!s) return 0;
  let normalized: string;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    const lastPart = parts[parts.length - 1];
    if (parts.length === 2 && lastPart.length <= 2) {
      normalized = s;
    } else {
      normalized = s.replace(/\./g, "");
    }
  } else {
    normalized = s;
  }
  const v = parseFloat(normalized);
  return isFinite(v) && v > 0 ? v : 0;
}

function normKey(s: string): string {
  return s.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function buildGrupo(
  items: Array<{ key: string; valor: number }>,
  total: number
): Record<string, GrupoFinanceiro> {
  const map = new Map<string, { display: string; total: number }>();
  for (const { key, valor } of items) {
    if (!key) continue;
    const norm = normKey(key);
    const existing = map.get(norm);
    if (existing) {
      existing.total += valor;
    } else {
      map.set(norm, { display: key, total: valor });
    }
  }
  return Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([, { display, total: t }]) => [
        display,
        {
          total:        Math.round(t * 100) / 100,
          pct_do_total: total > 0 ? Math.round((t / total) * 1000) / 10 : 0,
        },
      ])
  );
}

export async function coletarDespesa(
  fonte: FonteDados,
  dataInicio: Date,
  dataFim: Date
): Promise<ResultadoDespesa> {
  const mapeamento     = getMapeamento(fonte.mapeamento);
  const mapeamentoRaw  = getMapeamentoRaw(fonte.mapeamento);
  const abasMensais    = getAbasMensais(mapeamentoRaw);
  const abasResolvidas = resolveAbas(dataInicio, dataFim, abasMensais);

  if (Object.keys(abasMensais).length === 0) {
    throw new Error(
      "Mapa de abas mensais não configurado. Adicione as abas no formulário de configuração da fonte de despesa."
    );
  }

  const abasFaltando = abasResolvidas.filter((a) => !a.abaNome);
  if (abasFaltando.length > 0) {
    const meses = abasFaltando.map((a) => formatAnoMes(a.anoMes)).join(", ");
    throw new Error(`Aba não mapeada para: ${meses}. Configure o mapa de abas mensais na fonte de despesa.`);
  }

  const dataIdx      = colIndex(fonte.coluna_data);
  const categoriaIdx = mapeamento.categoria  ? colIndex(mapeamento.categoria)  : -1;
  const valorIdx     = mapeamento.valor_pago ? colIndex(mapeamento.valor_pago) : -1;
  const linhaInicial = Math.max(2, parseInt(String(mapeamento.linha_inicial ?? "2"), 10));

  const iniMs = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate()).getTime();
  const fimMs = new Date(dataFim.getFullYear(),    dataFim.getMonth(),    dataFim.getDate()).getTime();

  const debugCols = {
    data:       { letra: fonte.coluna_data       ?? "?", idx: dataIdx      },
    valor_pago: { letra: mapeamento.valor_pago   ?? "?", idx: valorIdx     },
    categoria:  { letra: mapeamento.categoria    ?? "?", idx: categoriaIdx },
  };

  const categorias: Array<{ key: string; valor: number }> = [];
  let total_despesa   = 0;
  let qtd_lancamentos = 0;
  const abas_lidas: string[] = [];

  let diagCabecalhoApi: string[] = [];
  const diagPrimeiras: DiagnosticoLinha[] = [];

  for (const { abaNome } of abasResolvidas) {
    const rows = await readSheetRange(fonte.sheet_id, `${abaNome}!A:Z`);
    abas_lidas.push(abaNome);

    if (rows.length === 0) continue;

    const cabecalho = (rows[0] ?? []).map(String);
    if (diagCabecalhoApi.length === 0) diagCabecalhoApi = cabecalho;

    const dataRows = rows.slice(linhaInicial - 1);

    dataRows.forEach((row, i) => {
      const dateRaw  = String(row[dataIdx]  ?? "");
      const valorRaw = String(row[valorIdx] ?? "");
      const date     = parseSheetDate(dateRaw);
      const valor    = valorIdx >= 0 ? parseValorBR(valorRaw) : 0;

      if (i < 5) {
        const catRaw  = String(row[categoriaIdx] ?? "");
        const t       = date ? date.getTime() : 0;
        const inRange = date ? (t >= iniMs && t <= fimMs) : false;
        const motivo  = !date      ? "data não reconhecida"
                      : !inRange   ? `fora do período (${date.toLocaleDateString("pt-BR")})`
                      : valor <= 0 ? `valor inválido (raw: "${valorRaw}")`
                      : null;
        diagPrimeiras.push({
          planilha_linha:  linhaInicial + i,
          date_raw:        dateRaw,
          date_parsed:     date ? date.toLocaleDateString("pt-BR") : null,
          valor_raw:       valorRaw,
          valor_parsed:    valor,
          categoria_raw:   catRaw,
          motivo_rejeicao: motivo,
        });
      }

      if (!date) return;
      const t = date.getTime();
      if (t < iniMs || t > fimMs || valor <= 0) return;

      total_despesa += valor;
      qtd_lancamentos++;

      const cat = String(row[categoriaIdx] ?? "").trim();
      categorias.push({ key: cat, valor });
    });
  }

  return {
    total_despesa:   Math.round(total_despesa * 100) / 100,
    qtd_lancamentos,
    por_categoria:   buildGrupo(categorias, total_despesa),
    abas_lidas,
    diagnostico: {
      debug_cols:       debugCols,
      cabecalho_api:    diagCabecalhoApi,
      primeiras_linhas: diagPrimeiras,
    },
  };
}
