import { eachDayOfInterval, startOfMonth, endOfMonth, isWeekend, format } from "date-fns";

/**
 * Total de dias úteis em um mês, excluindo fins de semana e feriados.
 * @param mes  1–12
 * @param ano  ex: 2026
 * @param feriados  array de strings "YYYY-MM-DD"
 */
export function diasUteisDoMes(mes: number, ano: number, feriados: string[]): number {
  const feriadosSet = new Set(feriados);
  const base = new Date(ano, mes - 1, 1);
  const days = eachDayOfInterval({ start: startOfMonth(base), end: endOfMonth(base) });
  return days.filter((d) => !isWeekend(d) && !feriadosSet.has(format(d, "yyyy-MM-dd"))).length;
}

/**
 * Dias úteis decorridos do início do mês de dataRef até dataRef (inclusive).
 * @param dataRef  data de referência
 * @param feriados  array de strings "YYYY-MM-DD"
 */
export function diasUteisDecorridos(dataRef: Date, feriados: string[]): number {
  const feriadosSet = new Set(feriados);
  const days = eachDayOfInterval({ start: startOfMonth(dataRef), end: dataRef });
  return days.filter((d) => !isWeekend(d) && !feriadosSet.has(format(d, "yyyy-MM-dd"))).length;
}
