import type { NomeIndicador, TipoFonte, CheckpointIndicador } from "@/lib/supabase/types";

/** Lista fixa de indicadores do checkpoint, na ordem de exibição. */
export const INDICADORES: readonly NomeIndicador[] = [
  "leads",
  "fechamentos",
  "nps",
  "faturamento",
  "despesas",
] as const;

export const INDICADOR_LABEL: Record<NomeIndicador, string> = {
  leads:       "Leads",
  fechamentos: "Fechamentos",
  nps:         "NPS",
  faturamento: "Faturamento",
  despesas:    "Despesas",
};

/**
 * Fonte de dados que alimenta a checagem automática de cada indicador.
 * `null` = não existe planilha para isso hoje — o indicador é sempre manual.
 *
 * "Fechamentos" é manual: não há tipo de fonte próprio para ele. A conversão
 * registrada na planilha de leads já é coberta pelo indicador "Leads", então
 * checar a mesma planilha duas vezes não diria nada novo.
 */
export const INDICADOR_FONTE: Record<NomeIndicador, TipoFonte | null> = {
  leads:       "leads",
  fechamentos: null,
  nps:         "nps",
  faturamento: "faturamento",
  despesas:    "despesa",
};

/**
 * Quantos dias úteis o último lançamento pode ter antes de acender o alerta.
 *
 * A régua é a cadência do dado, não um número único: faturamento e despesa são
 * lançados todo dia, então 2 dias úteis sem nada já é sinal de planilha parada.
 * NPS e leads chegam ao longo da semana — cobrar os mesmos 2 dias acusaria
 * atraso toda segunda-feira. Para eles o corte é a semana (5 dias úteis).
 */
export const INDICADOR_LIMITE_DIAS_UTEIS: Record<NomeIndicador, number> = {
  leads:       5,
  fechamentos: 5,
  nps:         5,
  faturamento: 2,
  despesas:    2,
};

/** Como a cadência aparece na tela. */
export const INDICADOR_CADENCIA: Record<NomeIndicador, "diaria" | "semanal"> = {
  leads:       "semanal",
  fechamentos: "semanal",
  nps:         "semanal",
  faturamento: "diaria",
  despesas:    "diaria",
};

export const CADENCIA_LABEL: Record<"diaria" | "semanal", string> = {
  diaria:  "lançamento diário",
  semanal: "pelo menos um na semana",
};

/** Indicadores cuja planilha tem coluna de categoria a conferir. */
export const INDICADOR_TEM_CATEGORIA: Record<NomeIndicador, boolean> = {
  leads:       false,
  fechamentos: false,
  nps:         false,
  faturamento: true,
  despesas:    true,
};

/**
 * Sugestão inicial para uma clínica ainda não configurada: liga os indicadores
 * cuja fonte já existe. Os demais o usuário ativa à mão.
 */
export function indicadoresPadrao(tiposFonte: TipoFonte[]): NomeIndicador[] {
  const tipos = new Set(tiposFonte);
  return INDICADORES.filter((ind) => {
    const fonte = INDICADOR_FONTE[ind];
    return fonte !== null && tipos.has(fonte);
  });
}

/**
 * Indicadores ativos da clínica. Sem nenhuma linha salva, vale a sugestão
 * padrão; a partir da primeira gravação, vale exatamente o que está no banco.
 */
export function resolverAtivos(
  linhas: Pick<CheckpointIndicador, "indicador" | "ativo">[],
  tiposFonte: TipoFonte[],
): NomeIndicador[] {
  if (linhas.length === 0) return indicadoresPadrao(tiposFonte);
  const ativos = new Set(linhas.filter((l) => l.ativo).map((l) => l.indicador));
  return INDICADORES.filter((ind) => ativos.has(ind));
}
