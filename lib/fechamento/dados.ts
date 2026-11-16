import type { ResultadoVendas, ResultadoDespesas, ResultadoLeadsDetalhe } from "./calculos";
import type { ResultadoEntradas } from "@/lib/coletores/entradas-calculo";
import type { ResultadoOrcamentos } from "@/lib/coletores/orcamentos-calculo";
import type { TipoFechamento } from "./periodo";

/**
 * O retrato de um fechamento: tudo que foi lido e calculado para o período,
 * guardado em `fechamentos.dados`. Os relatórios (tela e texto) são montados
 * só a partir disto — reabrir um fechamento antigo não relê planilha nenhuma.
 *
 * Módulo puro: tipos e as contas que combinam as fontes entre si.
 */

export const VERSAO_DADOS = 1;

export type GravidadeAlerta = "erro" | "atencao" | "info";

export interface Alerta {
  gravidade: GravidadeAlerta;
  /** De onde veio: "Vendas", "Despesas", "Meta"… */
  area: string;
  titulo: string;
  descricao: string;
}

export interface LeituraFonte {
  fonte: string;
  /** "ok" leu; "ausente" a clínica não tem a fonte; "erro" tem, mas a leitura falhou. */
  estado: "ok" | "ausente" | "erro";
  mensagem: string;
}

export interface ResumoNps {
  respostas: number;
  /** -100 a 100. */
  score: number;
  promotores: number;
  neutros: number;
  detratores: number;
  notas: {
    profissional: number | null;
    recepcao: number | null;
    infraestrutura: number | null;
    enfermagem: number | null;
  };
}

export interface ResumoGoogle {
  total: number;
  media: number | null;
}

export interface Ritmo {
  /** Faturamento do dia 1 até o fim do período. */
  faturamentoMes: number;
  diasUteisDecorridos: number;
  diasUteisMes: number;
  mediaPorDiaUtil: number | null;
  /** Média por dia útil × dias úteis do mês. */
  projecao: number | null;
  meta: number | null;
  /** Quanto falta para a meta (0 quando já bateu). */
  faltaParaMeta: number | null;
  /** Quanto precisa faturar por dia útil restante para bater a meta. */
  necessarioPorDiaUtil: number | null;
}

export interface CaixaMes {
  /** Despesas com vencimento do dia 1 até o fim do período. */
  despesasAteAData: number;
  /** Despesas com vencimento depois do período, ainda dentro do mês. */
  provisionado: number;
  despesasDoMes: number;
  /** Projeção do faturamento − despesas do mês inteiro. */
  saldoProjetado: number | null;
  /** Média das despesas dos meses anteriores lidos (até 3); ausente em leituras antigas. */
  mediaDespesas?: number | null;
  mesesDaMedia?: number;
}

/** Um mês da série do ano (base do gráfico e da visão de caixa e competência). */
export interface MesAnual {
  /** "AAAA-MM" */
  mes: string;
  faturamento: number | null;
  /** Entradas (recebido); null sem a fonte de Entradas. */
  recebido: number | null;
  /** Despesas pela data da fonte (vencimento). */
  despesas: number | null;
  /** Despesas pelo mês de competência; null sem a coluna. */
  despesasCompetencia: number | null;
}

export interface Comparativo {
  rotulo: string;
  faturamento: number | null;
  despesas: number | null;
  /** categoria (normalizada) → valor no período anterior. */
  receitasPorCategoria: Record<string, number>;
  despesasPorCategoria: Record<string, number>;
}

export interface DadosFechamento {
  versao: number;
  tipo: TipoFechamento;
  periodo: { inicio: string; fim: string; rotulo: string };
  lidoEm: string;
  faturamento: ResultadoVendas | null;
  despesas: ResultadoDespesas | null;
  entradas: ResultadoEntradas | null;
  orcamentos: ResultadoOrcamentos | null;
  leads: ResultadoLeadsDetalhe | null;
  nps: ResumoNps | null;
  google: ResumoGoogle | null;
  /** Meta de faturamento do mês; null sem meta cadastrada. */
  meta: number | null;
  anterior: Comparativo | null;
  /** Só no quinzenal. */
  ritmo: Ritmo | null;
  caixaMes: CaixaMes | null;
  leituras: LeituraFonte[];
  alertas: Alerta[];
  /** Série do ano até o mês do fechamento (só no mensal; ausente em leituras antigas). */
  anual?: MesAnual[];
  /** Presente só em fechamentos trazidos de outro sistema. */
  origem?: OrigemFechamento;
}

export interface OrigemFechamento {
  sistema: "sync";
  /** Id do fechamento no sistema de origem. */
  id: string;
  importadoEm: string;
  /** Série mensal do ano como veio da origem (base do gráfico anual). */
  anual?: unknown[];
}

// ── Contas que combinam fontes ───────────────────────────────────────────────

export interface Resultado {
  /** Com Entradas: "Resultado de caixa". Sem ela: "Faturamento x Despesas". */
  rotulo: "Resultado de caixa" | "Faturamento x Despesas";
  base: number;
  despesas: number;
  valor: number;
}

export function calcularResultado(
  d: Pick<DadosFechamento, "faturamento" | "despesas" | "entradas">,
): Resultado | null {
  if (!d.despesas) return null;
  if (d.entradas) {
    return {
      rotulo: "Resultado de caixa", base: d.entradas.total, despesas: d.despesas.total,
      valor: Math.round((d.entradas.total - d.despesas.total) * 100) / 100,
    };
  }
  if (!d.faturamento) return null;
  return {
    rotulo: "Faturamento x Despesas", base: d.faturamento.total, despesas: d.despesas.total,
    valor: Math.round((d.faturamento.total - d.despesas.total) * 100) / 100,
  };
}

/** Faturamento ÷ meta, de 0 em diante; null sem meta ou sem faturamento lido. */
export function atingimentoDaMeta(d: Pick<DadosFechamento, "faturamento" | "meta">): number | null {
  if (!d.faturamento || !d.meta || d.meta <= 0) return null;
  return d.faturamento.total / d.meta;
}

/** Variação relativa (0,12 = +12%); null quando não há base de comparação. */
export function variacao(atual: number, anterior: number | null | undefined): number | null {
  if (anterior === null || anterior === undefined || anterior === 0) return null;
  return (atual - anterior) / Math.abs(anterior);
}

export function calcularRitmo(e: {
  faturamentoMes: number;
  diasUteisDecorridos: number;
  diasUteisMes: number;
  meta: number | null;
}): Ritmo {
  const c = (v: number) => Math.round(v * 100) / 100;
  const media = e.diasUteisDecorridos > 0 ? e.faturamentoMes / e.diasUteisDecorridos : null;
  const projecao = media !== null ? media * e.diasUteisMes : null;
  const falta = e.meta && e.meta > 0 ? Math.max(0, e.meta - e.faturamentoMes) : null;
  const restantes = Math.max(0, e.diasUteisMes - e.diasUteisDecorridos);
  return {
    faturamentoMes: c(e.faturamentoMes),
    diasUteisDecorridos: e.diasUteisDecorridos,
    diasUteisMes: e.diasUteisMes,
    mediaPorDiaUtil: media !== null ? c(media) : null,
    projecao: projecao !== null ? c(projecao) : null,
    meta: e.meta && e.meta > 0 ? e.meta : null,
    faltaParaMeta: falta !== null ? c(falta) : null,
    necessarioPorDiaUtil: falta !== null && falta > 0 && restantes > 0 ? c(falta / restantes) : null,
  };
}

export function calcularCaixaMes(e: {
  despesasAteAData: number;
  despesasDoMes: number;
  projecaoFaturamento: number | null;
  /** Totais de despesa dos meses anteriores que deu para ler (até 3). */
  despesasMesesAnteriores?: number[];
}): CaixaMes {
  const c = (v: number) => Math.round(v * 100) / 100;
  const anteriores = e.despesasMesesAnteriores ?? [];
  return {
    mediaDespesas: anteriores.length > 0 ? c(anteriores.reduce((s, v) => s + v, 0) / anteriores.length) : null,
    mesesDaMedia: anteriores.length,
    despesasAteAData: c(e.despesasAteAData),
    provisionado: c(Math.max(0, e.despesasDoMes - e.despesasAteAData)),
    despesasDoMes: c(e.despesasDoMes),
    saldoProjetado: e.projecaoFaturamento !== null ? c(e.projecaoFaturamento - e.despesasDoMes) : null,
  };
}

/** Alertas tirados dos próprios números — o que conferir antes de analisar. */
export function gerarAlertas(d: Omit<DadosFechamento, "alertas">): Alerta[] {
  const alertas: Alerta[] = [];
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

  for (const l of d.leituras) {
    if (l.estado === "erro") {
      alertas.push({ gravidade: "erro", area: l.fonte, titulo: `Não foi possível ler ${l.fonte}`, descricao: l.mensagem });
    }
  }

  const ilegiveis: [string, number | undefined][] = [
    ["Vendas", d.faturamento?.linhasIlegiveis], ["Despesas", d.despesas?.linhasIlegiveis],
    ["Entradas", d.entradas?.linhasIlegiveis], ["Orçamentos", d.orcamentos?.linhasIlegiveis],
    ["Leads", d.leads?.linhasIlegiveis],
  ];
  for (const [area, n] of ilegiveis) {
    if (n && n > 0) {
      alertas.push({
        gravidade: "atencao", area,
        titulo: `${n} ${plural(n, "linha", "linhas")} de ${area} com data ou valor ilegível`,
        descricao: "Essas linhas ficaram fora do cálculo. Corrija na planilha e leia de novo.",
      });
    }
  }

  if (d.faturamento && d.faturamento.lancamentos === 0) {
    alertas.push({
      gravidade: "atencao", area: "Vendas", titulo: "Nenhuma venda no período",
      descricao: "A planilha foi lida, mas não há lançamentos com data dentro do período. Confira a aba do mês e a coluna de data.",
    });
  }
  if (d.despesas && d.despesas.lancamentos === 0) {
    alertas.push({
      gravidade: "atencao", area: "Despesas", titulo: "Nenhuma despesa com vencimento no período",
      descricao: "Confira a aba do mês e se a coluna de data é a de vencimento.",
    });
  }
  if (d.despesas && d.despesas.categoriasForaDoPlano.length > 0) {
    const n = d.despesas.categoriasForaDoPlano.length;
    alertas.push({
      gravidade: "atencao", area: "Despesas",
      titulo: `${n} ${plural(n, "categoria", "categorias")} de despesa fora do plano de contas`,
      descricao: `Entraram em “Outras despesas”: ${d.despesas.categoriasForaDoPlano.slice(0, 8).join(", ")}${n > 8 ? "…" : ""}.`,
    });
  }
  if (d.despesas?.emAberto && d.despesas.emAberto > 0) {
    alertas.push({
      gravidade: "info", area: "Despesas", titulo: "Há despesas do período ainda em aberto",
      descricao: "Elas entram no total porque a despesa conta pela data de vencimento, paga ou não.",
    });
  }
  if (d.orcamentos && d.orcamentos.statusSemSituacao.length > 0) {
    alertas.push({
      gravidade: "atencao", area: "Orçamentos", titulo: "Status de orçamento sem classificação",
      descricao: `Não contam como fechado nem como perdido: ${d.orcamentos.statusSemSituacao.map((s) => `${s.nome} (${s.quantidade})`).slice(0, 6).join(", ")}. Informe essas palavras na fonte de Orçamentos.`,
    });
  }
  if (d.entradas && d.entradas.semSituacao > 0) {
    alertas.push({
      gravidade: "info", area: "Entradas",
      titulo: `${d.entradas.semSituacao} ${plural(d.entradas.semSituacao, "entrada", "entradas")} sem situação preenchida`,
      descricao: "Foram contadas como recebidas.",
    });
  }
  if (d.faturamento && d.meta === null) {
    alertas.push({
      gravidade: "info", area: "Meta", titulo: "Sem meta de faturamento no mês",
      descricao: "O atingimento da meta e o ritmo ficam sem referência. Cadastre a meta em Clínicas → Metas.",
    });
  }
  if (d.faturamento && d.anterior && d.anterior.faturamento === null) {
    alertas.push({
      gravidade: "info", area: "Vendas", titulo: "Sem período anterior para comparar",
      descricao: `Não foi possível ler ${d.anterior.rotulo}; as variações ficam em branco.`,
    });
  }

  const ordem: Record<GravidadeAlerta, number> = { erro: 0, atencao: 1, info: 2 };
  return alertas.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
}

/**
 * Série do ano de um fechamento, venha ela da leitura daqui ou do sistema de
 * origem (no Sync: entradas = faturamento, saidasCaixa = despesas).
 */
export function serieAnual(d: Pick<DadosFechamento, "anual" | "origem">): MesAnual[] {
  if (d.anual?.length) return d.anual;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
  return (d.origem?.anual ?? [])
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && typeof (m as { mes?: unknown }).mes === "string")
    .map((m) => ({
      mes: String(m.mes),
      faturamento: num(m.entradas),
      recebido: num(m.recebido),
      despesas: num(m.saidasCaixa),
      despesasCompetencia: num(m.saidasCompetencia),
    }));
}
