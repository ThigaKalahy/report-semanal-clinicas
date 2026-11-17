import { indicadoresLigados } from "@/lib/estrutura/estrutura";
import type { ItemEstrutura } from "@/lib/estrutura/estrutura";
import { normalizarTexto } from "@/lib/coletores/planilha";
import { NEUTRO, cap } from "@/lib/perfil/vocabulario";
import type { Vocabulario } from "@/lib/perfil/vocabulario";
import { calcularResultado, atingimentoDaMeta, variacao, serieAnual } from "./dados";
import type { DadosFechamento, MesAnual } from "./dados";
import { MESES, periodoAnterior, periodoDe } from "./periodo";
import { grupoDaDespesa, ordemDoGrupo } from "./grupos-despesa";
import type { PeriodoFechamento } from "./periodo";

/**
 * O que a tela de indicadores e o PDF mostram, tirado do retrato do fechamento.
 * As duas telas leem daqui: os números nunca divergem. Módulo puro.
 */

// ── Formatação (padrão brasileiro) ───────────────────────────────────────────

const MENOS = "−";

/** "R$ 28.419" — valores grandes, sem centavos. */
export function brl0(v: number): string {
  const s = Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return `${v < 0 ? "-" : ""}R$ ${s}`;
}
/** "R$ 1.006,05". */
export function brl2(v: number): string {
  const s = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? "-" : ""}R$ ${s}`;
}
export function pct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}
export const inteiro = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export const nota = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: casas });

/** "+34,5%" / "−24,4%"; "novo" quando antes era zero e agora não. */
export function textoVar(v: Variacao): string {
  if (v.novo) return "novo";
  if (v.valor === null) return "—";
  if (Math.abs(v.valor) < 0.0005) return "0%";
  return `${v.valor > 0 ? "+" : MENOS}${pct(Math.abs(v.valor))}`;
}

export interface Variacao {
  valor: number | null;
  /** Não havia nada no período anterior. */
  novo?: boolean;
  /** "bom" | "ruim" pelo sentido do indicador; neutro sem variação. */
  tom: "bom" | "ruim" | "neutro";
}

/** Variação com sentido: maiorEhMelhor=false para despesas. */
export function comparar(atual: number | null | undefined, antes: number | null | undefined, maiorEhMelhor = true): Variacao {
  if (atual === null || atual === undefined || antes === null || antes === undefined) return { valor: null, tom: "neutro" };
  if (antes === 0) return atual > 0 ? { valor: null, novo: true, tom: maiorEhMelhor ? "bom" : "ruim" } : { valor: null, tom: "neutro" };
  const valor = variacao(atual, antes);
  if (valor === null || Math.abs(valor) < 0.0005) return { valor, tom: "neutro" };
  return { valor, tom: valor > 0 === maiorEhMelhor ? "bom" : "ruim" };
}

export const mesAbrev = (m: number) => MESES[m - 1].slice(0, 3);
export function mesDaChave(chave: string): string {
  return MESES[Number(chave.slice(5, 7)) - 1] ?? chave;
}

// ── Período e comparação ─────────────────────────────────────────────────────

export function periodoDoFechamento(d: Pick<DadosFechamento, "tipo" | "periodo">): PeriodoFechamento {
  const [ano, mes, dia] = d.periodo.inicio.split("-").map(Number);
  return periodoDe(d.tipo, ano, mes, d.tipo === "quinzenal" ? (dia > 15 ? 2 : 1) : null);
}

export interface Comparacao {
  /** "setembro" ou "1–15 de out" — para "vs …". */
  curto: string;
  /** Cabeçalho de coluna: "set" ou "1–15 out". */
  coluna: string;
  /** Cabeçalho da coluna do período atual. */
  colunaAtual: string;
  /** "mesmo período do mês anterior" / "setembro" — para a tela. */
  longo: string;
  /** "(dia 1 ao 15) de outubro" — notas de rodapé. */
  extenso: string;
}

export function comparacaoDo(d: Pick<DadosFechamento, "tipo" | "periodo">): Comparacao {
  const p = periodoDoFechamento(d);
  const a = periodoAnterior(p);
  if (p.tipo === "mensal") {
    return {
      curto: MESES[a.mes - 1], coluna: mesAbrev(a.mes), colunaAtual: MESES[p.mes - 1],
      longo: MESES[a.mes - 1], extenso: MESES[a.mes - 1],
    };
  }
  const dias = (x: PeriodoFechamento) => `${x.inicio.getDate()}–${x.fim.getDate()}`;
  return {
    curto: `${dias(a)} de ${mesAbrev(a.mes)}`,
    coluna: `${dias(a)} ${mesAbrev(a.mes)}`,
    colunaAtual: `${dias(p)} ${mesAbrev(p.mes)}`,
    longo: "mesmo período do mês anterior",
    extenso: `(dia ${a.inicio.getDate()} ao ${a.fim.getDate()}) de ${MESES[a.mes - 1]}`,
  };
}

// ── Estrutura da clínica ─────────────────────────────────────────────────────

export interface Ligados {
  secao: (id: string) => boolean;
  item: (id: string) => ItemEstrutura | undefined;
  /** Indicadores ligados da seção de resultado. */
  res: Set<string>;
}

export function ligadosDa(lista: ItemEstrutura[], tipo: DadosFechamento["tipo"]): Ligados {
  const porId = new Map(lista.map((s) => [s.id, s]));
  const resultado = porId.get("resultado");
  return {
    secao: (id) => !!porId.get(id)?.ativa,
    item: (id) => porId.get(id),
    res: resultado ? indicadoresLigados(resultado, tipo) : new Set(),
  };
}

// ── Cartões do resultado ─────────────────────────────────────────────────────

export interface Cartao {
  id: string;
  rotulo: string;
  valor: string;
  /** Variação contra o período anterior (mostrada como "+12,3% vs …"). */
  variacao?: Variacao;
  /** Texto complementar quando não há variação. */
  sub?: string;
  destaque?: boolean;
  tomValor?: "bom" | "ruim";
}

export function cartoesDoResultado(d: DadosFechamento, lig: Ligados, v: Vocabulario = NEUTRO): Cartao[] {
  const out: Cartao[] = [];
  const fat = d.faturamento;
  const ant = d.anterior;
  const quinzenal = d.tipo === "quinzenal";
  const ateDia = quinzenal ? ` até o dia ${Number(d.periodo.fim.slice(8, 10))}` : "";

  if (fat) {
    out.push({ id: "fat", rotulo: `Faturamento${ateDia}`, valor: brl0(fat.total), variacao: comparar(fat.total, ant?.faturamento) });
  }
  if (lig.res.has("res.entradas") && d.entradas) {
    out.push({ id: "ent", rotulo: "Entradas (recebido)", valor: brl0(d.entradas.total), sub: "pela data do recebimento" });
  }
  if (lig.res.has("res.despesas") && d.despesas) {
    out.push({ id: "desp", rotulo: `Despesas${ateDia}`, valor: brl0(d.despesas.total), variacao: comparar(d.despesas.total, ant?.despesas, false) });
  }
  const res = lig.res.has("res.resultado") ? calcularResultado(d) : null;
  if (res) {
    out.push({
      id: "res", rotulo: res.rotulo, valor: brl0(res.valor),
      sub: res.base > 0 ? `${pct(res.valor / res.base)} ${res.rotulo === "Resultado de caixa" ? "das entradas" : "do faturamento"}` : undefined,
      tomValor: res.valor < 0 ? "ruim" : undefined,
    });
  }
  if (lig.res.has("res.meta") && d.meta && fat) {
    if (quinzenal && d.ritmo?.projecao != null) {
      out.push({
        id: "meta", rotulo: "Meta: projeção do mês", valor: pct(d.ritmo.projecao / d.meta), destaque: true,
        sub: `realizado ${pct(d.ritmo.faturamentoMes / d.meta)} de ${brl0(d.meta)}`,
      });
    } else {
      out.push({ id: "meta", rotulo: "Atingimento da meta", valor: pct(atingimentoDaMeta(d)), destaque: true, sub: `meta ${brl0(d.meta)}` });
    }
  }
  if (fat) {
    const p = fat.pacientes, pa = ant?.pacientes;
    if (lig.res.has("res.atendidos") && p.atendidos !== null) {
      out.push({ id: "atend", rotulo: `${cap(v.clientes)} atendidos`, valor: inteiro(p.atendidos), variacao: comparar(p.atendidos, pa?.atendidos) });
    }
    if (lig.res.has("res.ticket") && p.ticketMedio !== null) {
      out.push({ id: "ticket", rotulo: "Ticket médio", valor: brl2(p.ticketMedio), variacao: comparar(p.ticketMedio, pa?.ticketMedio) });
    }
    if (lig.res.has("res.novos") && p.novos !== null) {
      const vn = comparar(p.novos, pa?.novos);
      out.push({
        id: "novos", rotulo: `${cap(v.clientes)} novos`, valor: inteiro(p.novos),
        ...(vn.valor !== null || vn.novo ? { variacao: vn } : { sub: p.atendidos ? `${pct(p.novos / p.atendidos, 0)} dos atendidos` : undefined }),
      });
    }
    if (lig.res.has("res.ticketNovos") && p.ticketNovos !== null) {
      const vt = comparar(p.ticketNovos, pa?.ticketNovos);
      out.push({
        id: "ticketNovos", rotulo: "Ticket médio dos novos", valor: brl2(p.ticketNovos),
        ...(vt.valor !== null ? { variacao: vt } : { sub: p.faturamentoNovos !== null ? `${brl0(p.faturamentoNovos)} com novos` : undefined }),
      });
    }
  }
  return out;
}

// ── Ritmo e caixa do mês (quinzenal) ─────────────────────────────────────────

export interface VisaoRitmo {
  diaFim: number;
  decorridos: number;
  diasMes: number;
  restantes: number;
  porDia: number | null;
  realizado: number;
  projecao: number | null;
  meta: number | null;
  atingimentoProjetado: number | null;
  falta: number | null;
  necessarioPorDia: number | null;
}

export function visaoRitmo(d: DadosFechamento): VisaoRitmo | null {
  const r = d.ritmo;
  if (!r) return null;
  return {
    diaFim: Number(d.periodo.fim.slice(8, 10)),
    decorridos: r.diasUteisDecorridos,
    diasMes: r.diasUteisMes,
    restantes: Math.max(0, r.diasUteisMes - r.diasUteisDecorridos),
    porDia: r.mediaPorDiaUtil,
    realizado: r.faturamentoMes,
    projecao: r.projecao,
    meta: r.meta,
    atingimentoProjetado: r.meta && r.projecao !== null ? r.projecao / r.meta : null,
    falta: r.faltaParaMeta,
    necessarioPorDia: r.necessarioPorDiaUtil,
  };
}

export interface VisaoCaixa {
  pagas: number;
  varPagas: Variacao;
  media: number | null;
  mesesDaMedia: string[];
  provisionado: number;
  /** "média − já pago" ou "vencimentos do resto do mês". */
  regraProvisionado: string;
  saldoProjetado: number | null;
  saldoPeriodo: number | null;
}

/**
 * Caixa do mês no parcial. Como no Sync, o que falta pagar é estimado pela média
 * dos meses anteriores; sem média, valem os vencimentos que ainda faltam no mês.
 */
export function visaoCaixa(d: DadosFechamento): VisaoCaixa | null {
  const c = d.caixaMes;
  if (!c) return null;
  const media = c.mediaDespesas ?? null;
  const provisionado = media !== null ? Math.max(0, media - c.despesasAteAData) : c.provisionado;
  const esperado = c.despesasAteAData + provisionado;
  const projecao = d.ritmo?.projecao ?? null;
  const [ano, mes] = d.periodo.inicio.split("-").map(Number);
  const meses: string[] = [];
  for (let k = c.mesesDaMedia ?? 0; k >= 1; k--) {
    const dt = new Date(ano, mes - 1 - k, 1);
    meses.push(mesAbrev(dt.getMonth() + 1));
  }
  return {
    pagas: c.despesasAteAData,
    varPagas: comparar(c.despesasAteAData, d.anterior?.despesas, false),
    media,
    mesesDaMedia: meses,
    provisionado,
    regraProvisionado: media !== null ? "média − já pago" : "vencimentos até o fim do mês",
    saldoProjetado: projecao !== null ? projecao - esperado : null,
    saldoPeriodo: d.faturamento ? d.faturamento.total - c.despesasAteAData : null,
  };
}

/** Nome de uma categoria que só existe no período anterior. */
function nomeDaChave(d: DadosFechamento, chave: string): string {
  return d.anterior?.nomesCategorias?.[chave] ?? chave.replace(/(^|\s)\S/g, (x) => x.toUpperCase());
}

// ── Receitas por categoria ───────────────────────────────────────────────────

export interface LinhaCategoria {
  nome: string;
  valor: number;
  antes: number | null;
  variacao: Variacao;
  quantidade: number;
  quantidadeAntes: number | null;
  ticket: number | null;
  ticketAntes: number | null;
  varTicket: Variacao;
  pct: number;
}

/** Categorias do período e do anterior (as que sumiram aparecem zeradas). */
export function categoriasDeReceita(d: DadosFechamento): LinhaCategoria[] {
  const fat = d.faturamento;
  if (!fat) return [];
  const antes = d.anterior?.receitasPorCategoria ?? {};
  const qtdAntes = d.anterior?.quantidadePorCategoria;
  const temAnterior = d.anterior?.faturamento != null;
  const vistas = new Set<string>();
  const linhas: LinhaCategoria[] = fat.porCategoria.map((c) => {
    const k = normalizarTexto(c.nome);
    vistas.add(k);
    const a = temAnterior ? antes[k] ?? 0 : null;
    const qa = qtdAntes ? qtdAntes[k] ?? 0 : null;
    const ticketAntes = a !== null && qa ? a / qa : null;
    return {
      nome: c.nome, valor: c.valor, antes: a, variacao: comparar(c.valor, a),
      quantidade: c.quantidade, quantidadeAntes: qa,
      ticket: c.quantidade ? c.ticket : null, ticketAntes,
      varTicket: comparar(c.quantidade ? c.ticket : null, ticketAntes),
      pct: c.pct,
    };
  });
  if (temAnterior) {
    for (const [k, valor] of Object.entries(antes)) {
      if (vistas.has(k) || valor <= 0) continue;
      linhas.push({
        nome: nomeDaChave(d, k), valor: 0, antes: valor, variacao: comparar(0, valor),
        quantidade: 0, quantidadeAntes: qtdAntes?.[k] ?? null, ticket: null, ticketAntes: null,
        varTicket: { valor: null, tom: "neutro" }, pct: 0,
      });
    }
  }
  return linhas;
}

// ── Despesas por grupo e categoria ───────────────────────────────────────────

export interface LinhaDespesa {
  nome: string;
  grupo: boolean;
  valor: number;
  antes: number | null;
  variacao: Variacao;
  pct: number;
  /** Subiu mais de 10% e ao menos R$ 300 (ou apareceu com R$ 300+). */
  aumentou: boolean;
}

const LIMITE_AUMENTO = 300;

function aumentou(valor: number, antes: number | null): boolean {
  if (antes === null) return false;
  if (antes <= 0) return valor >= LIMITE_AUMENTO;
  return valor - antes >= LIMITE_AUMENTO && valor / antes - 1 > 0.1;
}

export function linhasDeDespesa(d: DadosFechamento): LinhaDespesa[] {
  const desp = d.despesas;
  if (!desp) return [];
  const antes = d.anterior?.despesasPorCategoria ?? {};
  const temAnterior = d.anterior?.despesas != null;
  const total = desp.total;
  const out: LinhaDespesa[] = [];
  // categorias que tiveram valor no anterior e sumiram agora entram zeradas no seu grupo
  const grupos = desp.porGrupo.map((g) => ({ ...g, categorias: [...g.categorias] }));
  if (temAnterior) {
    const vistas = new Set(desp.porGrupo.flatMap((g) => g.categorias.map((c) => normalizarTexto(c.nome))));
    for (const [k, valor] of Object.entries(antes)) {
      if (vistas.has(k) || valor <= 0) continue;
      const nome = nomeDaChave(d, k);
      const grupo = grupoDaDespesa(nome);
      let g = grupos.find((x) => x.nome === grupo);
      if (!g) { g = { nome: grupo, valor: 0, pct: 0, categorias: [] }; grupos.push(g); }
      g.categorias.push({ nome, valor: 0, pct: 0 });
    }
    grupos.sort((a, b) => ordemDoGrupo(a.nome) - ordemDoGrupo(b.nome));
  }
  for (const g of grupos) {
    const cats = g.categorias.map((c) => {
      const a = temAnterior ? antes[normalizarTexto(c.nome)] ?? 0 : null;
      return {
        nome: c.nome, grupo: false, valor: c.valor, antes: a, variacao: comparar(c.valor, a, false),
        pct: total > 0 ? c.valor / total : 0, aumentou: aumentou(c.valor, a),
      };
    });
    const ag = temAnterior ? cats.reduce((s, c) => s + (c.antes ?? 0), 0) : null;
    out.push({
      nome: g.nome, grupo: true, valor: g.valor, antes: ag, variacao: comparar(g.valor, ag, false),
      pct: g.pct, aumentou: aumentou(g.valor, ag),
    });
    out.push(...cats);
  }
  return out;
}

export interface Aumento {
  nome: string;
  valor: number;
  antes: number;
  texto: string;
}

/** As categorias que mais subiram em reais (até 4), para o topo da página de despesas. */
export function maioresAumentos(d: DadosFechamento, comp: Comparacao): Aumento[] {
  return linhasDeDespesa(d)
    .filter((l) => !l.grupo && l.aumentou)
    .map((l) => ({ ...l, antes: l.antes ?? 0 }))
    .sort((a, b) => b.valor - b.antes - (a.valor - a.antes))
    .slice(0, 4)
    .map((l) => ({
      nome: l.nome, valor: l.valor, antes: l.antes,
      texto: l.antes > 0 ? `${textoVar(l.variacao)} vs ${comp.curto}` : `não houve em ${comp.curto}`,
    }));
}

// ── Série do ano ─────────────────────────────────────────────────────────────

export interface LinhaAno {
  mes: string;
  rotulo: string;
  faturamento: number | null;
  varFaturamento: Variacao;
  despesas: number | null;
  varDespesas: Variacao;
  saldo: number | null;
  despesasCompetencia: number | null;
  varCompetencia: Variacao;
  saldoCompetencia: number | null;
}

export interface VisaoAno {
  ano: string;
  linhas: LinhaAno[];
  temCompetencia: boolean;
  /** Entradas no lugar do faturamento (clínica com a fonte de Entradas). */
  porRecebido: boolean;
}

export function visaoAno(d: DadosFechamento): VisaoAno | null {
  const serie = serieAnual(d).filter((m) => m.faturamento !== null || m.despesas !== null || m.recebido !== null);
  if (serie.length === 0) return null;
  const porRecebido = serie.some((m) => m.recebido !== null);
  const entrada = (m: MesAnual) => (porRecebido ? m.recebido : m.faturamento);
  const linhas = serie.map((m, i) => {
    const prev = i > 0 ? serie[i - 1] : null;
    const e = entrada(m);
    const nomeMes = mesDaChave(m.mes);
    return {
      mes: m.mes,
      rotulo: nomeMes[0].toUpperCase() + nomeMes.slice(1),
      faturamento: e,
      varFaturamento: prev ? comparar(e, entrada(prev)) : { valor: null, tom: "neutro" as const },
      despesas: m.despesas,
      varDespesas: prev ? comparar(m.despesas, prev.despesas, false) : { valor: null, tom: "neutro" as const },
      saldo: e !== null && m.despesas !== null ? e - m.despesas : null,
      despesasCompetencia: m.despesasCompetencia,
      varCompetencia: prev ? comparar(m.despesasCompetencia, prev.despesasCompetencia, false) : { valor: null, tom: "neutro" as const },
      saldoCompetencia: e !== null && m.despesasCompetencia !== null ? e - m.despesasCompetencia : null,
    };
  });
  return {
    ano: serie[0].mes.slice(0, 4),
    linhas,
    temCompetencia: serie.some((m) => m.despesasCompetencia !== null),
    porRecebido,
  };
}

export function somaDe(linhas: LinhaAno[], f: (l: LinhaAno) => number | null): number {
  return linhas.reduce((t, l) => t + (f(l) ?? 0), 0);
}
