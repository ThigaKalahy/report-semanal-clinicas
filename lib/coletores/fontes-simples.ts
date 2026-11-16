import { readSheetRange } from "@/lib/google/sheets";
import type { FonteDados, Json } from "@/lib/supabase/types";
import { calcularEntradas } from "./entradas-calculo";
import type { ResultadoEntradas } from "./entradas-calculo";
import { calcularOrcamentos } from "./orcamentos-calculo";
import type { ResultadoOrcamentos } from "./orcamentos-calculo";

/**
 * Leitura das fontes de aba única (Entradas e Orçamentos): busca a aba inteira
 * e entrega as linhas de dados para o cálculo puro.
 */

function mapa(m: Json): Record<string, string> {
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) if (typeof v === "string") r[k] = v;
  return r;
}

async function lerLinhas(fonte: FonteDados): Promise<{ linhas: unknown[][]; m: Record<string, string> }> {
  const m = mapa(fonte.mapeamento);
  // Aspas no nome da aba: sem elas, abas como "2026" não são reconhecidas
  const aba = `'${fonte.aba_nome.replace(/'/g, "''")}'`;
  const rows = (await readSheetRange(fonte.sheet_id, `${aba}!A:AZ`)) ?? [];
  // linha_inicial: linha (1 = primeira) onde começam os dados; padrão 2 (cabeçalho na 1)
  const linhaInicial = Math.max(2, parseInt(m.linha_inicial ?? "2", 10) || 2);
  return { linhas: rows.slice(linhaInicial - 1), m };
}

export async function coletarEntradas(
  fonte: FonteDados, dataInicio: Date, dataFim: Date,
): Promise<ResultadoEntradas> {
  const { linhas, m } = await lerLinhas(fonte);
  if (!m.valor) throw new Error("A fonte de Entradas não tem a coluna de valor configurada.");
  return calcularEntradas(
    linhas,
    { data: fonte.coluna_data, valor: m.valor, situacao: m.situacao, categoria: m.categoria },
    dataInicio, dataFim,
    { fora: m.termos_fora, nao_operacional: m.termos_nao_operacional },
  );
}

export async function coletarOrcamentos(
  fonte: FonteDados, dataInicio: Date, dataFim: Date,
): Promise<ResultadoOrcamentos> {
  const { linhas, m } = await lerLinhas(fonte);
  if (!m.status) throw new Error("A fonte de Orçamentos não tem a coluna de status configurada.");
  return calcularOrcamentos(
    linhas,
    {
      data: fonte.coluna_data, status: m.status,
      valor_prescricao: m.valor_prescricao, valor_venda: m.valor_venda, objecao: m.objecao,
    },
    dataInicio, dataFim,
    {
      fechado: m.termos_fechado, aberto: m.termos_aberto,
      nao_fechou: m.termos_nao_fechou, cancelado: m.termos_cancelado,
    },
  );
}
