export interface PerformanceInfo {
  acima_meta_periodo: boolean;
  pct_periodo: number;
  pct_mensal: number;
  texto_curto: string;
}

/** Meta proporcional ao período decorrido. */
export function calcularMetaPeriodo(
  metaMensal: number,
  diasDecorridos: number,
  diasTotal: number
): number {
  if (diasTotal === 0) return 0;
  return (metaMensal / diasTotal) * diasDecorridos;
}

/** Percentual do realizado em relação à meta. */
export function calcularPercentualMeta(realizado: number, meta: number): number {
  if (meta === 0) return 0;
  return (realizado / meta) * 100;
}

/** Descreve a performance em relação à meta proporcional e à meta mensal. */
export function descreverPerformance(
  realizado: number,
  metaPeriodo: number,
  metaMensal: number
): PerformanceInfo {
  const pct_periodo = calcularPercentualMeta(realizado, metaPeriodo);
  const pct_mensal = calcularPercentualMeta(realizado, metaMensal);
  const acima_meta_periodo = realizado >= metaPeriodo;
  const diff = Math.abs(pct_periodo - 100).toFixed(0);
  const texto_curto = acima_meta_periodo
    ? `${diff}% acima da meta`
    : `${diff}% abaixo da meta`;
  return { acima_meta_periodo, pct_periodo, pct_mensal, texto_curto };
}
