/**
 * Períodos de fechamento. Módulo puro.
 *
 * Mensal    = o mês inteiro.
 * Quinzenal = 1ª quinzena (dia 1 a 15) ou 2ª quinzena (dia 16 ao fim do mês).
 */

export type TipoFechamento = "mensal" | "quinzenal";
export type Quinzena = 1 | 2;

export interface PeriodoFechamento {
  tipo: TipoFechamento;
  ano: number;
  /** 1 a 12. */
  mes: number;
  quinzena: Quinzena | null;
  inicio: Date;
  fim: Date;
}

export const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

export function periodoDe(
  tipo: TipoFechamento, ano: number, mes: number, quinzena?: Quinzena | null,
): PeriodoFechamento {
  if (tipo === "mensal") {
    return {
      tipo, ano, mes, quinzena: null,
      inicio: new Date(ano, mes - 1, 1),
      fim: new Date(ano, mes - 1, ultimoDiaDoMes(ano, mes)),
    };
  }
  const q: Quinzena = quinzena === 2 ? 2 : 1;
  return {
    tipo, ano, mes, quinzena: q,
    inicio: new Date(ano, mes - 1, q === 1 ? 1 : 16),
    fim: new Date(ano, mes - 1, q === 1 ? 15 : ultimoDiaDoMes(ano, mes)),
  };
}

/** Mesmo recorte, um mês antes — a base das variações. */
export function periodoAnterior(p: PeriodoFechamento): PeriodoFechamento {
  const ano = p.mes === 1 ? p.ano - 1 : p.ano;
  const mes = p.mes === 1 ? 12 : p.mes - 1;
  return periodoDe(p.tipo, ano, mes, p.quinzena);
}

/** "Mensal · outubro/2026" ou "Quinzenal · 1ª quinzena de outubro/2026". */
export function rotuloPeriodo(p: Pick<PeriodoFechamento, "tipo" | "ano" | "mes" | "quinzena">): string {
  const mes = `${MESES[p.mes - 1]}/${p.ano}`;
  return p.tipo === "mensal" ? `Mensal · ${mes}` : `Quinzenal · ${p.quinzena}ª quinzena de ${mes}`;
}

/** Rótulo curto, sem o tipo: "outubro/2026" ou "1ª quinzena de outubro/2026". */
export function rotuloCurto(p: Pick<PeriodoFechamento, "tipo" | "ano" | "mes" | "quinzena">): string {
  const mes = `${MESES[p.mes - 1]}/${p.ano}`;
  return p.tipo === "mensal" ? mes : `${p.quinzena}ª quinzena de ${mes}`;
}

export function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" → "DD/MM/AAAA". */
export function isoParaBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "AAAA-MM" do mês do período — chave das abas mensais das fontes. */
export function chaveAnoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** O período já terminou em relação a `hoje`? */
export function periodoEncerrado(p: PeriodoFechamento, hoje: Date): boolean {
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return h.getTime() > p.fim.getTime();
}

/**
 * Período sugerido para um fechamento novo: o último já encerrado.
 * Mensal → mês passado. Quinzenal → a quinzena anterior à de hoje.
 */
export function periodoSugerido(tipo: TipoFechamento, hoje: Date): PeriodoFechamento {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  if (tipo === "mensal") return periodoAnterior(periodoDe("mensal", ano, mes));
  if (hoje.getDate() > 15) return periodoDe("quinzenal", ano, mes, 1);
  const anterior = periodoAnterior(periodoDe("quinzenal", ano, mes, 2));
  return anterior;
}
