import {
  indiceDaColuna, lerData, lerValor, normalizarTexto, centavos, diaMs, contarPorTexto,
} from "@/lib/coletores/planilha";
import type { ItemContagem } from "@/lib/coletores/planilha";
import { situacaoEmAberto } from "@/lib/coletores/entradas-calculo";
import { grupoDaDespesa, ordemDoGrupo, GRUPO_OUTRAS } from "./grupos-despesa";

/**
 * Cálculos do fechamento a partir das linhas das planilhas. Módulo puro.
 * Percentuais e conversões vão de 0 a 1; a formatação é de quem exibe.
 */

export interface ItemValor {
  nome: string;
  valor: number;
  pct: number;
}

function somarPorNome(itens: { nome: string; valor: number }[], total: number): ItemValor[] {
  const mapa = new Map<string, { nome: string; valor: number }>();
  for (const { nome, valor } of itens) {
    const rotulo = nome.trim() || "Não informado";
    const chave = normalizarTexto(rotulo);
    const atual = mapa.get(chave);
    if (atual) atual.valor += valor; else mapa.set(chave, { nome: rotulo, valor });
  }
  return [...mapa.values()]
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((i) => ({ nome: i.nome, valor: centavos(i.valor), pct: total > 0 ? i.valor / total : 0 }));
}

/** Há alguma informação além de "Não informado"? */
export function temInformacao(itens: { nome: string }[] | null | undefined): boolean {
  return !!itens?.some((i) => i.nome !== "Não informado");
}

const ehSim = (v: unknown) => /^(sim|s|x|true|1|novo|nova|primeira vez|1a vez)$/.test(normalizarTexto(v));

// ── Vendas (faturamento) ─────────────────────────────────────────────────────

export interface ColunasVendas {
  data: string;
  valor: string;
  categoria?: string;
  profissional?: string;
  paciente?: string;
  primeira_vez?: string;
  pagamento?: string;
  unidade?: string;
}

export interface CategoriaVenda extends ItemValor {
  quantidade: number;
  ticket: number;
}

export interface ResultadoVendas {
  /** Soma do valor pago pela data do atendimento. */
  total: number;
  lancamentos: number;
  porCategoria: CategoriaVenda[];
  /** null = a fonte não tem a coluna. */
  porProfissional: ItemValor[] | null;
  porPagamento: ItemValor[] | null;
  porUnidade: ItemValor[] | null;
  pacientes: {
    /** Nomes de cliente diferentes no período; null sem a coluna de cliente. */
    atendidos: number | null;
    ticketMedio: number | null;
    temInformacaoDeNovos: boolean;
    novos: number | null;
    faturamentoNovos: number | null;
    ticketNovos: number | null;
  };
  linhasIlegiveis: number;
}

export function calcularVendas(
  linhas: unknown[][], col: ColunasVendas, inicio: Date, fim: Date,
): ResultadoVendas {
  const i = {
    data: indiceDaColuna(col.data), valor: indiceDaColuna(col.valor),
    categoria: indiceDaColuna(col.categoria), profissional: indiceDaColuna(col.profissional),
    paciente: indiceDaColuna(col.paciente), primeira: indiceDaColuna(col.primeira_vez),
    pagamento: indiceDaColuna(col.pagamento), unidade: indiceDaColuna(col.unidade),
  };
  const ini = diaMs(inicio), ate = diaMs(fim);
  const texto = (linha: unknown[], idx: number) => (idx >= 0 ? String(linha[idx] ?? "").trim() : "");

  let total = 0, lancamentos = 0, linhasIlegiveis = 0, faturamentoNovos = 0;
  const categorias = new Map<string, { nome: string; valor: number; quantidade: number }>();
  const profissionais: { nome: string; valor: number }[] = [];
  const pagamentos: { nome: string; valor: number }[] = [];
  const unidades: { nome: string; valor: number }[] = [];
  const atendidos = new Set<string>();
  const novos = new Set<string>();

  for (const linha of linhas) {
    const dataBruta = texto(linha, i.data);
    const valorBruto = texto(linha, i.valor);
    // sem valor lançado (linha em branco ou só agendada): não entra e não é erro
    if (!valorBruto) continue;

    const data = lerData(dataBruta);
    const valor = lerValor(valorBruto);
    if (!data || valor === null) { linhasIlegiveis++; continue; }
    const t = diaMs(data);
    if (t < ini || t > ate) continue;

    total += valor;
    lancamentos++;

    const nomeCat = texto(linha, i.categoria) || "Não informado";
    const chaveCat = normalizarTexto(nomeCat);
    const cat = categorias.get(chaveCat);
    if (cat) { cat.valor += valor; cat.quantidade++; }
    else categorias.set(chaveCat, { nome: nomeCat, valor, quantidade: 1 });

    if (i.profissional >= 0) profissionais.push({ nome: texto(linha, i.profissional), valor });
    if (i.pagamento >= 0) pagamentos.push({ nome: texto(linha, i.pagamento), valor });
    if (i.unidade >= 0) unidades.push({ nome: texto(linha, i.unidade), valor });

    const paciente = normalizarTexto(texto(linha, i.paciente));
    if (paciente) atendidos.add(paciente);
    if (i.primeira >= 0 && ehSim(linha[i.primeira])) {
      faturamentoNovos += valor;
      // sem coluna de cliente, cada lançamento de 1ª vez conta como um cliente novo
      novos.add(paciente || `linha-${lancamentos}`);
    }
  }

  const qtdAtendidos = i.paciente >= 0 ? atendidos.size : null;
  const temNovos = i.primeira >= 0;

  return {
    total: centavos(total),
    lancamentos,
    porCategoria: [...categorias.values()]
      .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"))
      .map((c) => ({
        nome: c.nome,
        valor: centavos(c.valor),
        quantidade: c.quantidade,
        ticket: c.quantidade > 0 ? centavos(c.valor / c.quantidade) : 0,
        pct: total > 0 ? c.valor / total : 0,
      })),
    porProfissional: i.profissional >= 0 ? somarPorNome(profissionais, total) : null,
    porPagamento: i.pagamento >= 0 ? somarPorNome(pagamentos, total) : null,
    porUnidade: i.unidade >= 0 ? somarPorNome(unidades, total) : null,
    pacientes: {
      atendidos: qtdAtendidos,
      ticketMedio: qtdAtendidos ? centavos(total / qtdAtendidos) : null,
      temInformacaoDeNovos: temNovos,
      novos: temNovos ? novos.size : null,
      faturamentoNovos: temNovos ? centavos(faturamentoNovos) : null,
      ticketNovos: temNovos && novos.size > 0 ? centavos(faturamentoNovos / novos.size) : null,
    },
    linhasIlegiveis,
  };
}

// ── Despesas ─────────────────────────────────────────────────────────────────

export interface ColunasDespesas {
  /** Regra Gestfy: a data da despesa é a de VENCIMENTO. */
  data: string;
  valor: string;
  categoria?: string;
  situacao?: string;
}

export interface GrupoDespesa extends ItemValor {
  categorias: ItemValor[];
}

export interface ResultadoDespesas {
  /** Todas as despesas com vencimento no período, pagas ou não. */
  total: number;
  lancamentos: number;
  /** Só com a coluna de situação: quanto do total já foi pago e quanto está em aberto. */
  pagas: number | null;
  emAberto: number | null;
  porGrupo: GrupoDespesa[];
  /** Categorias que não estão no plano de contas (caíram em "Outras despesas"). */
  categoriasForaDoPlano: string[];
  linhasIlegiveis: number;
}

export function calcularDespesas(
  linhas: unknown[][], col: ColunasDespesas, inicio: Date, fim: Date,
): ResultadoDespesas {
  const iData = indiceDaColuna(col.data), iValor = indiceDaColuna(col.valor);
  const iCat = indiceDaColuna(col.categoria), iSit = indiceDaColuna(col.situacao);
  const ini = diaMs(inicio), ate = diaMs(fim);

  let total = 0, lancamentos = 0, linhasIlegiveis = 0, emAberto = 0;
  const porCategoria = new Map<string, { nome: string; grupo: string; valor: number }>();

  for (const linha of linhas) {
    const dataBruta = String(linha[iData] ?? "").trim();
    const valorBruto = String(linha[iValor] ?? "").trim();
    // sem valor lançado (linha em branco ou só agendada): não entra e não é erro
    if (!valorBruto) continue;

    const data = lerData(dataBruta);
    const valor = lerValor(valorBruto);
    if (!data || valor === null) { linhasIlegiveis++; continue; }
    const t = diaMs(data);
    if (t < ini || t > ate) continue;

    total += valor;
    lancamentos++;
    if (iSit >= 0 && situacaoEmAberto(String(linha[iSit] ?? ""))) emAberto += valor;

    const nome = (iCat >= 0 ? String(linha[iCat] ?? "").trim() : "") || "Não informado";
    const chave = normalizarTexto(nome);
    const atual = porCategoria.get(chave);
    if (atual) atual.valor += valor;
    else porCategoria.set(chave, { nome, grupo: grupoDaDespesa(nome), valor });
  }

  const grupos = new Map<string, { nome: string; valor: number; categorias: { nome: string; valor: number }[] }>();
  for (const c of porCategoria.values()) {
    const g = grupos.get(c.grupo) ?? { nome: c.grupo, valor: 0, categorias: [] };
    g.valor += c.valor;
    g.categorias.push({ nome: c.nome, valor: c.valor });
    grupos.set(c.grupo, g);
  }

  return {
    total: centavos(total),
    lancamentos,
    pagas: iSit >= 0 ? centavos(total - emAberto) : null,
    emAberto: iSit >= 0 ? centavos(emAberto) : null,
    porGrupo: [...grupos.values()]
      .sort((a, b) => ordemDoGrupo(a.nome) - ordemDoGrupo(b.nome))
      .map((g) => ({
        nome: g.nome,
        valor: centavos(g.valor),
        pct: total > 0 ? g.valor / total : 0,
        categorias: g.categorias
          .sort((a, b) => b.valor - a.valor)
          .map((c) => ({ nome: c.nome, valor: centavos(c.valor), pct: total > 0 ? c.valor / total : 0 })),
      })),
    categoriasForaDoPlano: [...porCategoria.values()]
      .filter((c) => c.grupo === GRUPO_OUTRAS)
      .map((c) => c.nome)
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    linhasIlegiveis,
  };
}

// ── Leads ────────────────────────────────────────────────────────────────────

export interface ColunasLeads {
  data: string;
  convertido?: string;
  origem?: string;
  canal?: string;
  interesse?: string;
  objecao?: string;
}

export interface ResultadoLeadsDetalhe {
  total: number;
  agendados: number;
  /** 0 a 1; null sem leads no período. */
  conversao: number | null;
  porOrigem: ItemContagem[] | null;
  porCanal: ItemContagem[] | null;
  porInteresse: ItemContagem[] | null;
  /** Objeções dos leads que NÃO agendaram. */
  porObjecao: ItemContagem[] | null;
  linhasIlegiveis: number;
}

export function calcularLeads(
  linhas: unknown[][], col: ColunasLeads, inicio: Date, fim: Date, valorConversao = "sim",
): ResultadoLeadsDetalhe {
  const i = {
    data: indiceDaColuna(col.data), convertido: indiceDaColuna(col.convertido),
    origem: indiceDaColuna(col.origem), canal: indiceDaColuna(col.canal),
    interesse: indiceDaColuna(col.interesse), objecao: indiceDaColuna(col.objecao),
  };
  const ini = diaMs(inicio), ate = diaMs(fim);
  const alvo = normalizarTexto(valorConversao) || "sim";

  let total = 0, agendados = 0, linhasIlegiveis = 0;
  const origens: unknown[] = [], canais: unknown[] = [], interesses: unknown[] = [], objecoes: unknown[] = [];

  for (const linha of linhas) {
    const dataBruta = String(linha[i.data] ?? "").trim();
    if (!dataBruta) continue;
    const data = lerData(dataBruta);
    if (!data) { linhasIlegiveis++; continue; }
    const t = diaMs(data);
    if (t < ini || t > ate) continue;

    total++;
    const agendou = i.convertido >= 0 && normalizarTexto(linha[i.convertido]).includes(alvo);
    if (agendou) agendados++;

    if (i.origem >= 0) origens.push(linha[i.origem]);
    if (i.canal >= 0) canais.push(linha[i.canal]);
    if (i.interesse >= 0) interesses.push(linha[i.interesse]);
    if (i.objecao >= 0 && !agendou) objecoes.push(linha[i.objecao]);
  }

  return {
    total,
    agendados,
    conversao: total > 0 ? agendados / total : null,
    porOrigem: i.origem >= 0 ? contarPorTexto(origens) : null,
    porCanal: i.canal >= 0 ? contarPorTexto(canais) : null,
    porInteresse: i.interesse >= 0 ? contarPorTexto(interesses) : null,
    porObjecao: i.objecao >= 0 ? contarPorTexto(objecoes, true) : null,
    linhasIlegiveis,
  };
}
