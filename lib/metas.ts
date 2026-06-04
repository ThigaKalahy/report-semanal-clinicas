import type { ComportamentoMeta } from "@/lib/supabase/types";

export interface PerformanceInfo {
  acima_meta_periodo: boolean;
  pct_periodo: number;
  pct_mensal: number;
  texto_curto: string;
}

/**
 * Meta proporcional ao período decorrido.
 * Para métricas do tipo "media" (notas), retorna a própria meta mensal
 * pois não há proporcionalidade por dias úteis.
 */
export function calcularMetaPeriodo(
  metaMensal: number,
  diasDecorridos: number,
  diasTotal: number,
  comportamento: ComportamentoMeta = "acumulativa"
): number {
  if (comportamento === "media") return metaMensal;
  if (diasTotal === 0) return 0;
  return (metaMensal / diasTotal) * diasDecorridos;
}

/** Percentual do realizado em relação à meta. */
export function calcularPercentualMeta(realizado: number, meta: number): number {
  if (meta === 0) return 0;
  return (realizado / meta) * 100;
}

/**
 * Descreve a performance em relação à meta proporcional e à meta mensal.
 * Para "media": compara realizado diretamente com meta mensal (sem proporcionalidade).
 * Para "acumulativa": compara realizado com a meta proporcional ao período.
 */
export function descreverPerformance(
  realizado: number,
  metaPeriodo: number,
  metaMensal: number,
  comportamento: ComportamentoMeta = "acumulativa"
): PerformanceInfo {
  if (comportamento === "media") {
    const pct = calcularPercentualMeta(realizado, metaMensal);
    const acima = realizado >= metaMensal;
    const diff = Math.abs(pct - 100).toFixed(0);
    return {
      acima_meta_periodo: acima,
      pct_periodo: pct,
      pct_mensal: pct,
      texto_curto: acima ? `${diff}% acima da meta` : `${diff}% abaixo da meta`,
    };
  }

  const pct_periodo = calcularPercentualMeta(realizado, metaPeriodo);
  const pct_mensal = calcularPercentualMeta(realizado, metaMensal);
  const acima = realizado >= metaPeriodo;
  const diff = Math.abs(pct_periodo - 100).toFixed(0);
  return {
    acima_meta_periodo: acima,
    pct_periodo,
    pct_mensal,
    texto_curto: acima ? `${diff}% acima da meta` : `${diff}% abaixo da meta`,
  };
}
