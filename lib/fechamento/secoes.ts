import { secaoPorId } from "@/lib/estrutura/catalogo";
import { indicadoresLigados } from "@/lib/estrutura/estrutura";
import type { ItemEstrutura } from "@/lib/estrutura/estrutura";
import { NEUTRO, cap } from "@/lib/perfil/vocabulario";
import type { Vocabulario } from "@/lib/perfil/vocabulario";
import { normalizarTexto } from "@/lib/coletores/planilha";
import type { ItemContagem } from "@/lib/coletores/planilha";
import { ROTULO_GRUPO_ENTRADA } from "@/lib/coletores/entradas-calculo";
import { temInformacao } from "./calculos";
import type { ItemValor } from "./calculos";
import { calcularResultado, atingimentoDaMeta, variacao, serieAnual } from "./dados";
import type { DadosFechamento } from "./dados";
import { isoParaBR, MESES } from "./periodo";
import { lerAnalise, blocosParaCliente } from "./analise";
import { visaoCaixa } from "./visao";

/**
 * Transforma o retrato do fechamento nas seções do relatório, obedecendo a
 * estrutura da clínica (ordem, seções ligadas, nível e indicadores). A tela e o
 * texto do WhatsApp são dois jeitos de mostrar este mesmo resultado — por isso
 * nunca divergem. Módulo puro.
 */

// ── Formatação (padrão brasileiro) ───────────────────────────────────────────

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
export const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export const pct = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined
    ? "—"
    : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export const nota = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "▲ 12,3%" / "▼ 4,0%" / "" quando não há base. */
export function textoVariacao(v: number | null): string {
  if (v === null) return "";
  if (Math.abs(v) < 0.0005) return "= 0,0%";
  return `${v > 0 ? "▲" : "▼"} ${pct(Math.abs(v))}`;
}

// ── Formato das seções ───────────────────────────────────────────────────────

export interface LinhaSecao {
  rotulo: string;
  valor: string;
  /** Complemento ao lado do valor: variação, participação, conversão. */
  extra?: string;
  tom?: "bom" | "ruim";
}

export interface TabelaSecao {
  titulo: string;
  cabecalho: string[];
  linhas: string[][];
}

export interface AcaoPlano {
  /** Título da ação. */
  texto: string;
  /** Responsáveis, separados por " + ". */
  responsavel: string;
  /** DD/MM/AAAA ou texto livre ("sem prazo"). */
  prazo: string;
  /** O que fazer, em 1 ou 2 frases. */
  descricao?: string;
  /** Como medir se funcionou. */
  indicador?: string;
}

export interface SecaoMontada {
  id: string;
  titulo: string;
  linhas: LinhaSecao[];
  tabelas: TabelaSecao[];
  /** Observação curta abaixo da seção. */
  nota?: string;
  /** Preenchido quando a seção não tem o que mostrar: o motivo. */
  vazia?: string;
  /** Só na seção de análise. */
  texto?: string;
  acoes?: AcaoPlano[];
  /** Só na seção do gráfico: séries mês a mês (valores em reais; null = sem dado). */
  grafico?: GraficoSecao;
}

export interface GraficoSecao {
  /** Rótulos curtos dos meses: "jan", "fev"… */
  meses: string[];
  series: { nome: string; valores: (number | null)[] }[];
}

/** "2026-03" → "mar" */
export function mesCurto(anoMes: string): string {
  return MESES[Number(anoMes.slice(5, 7)) - 1]?.slice(0, 3) ?? anoMes;
}

export interface ContextoSecoes {
  vocabulario?: Vocabulario | null;
  analise?: string;
  acoes?: AcaoPlano[];
}

const LIMITE_TABELA = 12;

function tabelaContagem(titulo: string, coluna: string, itens: ItemContagem[]): TabelaSecao {
  return {
    titulo,
    cabecalho: [coluna, "Qtd.", "%"],
    linhas: itens.slice(0, LIMITE_TABELA).map((i) => [i.nome, num(i.quantidade), pct(i.pct, 0)]),
  };
}

function tabelaValor(titulo: string, coluna: string, itens: ItemValor[]): TabelaSecao {
  return {
    titulo,
    cabecalho: [coluna, "Valor", "%"],
    linhas: itens.slice(0, LIMITE_TABELA).map((i) => [i.nome, brl(i.valor), pct(i.pct, 0)]),
  };
}

function tom(v: number | null, maiorEhMelhor: boolean): "bom" | "ruim" | undefined {
  if (v === null || Math.abs(v) < 0.0005) return undefined;
  return v > 0 === maiorEhMelhor ? "bom" : "ruim";
}

// ── Seção por seção ──────────────────────────────────────────────────────────

type Montador = (
  d: DadosFechamento, item: ItemEstrutura, on: Set<string>, v: Vocabulario, ctx: ContextoSecoes,
) => Omit<SecaoMontada, "id" | "titulo"> & { titulo?: string };

const MONTADORES: Record<string, Montador> = {
  resultado(d, _item, on, v) {
    const linhas: LinhaSecao[] = [];
    const fat = d.faturamento;
    if (!fat && !d.despesas) return { linhas, tabelas: [], vazia: "sem fonte de Vendas nem de Despesas" };

    if (fat) {
      const var_ = variacao(fat.total, d.anterior?.faturamento);
      linhas.push({ rotulo: "Faturamento", valor: brl(fat.total), extra: textoVariacao(var_), tom: tom(var_, true) });
    }
    if (on.has("res.entradas") && d.entradas) {
      linhas.push({ rotulo: "Entradas (recebido)", valor: brl(d.entradas.total) });
    }
    if (on.has("res.despesas") && d.despesas) {
      const var_ = variacao(d.despesas.total, d.anterior?.despesas);
      linhas.push({ rotulo: "Despesas", valor: brl(d.despesas.total), extra: textoVariacao(var_), tom: tom(var_, false) });
    }
    const res = on.has("res.resultado") ? calcularResultado(d) : null;
    if (res) linhas.push({ rotulo: res.rotulo, valor: brl(res.valor), tom: res.valor >= 0 ? "bom" : "ruim" });

    const ating = on.has("res.meta") ? atingimentoDaMeta(d) : null;
    if (ating !== null && d.meta) {
      linhas.push({ rotulo: "Atingimento da meta", valor: pct(ating, 0), extra: `meta de ${brl(d.meta)}`, tom: ating >= 1 ? "bom" : undefined });
    }
    if (fat) {
      const p = fat.pacientes;
      if (on.has("res.atendidos") && p.atendidos !== null) {
        linhas.push({ rotulo: `${cap(v.clientes)} atendidos`, valor: num(p.atendidos) });
      }
      if (on.has("res.ticket") && p.ticketMedio !== null) linhas.push({ rotulo: "Ticket médio", valor: brl(p.ticketMedio) });
      if (on.has("res.novos") && p.novos !== null) linhas.push({ rotulo: `${cap(v.clientes)} novos`, valor: num(p.novos) });
      if (on.has("res.ticketNovos") && p.ticketNovos !== null) {
        linhas.push({ rotulo: "Ticket médio dos novos", valor: brl(p.ticketNovos) });
      }
    }
    return {
      titulo: d.tipo === "mensal" ? "Resultado do mês" : "Parcial do mês",
      linhas, tabelas: [],
      nota: d.anterior && (d.anterior.faturamento !== null || d.anterior.despesas !== null)
        ? `Variações em relação a ${d.anterior.rotulo}.` : undefined,
    };
  },

  ritmo(d) {
    const r = d.ritmo;
    if (!r) return { linhas: [], tabelas: [], vazia: "sem fonte de Vendas" };
    const linhas: LinhaSecao[] = [
      { rotulo: "Faturamento no mês até aqui", valor: brl(r.faturamentoMes) },
      { rotulo: "Dias úteis", valor: `${r.diasUteisDecorridos} de ${r.diasUteisMes}` },
    ];
    if (r.mediaPorDiaUtil !== null) linhas.push({ rotulo: "Média por dia útil", valor: brl(r.mediaPorDiaUtil) });
    if (r.projecao !== null) {
      linhas.push({
        rotulo: "Projeção para o mês", valor: brl(r.projecao),
        extra: r.meta ? `${pct(r.projecao / r.meta, 0)} da meta` : undefined,
        tom: r.meta ? (r.projecao >= r.meta ? "bom" : "ruim") : undefined,
      });
    }
    if (r.meta !== null && r.faltaParaMeta !== null) {
      linhas.push(r.faltaParaMeta > 0
        ? { rotulo: "Falta para a meta", valor: brl(r.faltaParaMeta), extra: `meta de ${brl(r.meta)}` }
        : { rotulo: "Meta do mês", valor: "batida", extra: brl(r.meta), tom: "bom" });
    }
    if (r.necessarioPorDiaUtil !== null) {
      linhas.push({ rotulo: "Necessário por dia útil restante", valor: brl(r.necessarioPorDiaUtil) });
    }
    return { linhas, tabelas: [] };
  },

  caixaMes(d) {
    const c = d.caixaMes;
    if (!c) return { linhas: [], tabelas: [], vazia: "sem fonte de Despesas" };
    const vc = visaoCaixa(d)!;
    const linhas: LinhaSecao[] = [
      { rotulo: "Despesas vencidas até aqui", valor: brl(c.despesasAteAData) },
      { rotulo: "Provisionado a pagar", valor: brl(vc.provisionado), extra: vc.regraProvisionado },
      { rotulo: "Vencimentos no mês", valor: brl(c.despesasDoMes) },
    ];
    if (c.mediaDespesas !== null && c.mediaDespesas !== undefined && c.mesesDaMedia) {
      const var_ = variacao(c.despesasDoMes, c.mediaDespesas);
      linhas.push({
        rotulo: c.mesesDaMedia === 1 ? "Despesas do mês anterior" : `Média dos ${c.mesesDaMedia} meses anteriores`,
        valor: brl(c.mediaDespesas),
        extra: var_ !== null ? `mês atual ${textoVariacao(var_)}` : undefined,
      });
    }
    if (vc.saldoProjetado !== null) {
      linhas.push({ rotulo: "Saldo projetado do mês", valor: brl(vc.saldoProjetado), tom: vc.saldoProjetado >= 0 ? "bom" : "ruim" });
    }
    return {
      linhas, tabelas: [],
      nota: vc.media !== null
        ? "Como no Sync: o que falta pagar é estimado pela média dos meses anteriores. Saldo projetado = projeção do faturamento − (já pago + provisionado)."
        : "Sem média dos meses anteriores: o provisionado são os vencimentos que ainda faltam no mês.",
    };
  },

  funilLeads(d, _item, on) {
    const l = d.leads;
    if (!l) return { linhas: [], tabelas: [], vazia: "sem fonte de Leads" };
    const linhas: LinhaSecao[] = [];
    const tabelas: TabelaSecao[] = [];
    if (on.has("leads.funil")) {
      linhas.push({ rotulo: "Leads", valor: num(l.total) });
      linhas.push({ rotulo: "Agendados", valor: num(l.agendados), extra: l.conversao !== null ? `${pct(l.conversao, 0)} de conversão` : undefined });
    }
    if (on.has("leads.servico") && temInformacao(l.porInteresse)) tabelas.push(tabelaContagem("Serviço mais buscado", "Serviço", l.porInteresse!));
    if (on.has("leads.origem") && temInformacao(l.porOrigem)) tabelas.push(tabelaContagem("Origem do lead", "Origem", l.porOrigem!));
    if (on.has("leads.canal") && temInformacao(l.porCanal)) tabelas.push(tabelaContagem("Canal de entrada", "Canal", l.porCanal!));
    if (on.has("leads.objecoes") && temInformacao(l.porObjecao)) tabelas.push(tabelaContagem("Motivos de não agendamento", "Motivo", l.porObjecao!));
    return { linhas, tabelas };
  },

  funilOrcamentos(d, _item, on) {
    const o = d.orcamentos;
    if (!o) return { linhas: [], tabelas: [], vazia: "sem fonte de Orçamentos" };
    const linhas: LinhaSecao[] = [];
    const tabelas: TabelaSecao[] = [];
    if (on.has("orc.valor")) {
      linhas.push({ rotulo: "Valor gerado", valor: brl(o.valorGerado) });
      linhas.push({ rotulo: "Valor fechado", valor: brl(o.valorFechado), extra: o.conversaoValor !== null ? `${pct(o.conversaoValor, 0)} de conversão` : undefined });
      linhas.push({ rotulo: "Valor em aberto", valor: brl(o.valorEmAberto) });
    }
    if (on.has("orc.quantidade")) {
      linhas.push({ rotulo: "Orçamentos", valor: num(o.total) });
      linhas.push({ rotulo: "Fechados", valor: num(o.fechados), extra: o.conversaoQuantidade !== null ? `${pct(o.conversaoQuantidade, 0)} de conversão` : undefined });
      linhas.push({ rotulo: "Em aberto", valor: num(o.emAberto) });
      linhas.push({ rotulo: "Não fecharam", valor: num(o.naoFechou) });
      if (o.cancelados > 0) linhas.push({ rotulo: "Cancelados (fora da conversão)", valor: num(o.cancelados) });
    }
    if (on.has("orc.status") && o.porStatus.length > 0) tabelas.push(tabelaContagem("Por status", "Status", o.porStatus));
    if (on.has("orc.motivos") && o.porObjecao.length > 0) tabelas.push(tabelaContagem("Motivos de não fechamento", "Motivo", o.porObjecao));
    return { linhas, tabelas };
  },

  experiencia(d, _item, on) {
    const linhas: LinhaSecao[] = [];
    const n = d.nps;
    if (n && on.has("exp.nps")) {
      linhas.push({
        rotulo: "NPS", valor: num(n.score),
        extra: `${num(n.respostas)} respostas · ${n.promotores} promotores, ${n.neutros} neutros, ${n.detratores} detratores`,
      });
    }
    const areas: [string, string, number | null | undefined][] = [
      ["exp.profissional", "Nota do profissional", n?.notas.profissional],
      ["exp.recepcao", "Nota da recepção", n?.notas.recepcao],
      ["exp.infraestrutura", "Nota da infraestrutura", n?.notas.infraestrutura],
      ["exp.enfermagem", "Nota da enfermagem", n?.notas.enfermagem],
    ];
    for (const [id, rotulo, valor] of areas) {
      if (on.has(id) && valor !== null && valor !== undefined) linhas.push({ rotulo, valor: nota(valor), extra: "de 5" });
    }
    if (d.google && on.has("exp.google")) {
      linhas.push({
        rotulo: "Avaliações no Google", valor: num(d.google.total),
        extra: d.google.media !== null ? `nota média ${nota(d.google.media)}` : undefined,
      });
    }
    if (linhas.length === 0) return { linhas, tabelas: [], vazia: "sem fonte de NPS nem avaliações do Google" };
    return { linhas, tabelas: [] };
  },

  receitas(d, item) {
    const fat = d.faturamento;
    if (!fat) return { linhas: [], tabelas: [], vazia: "sem fonte de Vendas" };
    const anterior = d.anterior?.receitasPorCategoria ?? {};
    const temAnterior = d.anterior?.faturamento !== null && d.anterior?.faturamento !== undefined;
    let categorias = fat.porCategoria.map((c) => ({ ...c, antes: anterior[normalizarTexto(c.nome)] ?? null as number | null }));
    // "todas": também as categorias que venderam no período anterior e zeraram agora
    if (item.nivel === "todas") {
      const presentes = new Set(fat.porCategoria.map((c) => normalizarTexto(c.nome)));
      for (const [chave, valor] of Object.entries(anterior)) {
        if (!presentes.has(chave) && valor > 0) {
          categorias.push({ nome: cap(chave), valor: 0, quantidade: 0, ticket: 0, pct: 0, antes: valor });
        }
      }
    } else {
      categorias = categorias.filter((c) => c.valor !== 0);
    }
    return {
      linhas: [{ rotulo: "Total de receitas", valor: brl(fat.total), extra: `${num(fat.lancamentos)} lançamentos` }],
      tabelas: [{
        titulo: "Por categoria",
        cabecalho: ["Categoria", "Valor", "Qtd.", "Ticket", "%", ...(temAnterior ? ["Variação"] : [])],
        linhas: categorias.map((c) => [
          c.nome, brl(c.valor), num(c.quantidade), brl(c.ticket), pct(c.pct, 0),
          ...(temAnterior ? [c.antes === null ? "nova" : textoVariacao(variacao(c.valor, c.antes)) || "—"] : []),
        ]),
      }],
      nota: item.nivel === "todas" && temAnterior
        ? `Inclui categorias que venderam em ${d.anterior!.rotulo} e não venderam agora.` : undefined,
    };
  },

  distribuicao(d, _item, on) {
    const fat = d.faturamento;
    if (!fat) return { linhas: [], tabelas: [], vazia: "sem fonte de Vendas" };
    const tabelas: TabelaSecao[] = [];
    if (on.has("dist.profissional") && temInformacao(fat.porProfissional)) tabelas.push(tabelaValor("Por profissional", "Profissional", fat.porProfissional!));
    if (on.has("dist.unidade") && temInformacao(fat.porUnidade)) tabelas.push(tabelaValor("Por unidade", "Unidade", fat.porUnidade!));
    if (on.has("dist.pagamento") && temInformacao(fat.porPagamento)) tabelas.push(tabelaValor("Meio de pagamento", "Meio", fat.porPagamento!));
    if (tabelas.length === 0) return { linhas: [], tabelas, vazia: "a fonte de Vendas não informa profissional, unidade nem meio de pagamento" };
    return { linhas: [], tabelas };
  },

  despesas(d, item) {
    const desp = d.despesas;
    if (!desp) return { linhas: [], tabelas: [], vazia: "sem fonte de Despesas" };
    const anterior = d.anterior?.despesasPorCategoria ?? {};
    const linhas: LinhaSecao[] = [{ rotulo: "Total de despesas", valor: brl(desp.total), extra: `${num(desp.lancamentos)} lançamentos` }];
    if (desp.emAberto !== null && desp.pagas !== null && desp.emAberto > 0) {
      linhas.push({ rotulo: "Já pagas", valor: brl(desp.pagas) });
      linhas.push({ rotulo: "Em aberto", valor: brl(desp.emAberto) });
    }
    const tabelas: TabelaSecao[] = [{
      titulo: "Por grupo",
      cabecalho: ["Grupo", "Valor", "%"],
      linhas: desp.porGrupo.map((g) => [g.nome, brl(g.valor), pct(g.pct, 0)]),
    }];
    if (item.nivel !== "grupos") {
      for (const g of desp.porGrupo) {
        tabelas.push({ titulo: g.nome, cabecalho: ["Categoria", "Valor", "%"], linhas: g.categorias.map((c) => [c.nome, brl(c.valor), pct(c.pct, 0)]) });
      }
    }
    // O que mais aumentou em reais, contra o período anterior
    const aumentos = desp.porGrupo.flatMap((g) => g.categorias)
      .map((c) => ({ nome: c.nome, atual: c.valor, antes: anterior[normalizarTexto(c.nome)] ?? 0 }))
      .map((c) => ({ ...c, delta: c.atual - c.antes }))
      .filter((c) => c.delta > 0.005)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);
    if (d.anterior?.despesas !== null && d.anterior?.despesas !== undefined && aumentos.length > 0) {
      tabelas.push({
        titulo: `O que mais aumentou (contra ${d.anterior.rotulo})`,
        cabecalho: ["Categoria", "Antes", "Agora", "Aumento"],
        linhas: aumentos.map((c) => [c.nome, brl(c.antes), brl(c.atual), `+ ${brl(c.delta)}`]),
      });
    }
    return { linhas, tabelas, nota: "Despesas pela data de vencimento, pagas ou não." };
  },

  entradas(d, item) {
    const e = d.entradas;
    if (!e) return { linhas: [], tabelas: [], vazia: "sem fonte de Entradas" };
    const linhas: LinhaSecao[] = [
      { rotulo: "Total de entradas (no resultado)", valor: brl(e.total), extra: `${num(e.lancamentos)} recebimentos` },
      { rotulo: "Operacionais", valor: brl(e.operacionais) },
      { rotulo: "Não operacionais", valor: brl(e.naoOperacionais) },
    ];
    if (e.emAberto.quantidade > 0) linhas.push({ rotulo: "Em aberto no período", valor: brl(e.emAberto.valor), extra: `${num(e.emAberto.quantidade)} lançamentos` });
    const tabelas: TabelaSecao[] = [];
    if (item.nivel !== "grupos") {
      const noResultado = e.porCategoria.filter((c) => c.grupo !== "fora");
      if (noResultado.length > 0) {
        tabelas.push({
          titulo: "Por categoria", cabecalho: ["Categoria", "Grupo", "Valor", "%"],
          linhas: noResultado.map((c) => [c.nome, ROTULO_GRUPO_ENTRADA[c.grupo], brl(c.valor), pct(c.pct, 0)]),
        });
      }
    }
    const fora = e.porCategoria.filter((c) => c.grupo === "fora");
    if (item.nivel === "completo" && fora.length > 0) {
      tabelas.push({ titulo: "Fora do resultado", cabecalho: ["Categoria", "Valor"], linhas: fora.map((c) => [c.nome, brl(c.valor)]) });
    }
    return {
      linhas, tabelas,
      nota: e.foraDoResultado > 0
        ? `Transferências, empréstimos e aportes (${brl(e.foraDoResultado)}) aparecem só como informação: não são receita.`
        : undefined,
    };
  },

  analise(_d, _item, _on, _v, ctx) {
    // o contexto do período é apoio interno: não vai para o cliente
    const texto = blocosParaCliente(lerAnalise(ctx.analise))
      .map((b, i) => (i === 0 && b.titulo === "Observação" ? b.texto : `${b.titulo}:\n${b.texto}`))
      .join("\n\n");
    const acoes = (ctx.acoes ?? []).filter((a) => a.texto.trim());
    if (!texto && acoes.length === 0) return { linhas: [], tabelas: [], vazia: "a análise ainda não foi escrita" };
    return { linhas: [], tabelas: [], texto, acoes };
  },

  grafico(d) {
    const serie = serieAnual(d).filter((m) => m.faturamento !== null || m.despesas !== null);
    if (serie.length < 2) return { linhas: [], tabelas: [], vazia: "esta leitura não tem a série do ano — leia as planilhas de novo" };
    return {
      linhas: [], tabelas: [],
      grafico: {
        meses: serie.map((m) => mesCurto(m.mes)),
        series: [
          { nome: "Faturamento", valores: serie.map((m) => m.faturamento) },
          { nome: "Despesas", valores: serie.map((m) => m.despesas) },
        ],
      },
    };
  },

  regimes(d, item) {
    const serie = serieAnual(d).filter((m) => m.faturamento !== null || m.despesas !== null || m.recebido !== null);
    if (serie.length === 0) return { linhas: [], tabelas: [], vazia: "esta leitura não tem a série do ano — leia as planilhas de novo" };
    // Entradas: o recebido quando a clínica tem a fonte; senão, o faturamento
    const temRecebido = serie.some((m) => m.recebido !== null);
    const temCompetencia = item.nivel !== "caixa" && serie.some((m) => m.despesasCompetencia !== null);
    const entrada = (m: (typeof serie)[number]) => (temRecebido ? m.recebido : m.faturamento);
    const v = (x: number | null) => (x === null ? "—" : brl(x));
    const saldo = (e: number | null, s: number | null) => (e === null || s === null ? "—" : brl(e - s));
    const soma = (f: (m: (typeof serie)[number]) => number | null) => serie.reduce((t, m) => t + (f(m) ?? 0), 0);
    const totalE = soma(entrada), totalS = soma((m) => m.despesas), totalC = soma((m) => m.despesasCompetencia);
    return {
      linhas: [],
      tabelas: [{
        titulo: "Mês a mês",
        cabecalho: ["Mês", temRecebido ? "Entradas" : "Faturamento", "Saídas", "Saldo", ...(temCompetencia ? ["Saídas (competência)", "Saldo (competência)"] : [])],
        linhas: [
          ...serie.map((m) => [
            mesCurto(m.mes), v(entrada(m)), v(m.despesas), saldo(entrada(m), m.despesas),
            ...(temCompetencia ? [v(m.despesasCompetencia), saldo(entrada(m), m.despesasCompetencia)] : []),
          ]),
          ["Total", brl(totalE), brl(totalS), brl(totalE - totalS), ...(temCompetencia ? [brl(totalC), brl(totalE - totalC)] : [])],
        ],
      }],
      nota: d.origem
        ? "Série calculada no Sync: saídas de caixa pela data de pagamento."
        : `Saídas pela data de vencimento${temCompetencia ? "; competência pelo mês informado na planilha" : ""}.`,
    };
  },
};

/** Seções ativas do relatório, na ordem da estrutura da clínica. */
export function montarSecoes(
  dados: DadosFechamento, lista: ItemEstrutura[], ctx: ContextoSecoes = {},
): SecaoMontada[] {
  const v = ctx.vocabulario ?? NEUTRO;
  const secoes: SecaoMontada[] = [];
  for (const item of lista) {
    if (!item.ativa) continue;
    const def = secaoPorId(item.id);
    const montador = MONTADORES[item.id];
    if (!def || !montador || !def.tipos.includes(dados.tipo)) continue;
    const { titulo, ...resto } = montador(dados, item, indicadoresLigados(item, dados.tipo), v, ctx);
    secoes.push({ id: item.id, titulo: titulo ?? def.titulo, ...resto });
  }
  return secoes;
}

// ── Texto para WhatsApp ──────────────────────────────────────────────────────

const LIMITE_TABELA_TEXTO = 8;

function textoDaTabela(t: TabelaSecao): string[] {
  const linhas = [`_${t.titulo}_`];
  for (const l of t.linhas.slice(0, LIMITE_TABELA_TEXTO)) {
    const [nome, ...resto] = l;
    linhas.push(`– ${nome}: ${resto.filter((c) => c && c !== "—").join(" · ")}`);
  }
  if (t.linhas.length > LIMITE_TABELA_TEXTO) linhas.push(`– … e mais ${t.linhas.length - LIMITE_TABELA_TEXTO}`);
  return linhas;
}

/**
 * Texto do fechamento para colar no WhatsApp. Seções sem dado ficam de fora —
 * o texto que vai para o cliente não anuncia o que falta.
 */
export function montarTextoFechamento(
  clinicaNome: string, dados: DadosFechamento, lista: ItemEstrutura[], ctx: ContextoSecoes = {},
): string {
  const v = ctx.vocabulario ?? NEUTRO;
  const partes: string[] = [];
  partes.push([
    `*${clinicaNome}*`,
    "",
    v.saudacao,
    `Segue o fechamento — *${dados.periodo.rotulo}*`,
    `\`Período: ${isoParaBR(dados.periodo.inicio)} a ${isoParaBR(dados.periodo.fim)}\``,
  ].join("\n"));

  for (const s of montarSecoes(dados, lista, ctx)) {
    if (s.vazia) continue;
    const linhas: string[] = [`*${s.titulo}*`];
    if (s.id === "regimes") {
      // no WhatsApp a tabela do ano não cabe: vai só o acumulado
      const total = s.tabelas[0]?.linhas.at(-1);
      const cab = s.tabelas[0]?.cabecalho ?? [];
      if (total) for (let i = 1; i < total.length; i++) linhas.push(`➤ ${cab[i]} no ano: ${total[i]}`);
      partes.push(linhas.join("\n"));
      continue;
    }
    for (const l of s.linhas) linhas.push(`➤ ${l.rotulo}: ${l.valor}${l.extra ? ` (${l.extra})` : ""}`);
    for (const t of s.tabelas) {
      if (t.linhas.length === 0) continue;
      linhas.push("", ...textoDaTabela(t));
    }
    if (s.texto) linhas.push(s.texto);
    if (s.acoes?.length) {
      linhas.push("", "_Plano de ação_");
      s.acoes.forEach((a, i) => {
        const detalhes = [a.responsavel.trim(), a.prazo.trim() && `até ${a.prazo.trim()}`].filter(Boolean).join(", ");
        linhas.push(`${i + 1}. ${a.texto.trim()}${detalhes ? ` — ${detalhes}` : ""}`);
        if (a.descricao?.trim()) linhas.push(`   ${a.descricao.trim()}`);
      });
    }
    if (linhas.length > 1) partes.push(linhas.join("\n"));
  }
  return partes.join("\n\n");
}
